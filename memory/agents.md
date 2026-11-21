# 当前环境

- 代理：Codex，Ponytail full。
- 本地项目：macOS 上的 HzieeVPN-easyconnect，master 分支；工作目录仍为 docker-easyconnect。
- GitHub 仓库：OyamaMeek/HzieeVPN-easyconnect，仓库 ID 1464974211。
- 项目包含从 ZJU-Connect 克隆的 Go 客户端源码、学校密码登录配置及验证码网页；镜像由本仓库 GitHub Actions 编译并发布至 GHCR。
- 目标服务器：Termius 中的 HK-AK（用户所说的 hi-Al），Debian 13 amd64；真实地址仅保留在用户本地连接配置中。
- 远程操作：用户指定 Termius，通过 cua_repl 操作现有终端；Termalin 因账户限制不可用。
- 登录：学校入口 https://vpn.hziee.edu.cn 使用 aTrust；现有服务器通过钉钉扫码登录，用户已确认另有门户直接密码账号。
- 密码登录：ZJU-Connect 1.3.1，密码认证 auth/psw、上网账号登录域 ShenLan，复用内置 60 秒 HTTP 保活；用户镜像及配置已上传 `/opt/hziee-headless`。首次认证后因学校节点不可达退出，尚未完成切换；旧容器已重新启动，校内 HTTP 请求仍超时。
- 本机没有 Docker 引擎，验证工具下载至已忽略的 `.agent/work/`。
- 用户已在被忽略的 `deploy/hziee/headless.toml` 填写真实凭据；测试只让客户端读取，不输出凭据。配置文件权限已收紧为 600。
- 验证码网页：Python 3.9+ 标准库脚本 `deploy/hziee/captcha_web.py`，仅绑定 127.0.0.1:18081；网页自动向客户端 stdin 提交点选 JSON，默认启动现有 Compose 前台容器。
- 钉钉独立网页：Go 客户端通过学校 `auth/dingtalk` 的临时授权码接口登录，无 VNC 依赖；HK-AK 的 `/opt/hziee-dingtalk` 已部署 `hziee-dingtalk-vpn-1`，镜像版本对应源码 `f3a61a5`。网页、SOCKS5、HTTP 分别仅映射 127.0.0.1:28081、11081、18889，数据目录权限 700、配置权限 600。Termius `HZIEE DingTalk` 转发本地 28081 到同名远程端口；已确认用户扫码临时码可以到达服务器，但学校票据跳转此前被拒绝。已更新 HTTPS 默认端口校验并换入本轮访问链接，等待本人再次扫码核对，尚未验证认证票据及隧道。
