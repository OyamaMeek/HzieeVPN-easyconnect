import argparse
import json
import os
import secrets
import select
import signal
import subprocess
import sys
import threading
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qs, urlsplit


class RequestError(Exception):
    def __init__(self, status, message):
        self.status = status
        self.message = message


class LoginSession:
    def __init__(self, process, image_path):
        self.process = process
        self.image_path = image_path
        self.token = secrets.token_urlsafe(32)
        self.lock = threading.Lock()
        self.status = "starting"
        self.message = "正在连接，出现验证码后会自动显示。"
        self.challenge = ""
        self.image = b""
        self.image_saved = False

    def observe(self, line):
        with self.lock:
            if "Graph check code saved to " in line:
                self.image_saved = True
            if "Please enter the graph check code JSON:" in line:
                try:
                    if not self.image_saved:
                        raise ValueError("客户端没有成功保存本轮验证码，请检查终端后重新启动。")
                    image = self.image_path.read_bytes()
                    if not image or len(image) > 2 * 1024 * 1024:
                        raise ValueError("验证码图片为空或超过 2 MB，请检查终端。")
                    self.image = image
                    self.challenge = secrets.token_urlsafe(16)
                    self.status = "captcha"
                    self.message = "请按图片中的提示依次点选，再提交验证。"
                except (OSError, ValueError) as error:
                    self.status = "error"
                    self.message = str(error)
                    self.image = b""
                self.image_saved = False
            if "VPN client started" in line:
                self.status = "connected"
                self.message = "VPN 已连接，可以关闭此网页。请保持登录终端运行。"
                self.image = b""

    def finish(self, returncode):
        with self.lock:
            self.status = "exited"
            self.message = "登录进程已结束（退出码 %s），请查看终端并重新运行登录命令。" % returncode
            self.image = b""

    def submit(self, payload):
        with self.lock:
            if self.status != "captcha" or self.process.poll() is not None:
                raise RequestError(409, "当前没有等待提交的验证码，请等待页面更新。")
            if not isinstance(payload, dict):
                raise RequestError(400, "提交内容必须为 JSON 对象。")
            if payload.get("challenge") != self.challenge:
                raise RequestError(409, "验证码已更新，请使用当前图片重新点选。")
            width, height = payload.get("width"), payload.get("height")
            if any(type(value) is not int or not 1 <= value <= 8192 for value in (width, height)):
                raise RequestError(400, "验证码尺寸无效，请重新加载图片。")
            points = payload.get("coordinates")
            if not isinstance(points, list) or not 1 <= len(points) <= 32:
                raise RequestError(400, "请选择 1 至 32 个位置。")
            for point in points:
                if (not isinstance(point, list) or len(point) != 2
                        or any(type(value) is not int for value in point)
                        or not (0 <= point[0] < width and 0 <= point[1] < height)):
                    raise RequestError(400, "点选坐标无效，请重新点选。")
            code = json.dumps({"coordinates": points, "width": width, "height": height}, separators=(",", ":"))
            try:
                self.process.stdin.write(code + "\n")
                self.process.stdin.flush()
            except (BrokenPipeError, OSError, ValueError) as error:
                raise RequestError(409, "客户端已停止接收验证码，请检查终端。") from error
            self.status = "submitted"
            self.message = "已提交，正在验证；如需重新点选，页面会自动换图。"


class CaptchaServer(ThreadingHTTPServer):
    daemon_threads = True

    def __init__(self, address, session):
        self.session = session
        self.bind_host = address[0]
        super().__init__(address, CaptchaHandler)


def is_loopback_bind(bind_host):
    return bind_host in ("127.0.0.1", "localhost", "::1")


def is_allowed_host(host, port, bind_host):
    if not isinstance(host, str) or not host or len(host) > 255:
        return False
    if is_loopback_bind(bind_host):
        return host in ("127.0.0.1:%s" % port, "localhost:%s" % port, "[::1]:%s" % port)
    if any(ch in host for ch in " \t\r\n@/?#\\"):
        return False
    try:
        parsed = urlsplit("http://" + host)
        return (
            parsed.username is None
            and parsed.password is None
            and parsed.path == ""
            and parsed.query == ""
            and parsed.fragment == ""
            and bool(parsed.hostname)
            and parsed.port == port
            and parsed.netloc.lower() == host.lower()
        )
    except ValueError:
        return False


