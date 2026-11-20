## [2026-11-20 12:38] HK-AK 学校 aTrust 部署

- **需求/问题描述**：
  > 把项目部署到 HK-AK，连接 vpn.hziee.edu.cn，使用钉钉扫码，并希望二维码显示在终端。

- **实际实现的功能与改动**：
  - 通过 Termius 安装 Docker、Compose，将 aTrust 部署到 /opt/hziee-vpn。
  - 新增独立 Compose 配置，固定镜像摘要，配置持久化、自动重启、日志大小上限和本机监听端口。
  - 保存 Termius noVNC 转发，127.0.0.1:18080 转发到服务器 8080。
  - 保存并启动 HTTP 18888 和 SOCKS5 11080 本地转发，均仅监听本机。
  - Compose 校验与启动成功，容器 running、无重启和 OOM，noVNC HTTP 200。
  - 用户通过图形界面扫码完成认证，工作台可见，utun7 和内网路由已建立。
  - 本机两个代理访问学校入口均返回 HTTP 302，curl 退出码 0。
  - 终端二维码输出未完成；已安装 qrencode，但图像传输损坏，期间用户已在图形界面完成扫码。
  - 具体校内业务系统和长期稳定性未验证；单个已下发路由 IP 的 HTTP 请求未取得有效响应。

- **涉及文件**：
  - `.gitignore`
  - `deploy/hziee/compose.yaml`
  - `deploy/hziee/README.md`
  - `memory/agents.md`、`memory/plan.md`、`memory/progress.md`、`memory/verify.md`、`memory/gotchas.md`
  - `docs/CHANGELOG.md`

- **Git 提交**：`98399010f24f1a7a6de1a680312c7a9995f50a95 feat: add private HZIEE aTrust deployment`，已普通推送到 origin/master。

---

## [2026-11-20 12:59] 每分钟 HTTP 保活与账号密码无图形配置

- **需求/问题描述**：
  > 每分钟探测 http://10.130.10.75/，利用 VPN 门户直接账号密码登录，修改项目以支持无图形部署。

- **实际实现的功能与改动**：
  - 图形版复用现有 PING_ADDR_URL / PING_INTERVAL，每轮等待 60 秒执行 HTTP 探测。
  - 新增独立 ZJU-Connect 1.3.1 Compose 与 TOML 示例，使用 aTrust auth/psw 和实际查询到的 ShenLan 登录域。
  - 复用客户端内置 HTTP GET 保活：登录后立即请求，之后每 60 秒请求，超时 10 秒。
  - 无图形版仅绑定本机 1080 / 8888，持久化会话，配置重启和日志轮换，忽略真实凭据及运行数据。
  - 补充配置、首次交互登录、代理验证、后台运行与恢复图形版说明；服务器未切换。
  - 两份 Compose 通过 5.8.0 config 校验；配置断言、bash -n、忽略规则及 diff 检查通过。
  - 1.3.1 原生客户端解析示例并实际查询学校认证信息成功；Docker Hub 确认版本标签和 amd64 / arm64 镜像存在。
  - 现有本机 HTTP 代理访问目标 10 秒超时，curl 退出 28。缺少真实凭据及本机容器引擎，未验证密码登录与实际分钟保活。

- **涉及文件**：
  - `.gitignore`
  - `deploy/hziee/compose.yaml`、`deploy/hziee/compose.headless.yaml`
  - `deploy/hziee/headless.toml.example`、`deploy/hziee/README.md`
  - `memory/agents.md`、`memory/plan.md`、`memory/progress.md`、`memory/verify.md`、`memory/gotchas.md`
  - `docs/CHANGELOG.md`

- **Git 提交**：`b8ad85a653edba253ea4d925065f44784f4cab05 feat: add headless HZIEE login and minute HTTP keepalive`，已普通推送到 origin/master。

---
