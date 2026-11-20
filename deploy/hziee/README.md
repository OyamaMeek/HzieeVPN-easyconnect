# 杭电信工 VPN 账号密码登录

学校入口：<https://vpn.hziee.edu.cn>。使用“上网账号(I-XG)”密码认证，客户端为 ZJU-Connect 1.3.1，验证码在本机浏览器点选。

## 准备与首次登录

安装 Docker、Docker Compose 和 Python 3.9 或更新版本。在本目录操作；已有配置文件时保留原文件：

```bash
cp -n headless.toml.example headless.toml
chmod 600 headless.toml
```

在编辑器中填写 `headless.toml` 的 `username` 和 `password`。示例已设置学校入口、`auth/psw`、`ShenLan` 登录域和校内保活地址。确认 1080、8888 端口空闲，然后运行：

```bash
docker compose -f compose.headless.yaml config --quiet
python3 captcha_web.py
```

脚本默认启动一次性前台登录容器，并输出验证码网页完整链接。按图片提示依次点选并提交；其他二次认证在终端输入。登录成功后，在另一终端验证代理：

```bash
curl --noproxy '' --proxy http://127.0.0.1:8888 --max-time 15 http://10.130.10.75/
curl --noproxy '' --socks5-hostname 127.0.0.1:1080 --max-time 15 http://10.130.10.75/
```

按 `Ctrl+C` 结束前台登录，再启动后台服务：

```bash
docker compose -f compose.headless.yaml up -d
docker compose -f compose.headless.yaml logs --tail=50 -f vpn
```

会话保存于 `headless-data/`，会话有效时自动恢复。登录后客户端立即访问 `http://10.130.10.75/`，之后每 60 秒执行一次，单次最多 10 秒；日志记录响应状态。容器配置自动重启和日志轮换。

## 验证码网页

在本目录执行 `python3 captcha_web.py`。网页固定监听 `127.0.0.1:18081`，启动链接带随机令牌，复制时需保留 `#` 及后面的内容。网页显示当前验证码与连接状态，支持顺序点选、撤销、清空、触摸操作和自动换图；聚焦图片后可用方向键移动、回车确认。坐标按原图尺寸换算，提交内容自动写入客户端 stdin。

图片保存在 `headless-data/captcha.png`。网页不提供账号密码或会话文件下载；脚本和登录进程退出后网页服务结束。同一主机上只启动一份使用这些代理端口的客户端。

在服务器部署时，在本机另开终端建立 SSH 隧道：

```bash
ssh -N -L 127.0.0.1:18081:127.0.0.1:18081 root@example.com
```

`example.com` 是占位符，请替换为自己的服务器地址，并使用自己的 SSH 用户名。也可在 Termius 中配置相同的本地转发。随后在本机浏览器打开服务器终端输出的完整链接。

需要纯终端输入验证码时执行：

```bash
docker compose -f compose.headless.yaml run --rm --service-ports -it vpn
```

本机原生 ZJU-Connect 也可使用此页面：用 `--image` 指定与客户端 `--graph-code-file` 相同的文件，在 `--` 后传入客户端命令。配置、会话和代理监听地址由客户端命令决定。网页端口可用 `--port` 指定，SSH 隧道两端使用相同端口。

## 使用代理与运维

代理仅监听宿主机 `127.0.0.1:1080`（SOCKS5）和 `127.0.0.1:8888`（HTTP）。宿主机程序需显式设置代理，SOCKS5 使用代理端 DNS 解析。远程使用时，在本机建立代理转发：

```bash
ssh -N -L 127.0.0.1:11080:127.0.0.1:1080 -L 127.0.0.1:18888:127.0.0.1:8888 root@example.com
```

应用使用 HTTP `127.0.0.1:18888` 或 SOCKS5 `127.0.0.1:11080`。服务器地址与用户名同样需要替换。

在部署目录执行日常命令：

```bash
docker compose -f compose.headless.yaml ps
docker compose -f compose.headless.yaml logs --tail=50 -f vpn
docker compose -f compose.headless.yaml restart vpn
docker compose -f compose.headless.yaml stop vpn
```

会话失效时，先停止后台服务，再运行 `python3 captcha_web.py` 重新登录。修改配置后运行 `docker compose -f compose.headless.yaml up -d` 应用变更。日志每份最多 10 MB，保留 2 份。`headless.toml` 和 `headless-data/` 已被 Git 忽略，请勿分享。

## 开发检查

在项目根目录运行：

```bash
python3 -B -m unittest discover -s deploy/hziee -p 'test_captcha_web.py' -v
```

测试验证 HTTP 服务、真实子进程输入、请求鉴权、坐标检查及过期和重复提交处理。本机原生客户端此前已完成真实密码登录、网页点选、HTTP/SOCKS5 访问、会话恢复和 60 秒保活验证，历史记录见项目开发日志。本次精简不修改登录代码；本机缺少 Docker 引擎，容器首次启动与服务器密码登录切换尚未验证。