class CaptchaHandler(BaseHTTPRequestHandler):
    def setup(self):
        super().setup()
        self.connection.settimeout(5)

    def log_message(self, *_args):
        pass

    def reply(self, status, content, content_type="application/json; charset=utf-8"):
        if not isinstance(content, bytes):
            content = json.dumps(content, ensure_ascii=False).encode()
        self.send_response(status)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(content)))
        self.send_header("Cache-Control", "no-store")
        self.send_header("X-Content-Type-Options", "nosniff")
        self.send_header("Referrer-Policy", "no-referrer")
        self.send_header("Content-Security-Policy", "default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src 'self' blob:; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'")
        self.end_headers()
        self.wfile.write(content)

    def check_access(self, api):
        port = self.server.server_port
        bind_host = getattr(self.server, "bind_host", "127.0.0.1")
        host = self.headers.get("Host")
        if not is_allowed_host(host, port, bind_host):
            raise RequestError(403, "访问地址或端口不被允许。")
        origin = self.headers.get("Origin")
        if origin is not None:
            allowed_origins = ("http://" + host,) if is_loopback_bind(bind_host) else ("http://" + host, "https://" + host)
            if origin not in allowed_origins:
                raise RequestError(403, "请求来源无效。")
        if api and not secrets.compare_digest(self.headers.get("Authorization", "").encode(), ("Bearer " + self.server.session.token).encode()):
            raise RequestError(403, "访问链接已失效，请使用终端本次输出的完整链接。")

    def do_GET(self):
        try:
            url = urlsplit(self.path)
            self.check_access(url.path.startswith("/api/"))
            if url.path == "/":
                self.reply(200, Path(__file__).with_name("captcha.html").read_bytes(), "text/html; charset=utf-8")
            elif url.path == "/api/state":
                session = self.server.session
                with session.lock:
                    self.reply(200, {"status": session.status, "message": session.message, "challenge": session.challenge})
            elif url.path == "/api/image":
                session = self.server.session
                with session.lock:
                    if (session.status != "captcha"
                            or parse_qs(url.query).get("challenge") != [session.challenge]):
                        raise RequestError(409, "验证码已更新，请等待页面换图。")
                    self.reply(200, session.image, "image/png")
            else:
                raise RequestError(404, "页面不存在。")
        except RequestError as error:
            self.reply(error.status, {"message": error.message})

    def do_POST(self):
        try:
            self.check_access(True)
            if self.path != "/api/submit":
                raise RequestError(404, "页面不存在。")
            if self.headers.get("Content-Type") != "application/json":
                raise RequestError(400, "请提交 JSON 格式。")
            try:
                size = int(self.headers.get("Content-Length", "0"))
                if not 1 <= size <= 16384:
                    raise ValueError()
                payload = json.loads(self.rfile.read(size))
            except (ValueError, UnicodeDecodeError) as error:
                raise RequestError(400, "提交内容无效或超过大小限制。") from error
            self.server.session.submit(payload)
            self.reply(200, {"message": "已提交，正在验证。"})
        except RequestError as error:
            self.reply(error.status, {"message": error.message})


def main():
    directory = Path(__file__).resolve().parent
    parser = argparse.ArgumentParser(description="通过网页点选 aTrust 验证码并自动提交。")
    parser.add_argument("--host", default="127.0.0.1", help="网页监听地址，默认 127.0.0.1；对外通过高位端口开放时可设为 0.0.0.0")
    parser.add_argument("--port", type=int, default=18081, help="网页端口，默认 18081（对外开放时建议使用高位端口如 58081）")
    parser.add_argument("--image", type=Path, default=directory / "headless-data/captcha.png", help="客户端写入的验证码文件")
    parser.add_argument("command", nargs=argparse.REMAINDER, help="可选：-- 后接原生客户端命令；默认运行学校 Compose")
    args = parser.parse_args()
    if not 1 <= args.port <= 65535:
        parser.error("端口必须在 1 至 65535 之间。")
    command = args.command
    if command[:1] == ["--"]:
        command = command[1:]
    if not command:
        command = ["docker", "compose", "-f", str(directory / "compose.headless.yaml"),
                   "run", "--rm", "--service-ports", "-T", "vpn"]
    os.umask(0o077)
    session = LoginSession(None, args.image.resolve())
    try:
        server = CaptchaServer((args.host, args.port), session)
    except OSError as error:
        parser.exit(1, "无法启动验证码网页：%s\n" % error)
    try:
        process = subprocess.Popen(command, stdin=subprocess.PIPE, stdout=subprocess.PIPE,
                                   stderr=subprocess.STDOUT, text=True, encoding="utf-8",
                                   errors="replace", bufsize=1, start_new_session=True)
    except OSError as error:
        server.server_close()
        parser.exit(1, "无法启动登录客户端：%s\n" % error)
    session.process = process
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    if args.host in ("0.0.0.0", "::"):
        print("验证码网页（对外高位端口）：http://<服务器IP>:%s/#%s" % (args.port, session.token), flush=True)
        print("验证码网页（本机地址）：http://127.0.0.1:%s/#%s" % (args.port, session.token), flush=True)
    else:
        print("验证码网页：http://%s:%s/#%s" % (args.host, args.port, session.token), flush=True)
    print("请保持此终端运行。其他短信或二次认证请在终端输入。", flush=True)

    def forward_input():
        while process.poll() is None:
            if not select.select([sys.stdin], [], [], 0.2)[0]:
                continue
            data = os.read(sys.stdin.fileno(), 4096)
            if not data:
                return
            with session.lock:
                if process.poll() is not None:
                    return
                if session.status == "captcha":
                    print("请在网页中完成当前验证码。", flush=True)
                    continue
                try:
                    process.stdin.write(data.decode("utf-8"))
                    process.stdin.flush()
                except (BrokenPipeError, OSError, ValueError):
                    return

    threading.Thread(target=forward_input, daemon=True).start()

    def interrupt(_signum, _frame):
        raise KeyboardInterrupt()

    signal.signal(signal.SIGTERM, interrupt)
    signal.signal(signal.SIGHUP, interrupt)
    try:
        for line in process.stdout:
            print(line, end="", flush=True)
            session.observe(line)
        returncode = process.wait()
        session.finish(returncode)
        return returncode
    except KeyboardInterrupt:
        return 130
    finally:
        if process.poll() is None:
            os.killpg(process.pid, signal.SIGINT)
            try:
                process.wait(timeout=10)
            except subprocess.TimeoutExpired:
                os.killpg(process.pid, signal.SIGKILL)
                process.wait()
        process.stdin.close()
        process.stdout.close()
        server.shutdown()
        server.server_close()
        thread.join()


if __name__ == "__main__":
    sys.exit(main())
