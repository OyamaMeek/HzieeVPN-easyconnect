# 当前环境

- 代理：Codex，Ponytail full。
- 本地项目：macOS 上的 HzieeVPN-easyconnect，master 分支；工作目录仍为 docker-easyconnect。
- GitHub 仓库：OyamaMeek/HzieeVPN-easyconnect，仓库 ID 1464974211。
- 项目包含从 ZJU-Connect 克隆的 Go 客户端源码、学校密码登录配置及验证码网页；镜像由本仓库 GitHub Actions 编译并发布至 GHCR。
- 当前试部署目标：Termius 中的 Shanghai-Aliyun，Debian 13 amd64；此前部署保留在 HK-AK（用户所说的 hi-Al）。真实地址仅保留在用户本地连接配置中。
- Shanghai-Aliyun 已安装 Docker/Compose/socat/jq；旧 `atrust-qr.service` 已停用，现通过 `/opt/hziee-vpn/compose.yaml` 运行由 GitHub Actions 构建的统一登录镜像 `ghcr.io/oyamameek/hzieevpn-easyconnect:atrust-sha-e5121a3553baa014217d5c18f8f7085ea179f1f7`（摘要 `sha256:a52cc61141a48ea9ba81c6e1014a02b1be4a025dc21c3fe07853f329b06f2b5b`），容器名 `hziee-vpn-atrust-1`，数据卷 `/opt/hziee-vpn/data:/root`，宿主机监听 `127.0.0.1:1080`、`127.0.0.1:8888` 与 `0.0.0.0:58081`。
- 用户明确要求代理点选验证码；最终在出图约 24 秒后提交，官方模块返回 code=0、Succeeded。原二维码包装入口已恢复，远程两份与本机两份临时凭据均已删除，一次性运行模块已清理；保留当前在线进程及会话，没有重启。原 TOML 与客户端数据保留。用户已批准 Termius 截图检查，窗口可通过系统 Window 菜单 Zoom 恢复显示。
- 远程操作：用户指定 Termius，通过 cua_repl 操作现有终端；Termalin 因账户限制不可用。
- 登录：学校入口 https://vpn.hziee.edu.cn 使用 aTrust；现有服务器通过钉钉扫码登录，用户已确认另有门户直接密码账号。
- 密码登录：ZJU-Connect 1.3.1，密码认证 auth/psw、上网账号登录域 ShenLan，复用内置 60 秒 HTTP 保活；用户镜像及配置已上传 `/opt/hziee-headless`。首次认证后因学校节点不可达退出，尚未完成切换；旧容器已重新启动，校内 HTTP 请求仍超时。
- 本机没有 Docker 引擎，验证工具下载至已忽略的 `.agent/work/`。
- 用户已在被忽略的 `deploy/hziee/headless.toml` 填写真实凭据；测试只让客户端读取，不输出凭据。配置文件权限已收紧为 600。
- 验证码网页：Python 3.9+ 标准库脚本 `deploy/hziee/captcha_web.py`，仅绑定 127.0.0.1:18081；网页自动向客户端 stdin 提交点选 JSON，默认启动现有 Compose 前台容器。
- 官方 aTrust 二维码：用户要求复用 `hagb/docker-atrust` 的 `hziee-vpn-atrust-1`（资源版本 2.5.16.20）。组件 `69eea0c` 位于原根目录数据挂载的 `.atrust-qr/`，官方入口包装原主文件，备份在 `/opt/hziee-atrust-qr`；认证与隧道继续由官方客户端处理。`atrust-qr.service` 仅转发回环 28081，复用 Termius `HZIEE DingTalk` SSH 转发，原 1080/8888 代理保留。23:06 复核原容器、恢复转发，初始状态 logout；重启原容器后网页取得真实二维码，终端已输出轮换后的链接，页面保留供本人扫码。本轮未确认登录，之前校内访问和保活未通过。此前 `/opt/hziee-dingtalk` 的 Go 扫码容器已停止。
