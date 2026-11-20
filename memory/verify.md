# 当前验证标准

- 产品文件仅包含信工 VPN 密码登录配置、验证码 Python/HTML、测试、使用说明和许可证；开发记录按协作要求保留。
- 删除通用构建、扫码/VNC 和对应工作流后，保留文件 SHA-256 与 Compose 完整解析 JSON 必须与清理前一致；本地凭据和会话不变且继续被 Git 忽略。
- 运行 `python3 -B -m unittest discover -s deploy/hziee -p 'test_captcha_web.py' -v`，验证真实 HTTP 请求、子进程 stdin、鉴权、坐标校验、重复与过期提交、进程退出处理。
- 使用已有 `.agent/work/docker-compose` 校验 `compose.headless.yaml`，确认只包含 vpn 服务，使用 ZJU-Connect 1.3.1，端口只绑定 127.0.0.1，保留配置只读挂载、会话目录、自动重启与日志轮换。
- 检查首页和部署说明无已删除入口、失效本地链接；检查 HTML 内联 JavaScript 语法与 `git diff --check`。
- 提交不包含密码、会话、验证码、日志或本地工具；普通推送后核对 origin/master 与 HEAD。
- 本机没有 Docker 引擎，本次不验证容器启动、真实重新登录或服务器切换；不执行视觉检查。

历史真实登录证据保存在 `docs/CHANGELOG.md`：2026-11-20 本机原生客户端曾通过网页点选完成密码认证，HTTP/SOCKS5 访问校内目标均 HTTP 200，会话恢复与 60 秒保活通过。这些历史结果不作为本次容器运行证据。

本次实际结果：`.agent/work/password-only/check_scope.py` 清理前 4 项中 2 项因无关文件和文档入口失败，清理后 4 项全部通过。保留的 5 个产品文件、本地凭据与会话基线 SHA-256 一致，Compose 完整 JSON 一致；10 项现有 HTTP/真实子进程管道测试、Compose 5.8.0 config、Node JavaScript 语法与 `git diff --check` 全部通过。检查脚本及基线仅保存在被忽略的 `.agent/work/password-only/`。未运行 Docker 容器、真实重新登录、视觉检查或服务器操作。
