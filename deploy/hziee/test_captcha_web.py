import base64
import http.client
import json
import select
import subprocess
import sys
import tempfile
import threading
import unittest
from pathlib import Path

from captcha_web import CaptchaServer, LoginSession


class CaptchaWebTest(unittest.TestCase):
    def setUp(self):
        work = Path(__file__).resolve().parents[2] / ".agent/work"
        work.mkdir(parents=True, exist_ok=True)
        self.directory = tempfile.TemporaryDirectory(prefix="captcha-test-", dir=str(work))
        self.image_path = Path(self.directory.name) / "captcha.png"
        self.image_path.write_bytes(base64.b64decode("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+j3ioAAAAASUVORK5CYII="))
        self.process = subprocess.Popen(
            [sys.executable, "-u", "-c",
             "import sys; print(sys.stdin.readline().strip())"],
            stdin=subprocess.PIPE, stdout=subprocess.PIPE, text=True,
        )
        self.session = LoginSession(self.process, self.image_path)
        self.server = CaptchaServer(("127.0.0.1", 0), self.session)
        self.thread = threading.Thread(target=self.server.serve_forever)
        self.thread.start()
        self.host = "127.0.0.1:" + str(self.server.server_port)

    def tearDown(self):
        self.server.shutdown()
        self.thread.join()
        self.server.server_close()
        self.process.terminate()
        self.process.communicate(timeout=5)
        self.directory.cleanup()

    def request(self, method, path, body=None, **headers):
        headers.setdefault("Host", self.host)
        headers.setdefault("Authorization", "Bearer " + self.session.token)
        if body is not None:
            headers.setdefault("Content-Type", "application/json")
            body = json.dumps(body)
        connection = http.client.HTTPConnection(self.host, timeout=5)
        connection.request(method, path, body, headers)
        response = connection.getresponse()
        result = response.status, response.read(), dict(response.getheaders())
        connection.close()
        return result

    def challenge(self):
        self.session.observe("Graph check code saved to captcha.png\n")
        self.session.observe("Please enter the graph check code JSON: \n")
        return {
            "challenge": self.session.challenge,
            "width": 272, "height": 192,
            "coordinates": [[35, 60], [100, 150]],
        }

    def test_page_and_state_do_not_expose_configuration(self):
        status, body, headers = self.request("GET", "/")
        self.assertEqual(status, 200)
        self.assertIn("验证码".encode(), body)
        self.assertEqual(headers["Cache-Control"], "no-store")
        status, body, _ = self.request("GET", "/api/state")
        self.assertEqual(status, 200)
        self.assertEqual(json.loads(body)["status"], "starting")
        self.assertEqual(self.request("GET", "/headless.toml")[0], 404)
        self.assertEqual(self.request("GET", "/../headless.toml")[0], 404)

    def test_http_submission_reaches_real_child_stdin_once(self):
        payload = self.challenge()
        status, image, _ = self.request("GET", "/api/image?challenge=" + payload["challenge"])
        self.assertEqual(status, 200)
        self.assertEqual(image, self.image_path.read_bytes())
        self.assertEqual(self.request("POST", "/api/submit", payload)[0], 200)
        self.assertTrue(select.select([self.process.stdout], [], [], 5)[0], "子进程没有收到提交内容")
        received = json.loads(self.process.stdout.readline())
        self.assertEqual(received, {key: payload[key] for key in ("coordinates", "width", "height")})
        self.assertEqual(self.request("POST", "/api/submit", payload)[0], 409)
        self.assertEqual(self.session.status, "submitted")

    def test_authentication_host_and_origin(self):
        payload = self.challenge()
        self.assertEqual(self.request("GET", "/api/state", Authorization="")[0], 403)
        self.assertEqual(self.request("GET", "/api/state", Authorization="Bearer é")[0], 403)
        self.assertEqual(self.request("GET", "/api/state", Host="evil.example")[0], 403)
        self.assertEqual(self.request("POST", "/api/submit", payload, Origin="https://evil.example")[0], 403)
        self.assertEqual(self.request("POST", "/api/submit", payload, Origin="http://" + self.host)[0], 200)

    def test_invalid_coordinates_and_dimensions_are_rejected(self):
        payload = self.challenge()
        for coordinates in ([], [[-1, 0]], [[272, 0]], [[0, 192]], [[True, 2]], [[1.2, 2]], ["bad"], None):
            with self.subTest(coordinates=coordinates):
                self.assertEqual(self.request("POST", "/api/submit", dict(payload, coordinates=coordinates))[0], 400)
        for width in (0, -1, True, "272", 999999):
            with self.subTest(width=width):
                self.assertEqual(self.request("POST", "/api/submit", dict(payload, width=width))[0], 400)
        self.assertEqual(self.request("POST", "/api/submit", [1, 2])[0], 400)
        self.assertEqual(self.session.status, "captcha")

    def test_new_challenge_rejects_old_page_and_survives_reload(self):
        old = self.challenge()
        current = self.challenge()
        self.assertNotEqual(old["challenge"], current["challenge"])
        self.assertEqual(self.request("POST", "/api/submit", old)[0], 409)
        self.assertEqual(self.request("GET", "/api/image?challenge=" + old["challenge"])[0], 409)
        self.assertEqual(json.loads(self.request("GET", "/api/state")[1])["challenge"], current["challenge"])
        self.assertEqual(self.request("POST", "/api/submit", current)[0], 200)

    def test_failed_image_save_cannot_submit_old_image(self):
        self.challenge()
        self.session.observe("Please enter the graph check code JSON: \n")
        self.assertEqual(self.session.status, "error")

    def test_connected_and_exited_process_cannot_accept_captcha(self):
        payload = self.challenge()
        self.session.observe("VPN client started\n")
        self.assertEqual(self.session.status, "connected")
        self.assertEqual(self.request("POST", "/api/submit", payload)[0], 409)
        self.session.finish(1)
        self.assertEqual(self.session.status, "exited")
        self.assertEqual(self.request("POST", "/api/submit", payload)[0], 409)

    def test_dead_process_is_rejected_before_writing(self):
        payload = self.challenge()
        self.process.terminate()
        self.process.wait(timeout=5)
        self.assertEqual(self.request("POST", "/api/submit", payload)[0], 409)

    def test_unreadable_or_empty_image_is_reported(self):
        self.image_path.unlink()
        self.challenge()
        self.assertEqual(self.session.status, "error")
        self.image_path.touch()
        self.challenge()
        self.assertEqual(self.session.status, "error")

    def test_invalid_json_and_request_sizes_are_rejected(self):
        self.challenge()
        for body in ("not-json", "[]", "{" + " " * 16384):
            connection = http.client.HTTPConnection(self.host, timeout=5)
            connection.request("POST", "/api/submit", body, {
                "Authorization": "Bearer " + self.session.token,
                "Content-Type": "application/json",
            })
            response = connection.getresponse()
            self.assertEqual(response.status, 400)
            response.read()
            connection.close()


if __name__ == "__main__":
    unittest.main()
