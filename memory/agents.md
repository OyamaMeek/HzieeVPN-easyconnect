# 当前环境

- 代理：Codex，Ponytail full。
- 本地项目：macOS 上的 HzieeVPN-easyconnect，master 分支；工作目录仍为 docker-easyconnect。
- GitHub 仓库：OyamaMeek/HzieeVPN-easyconnect，仓库 ID 1464974211。
- 项目仅保留学校账号密码部署配置、验证码网页登录脚本、测试与说明，使用 ZJU-Connect 成品镜像。
- 目标服务器：用户私有 VPS，Debian 13 amd64；真实地址仅保留在用户本地连接配置中。
- 远程操作：用户指定 Termius，通过 cua_repl 操作现有终端；Termalin 因账户限制不可用。
- 登录：学校入口 https://vpn.hziee.edu.cn 使用 aTrust；现有服务器通过钉钉扫码登录，用户已确认另有门户直接密码账号。
- 密码登录：ZJU-Connect 1.3.1，密码认证 auth/psw、上网账号登录域 ShenLan，复用内置 60 秒 HTTP 保活；服务器尚未切换。
- 本机没有 Docker 引擎，验证工具下载至已忽略的 `.agent/work/`。
- 用户已在被忽略的 `deploy/hziee/headless.toml` 填写真实凭据；测试只让客户端读取，不输出凭据。配置文件权限已收紧为 600。
- 验证码网页：Python 3.9+ 标准库脚本 `deploy/hziee/captcha_web.py`，仅绑定 127.0.0.1:18081；网页自动向客户端 stdin 提交点选 JSON，默认启动现有 Compose 前台容器。
