# 当前设计与计划

## 根目录 README 详细部署指南（2026-11-24）

1. 重写根目录 `README.md`，完整反映仓库当前有效的三套部署方案与双镜像发布体系：
   - 项目定位、Mermaid 运行拓扑图与三种部署方案选型表（官方 aTrust 容器推荐方案、Go 无图形密码登录方案、Go 无图形钉钉扫码方案）。
   - 前置条件：宿主机架构、`/dev/net/tun` 与 `NET_ADMIN` 要求、Docker/Compose/Python 版本、学校认证入口与数据节点网络连通性、端口与安全组规则。
   - 方案一（`deploy/hziee/compose.atrust.yaml`）：数据目录准备、容器启动、SSH 转发与高位端口直连两种访问方式、密码验证码与钉钉扫码双模式操作、10 分钟超时或登录成功后自动关闭机制、环境变量表。
   - 方案二（`deploy/hziee/compose.headless.yaml`）：`headless.toml` 凭据配置、`captcha_web.py` 首次交互登录、后台常驻运行与会话持久化。
   - 方案三（`deploy/hziee/compose.dingtalk.yaml`）：独立端口与会话目录、SSH 转发 `28081` 扫码登录流程。
   - 连接验证与远程代理接入（本机 `curl` 检查与个人电脑 SSH 本地端口转发）、日常运维与镜像升级、源码构建与本地测试、常见问题排查、敏感文件保护与开源许可证。
2. 校验文档中的文件路径、相对链接与锚点、命令参数、端口号、环境变量及脱敏占位符，更新 `docs/CHANGELOG.md` 与 `memory/` 并提交推送。

## aTrust 镜像内置每分钟保活与精简无关组件（2026-11-24）

1. 在 `deploy/hziee/atrust-scripts/` 提供专用于官方 aTrust 的最小化容器运行脚本：
   - `keepalive-ping.sh`：默认每 60 秒对 `10.130.10.75` 执行 ICMP ping（`PING_ADDR=10.130.10.75`）与 HTTP 探测（`PING_ADDR_URL=http://10.130.10.75/`），并正确响应 `SIGINT`/`SIGTERM` 退出。
   - `vpn-config.sh`：仅保留 aTrust 配置（`utun7`、`aTrustAgent`、`aTrustTray`、`fake-getlogin.so`、`FORCE_OPEN_PORTS="54631 ${ATRUST_WEB_PORT:-58081}"`），移除 EasyConnect（`EC_CLI`/`EC_GUI`）与 `fake-hwaddr` 逻辑。
   - `start-sangfor.sh`：仅保留 `aTrustAgent` 守护进程与 `aTrustTray` 重启循环，移除 `FAKE_HWADDR` 与交互式 `EXIT_LOCK`。
   - `start.sh`：仅保留 `danted`（SOCKS5 1080）、`tinyproxy`（HTTP 8888）、VPN NAT/策略路由、`FORCE_OPEN_PORTS`、无头 `Xvfb`（供 Electron 抓取验证码与钉钉二维码，无任何 VNC/TCP 监听端口）、`keepalive-ping.sh` 与 `start-sangfor.sh`，移除 TigerVNC、noVNC、`flwm`、`stalonetray`、`xclip`、`CHROMIUM`、`FORWARD` 与 EasyConnect 逻辑。
2. 更新 `Dockerfile.atrust`：基于固定摘要的 `hagb/docker-atrust` 阶段安装 `xvfb`，卸载并清理 `tigervnc-standalone-server`、`tigervnc-tools`、`flwm`、`stalonetray`、`xclip`、`x11-utils`、`libssl-dev`、`wget`，删除 `/usr/local/bin/novnc*`、`/usr/local/share/novnc`、`/etc/tinyproxy-novnc.conf`、剪贴板脚本、`xdg-open`、`test-*libs.sh`、`fake-hwaddr.so`、`/usr/share/sangfor/EasyConnect` 与 `/tmp/build-scripts`，写入上述精简脚本和统一登录网页，并通过多阶段 `FROM scratch` 合并干净根文件系统（设置 `PATH`、`PING_ADDR=10.130.10.75`、`PING_ADDR_URL=http://10.130.10.75/`、`PING_INTERVAL=60`、`EXPOSE 1080 8888 58081`）。
3. 新增 `deploy/hziee/test_atrust_runtime.cjs` 并接入 `.github/workflows/build-image.yml`，在 `test` 与 `atrust-image` 冒烟阶段校验每分钟保活脚本、无头 `Xvfb` 启动、`ldd` 共享库完整性和无关组件彻底移除。
4. 同步更新 `deploy/hziee/README.md`，保留仓库内独立的 Go 客户端源码不作未授权删除。

## 统一登录页免令牌直连与自动关闭（2026-11-24）

1. 移除 `deploy/hziee/atrust_qr.cjs`、`deploy/hziee/atrust_qr.html` 与 `Dockerfile.atrust` 中的访问令牌生成、校验与页内输入区，保留 `Host` 白名单、同源 `Origin` 校验与验证码单次 `challenge` 校验。
2. 在 `deploy/hziee/atrust_qr.cjs` 增加自动关闭生命周期：客户端进入 `online`/`login`（密码登录成功、`/status` 检测到已登录或后台状态轮询检测到已登录）后自动关闭 HTTP 服务并释放端口；未登录时默认 10 分钟超时自动关闭。
3. 在 `deploy/hziee/atrust_qr.html` 处理服务端自动关闭状态，登录完成后停止轮询、禁用操作按钮并提示服务已自动关闭。
4. 更新 `deploy/hziee/test_atrust_qr.cjs` 覆盖免令牌访问、`Host`/`Origin` 校验、密码登录后自动关闭、后台扫码上线自动关闭、超时自动关闭和前端脚本检查，并同步更新 `deploy/hziee/README.md`。

## 高位端口统一登录网页：密码验证码与服务端钉钉扫码（2026-11-24）

1. 扩展官方 aTrust 客户端内嵌网页服务 `deploy/hziee/atrust_qr.cjs` 与 `deploy/hziee/atrust_qr.html`，在同一网页提供“密码登录（服务端抓取官方会话验证码 + 点选坐标提交官方密码模块）”与“钉钉扫码登录（服务端官方客户端提取二维码并映射到网页）”两种模式。
2. 新增 `Dockerfile.atrust`、`deploy/hziee/compose.atrust.yaml` 与 `.github/workflows/build-image.yml` 的 `atrust-image` 构建任务，将统一登录网页与策略路由端口放行（`FORCE_OPEN_PORTS="54631 ${ATRUST_WEB_PORT:-58081}"`）打包为镜像并发布至 GHCR（`:atrust-latest` / `:atrust-sha-<sha>`）。
3. 同步为 Go 无图形客户端的 `deploy/hziee/captcha_web.py` 增加 `--host` 参数，使其在需要时也能通过高位端口对外开放验证码页面，默认仍保持 `127.0.0.1:18081` 兼容。
4. 在 Shanghai-Aliyun 部署 GitHub Actions 编译产出的镜像，针对实测暴露的英文/中文标签匹配（`钉钉扫码`）、窗口刷新竞态以及点击钉钉后 `history.pushState` 改写窗口 URL 导致切回密码表单失败的问题逐一修复并补测。
5. 完成 Shanghai-Aliyun 双向模式切换与高位端口鉴权实测，并记录构建与验证结论。

## 官方客户端验证码点选（2026-11-23）

1. 用户要求代理点选验证码；沿用官方客户端内的验证码地址生成方法及当前浏览器会话读取图片，不另起独立 Go 登录。
2. 在受限的一次性操作中获取真实图片并读取提示，按原图坐标准备点选结果，再调用官方密码认证模块提交。
3. 检查认证结果和官方状态；成功后实际验证 HTTP/SOCKS5 校内访问及分钟保活。
4. 恢复原客户端入口，删除远程、本机临时凭据及一次性运行模块，保存脱敏结果。

实际结果：官方会话取得真实图片，点选在出图约 24 秒后提交，官方模块返回 code=0、Succeeded，客户端 online。两种代理实际返回 HTTP 200，校内路由经过 utun7。原入口已恢复，临时凭据和运行模块已清理，当前会话保持运行；分钟复测结果见验证记录。

## Shanghai-Aliyun 密码登录试验（2026-11-23）

1. 读取本地已保存的 TOML，仅检查账号密码是否存在及学校登录域；凭据不进入终端命令或公开记录。
2. 继续使用已部署的官方 aTrust 客户端，检查其页面中的官方密码认证 SDK；保留现有入口作为恢复点。
3. 通过 SFTP 将私密凭据与一次性操作文件传入本次目标，由官方 SDK 完成密码认证。遇到验证码或额外认证时保留真实状态并交由本人处理。
4. 核对官方登录状态、真实 HTTP/SOCKS5 校内请求及分钟保活；移除一次性登录入口和凭据副本，保留原配置、客户端数据与运行记录。

首次密码试验返回 code=75500000、graphCheckCodeEnable=1。用户随后要求代理处理验证码，现已完成官方登录及校内代理验证，见上节。

## Shanghai-Aliyun 试部署（2026-11-23）

1. 以用户截图指定的 Shanghai-Aliyun 为目标，检查系统、Docker、端口及学校节点连通性；不沿用 HK-AK 为目标。
2. 复用官方 aTrust 及现有二维码组件，在独立目录部署，代理和二维码网页只绑定回环地址，保留现有服务。
3. 检查容器、组件、网页及本地转发；本人扫码后验证官方登录、校内代理请求及分钟保活。
4. 保存脱敏运行记录，按实际验证结果提交并普通推送。

当前结果：服务器端组件已运行，用户随后改为账号密码及验证码登录，现已 online，两种校内代理均 HTTP 200。本机新转发仍未完成；未修改香港部署。

## 复用原官方部署并提供网页链接（2026-11-21 23:04）

1. 核对最早官方容器的镜像、运行状态及现有二维码组件，复用原配置和数据。
2. 恢复 Termius 的 28081 本地转发，在终端输出带当前令牌的网页链接。
3. 验证网页实际取得 VPS 客户端二维码；保留页面供本人扫码，记录当前状态和未验证范围。

## 官方 aTrust 二维码网页（2026-11-21）

1. 用户纠正客户端选择：复用 HK-AK 的官方 aTrust 容器，网页只显示该客户端二维码；认证及隧道由官方客户端维护，不使用 VNC。
2. 只读检查官方客户端运行状态、现有本地接口及二维码来源；优先复用客户端能力，保留已有会话。
3. 按真实接口实现必要的二维码展示与状态传递，先加入可复现问题的检查；网页继续仅通过回环高位端口和 SSH 转发访问。
4. 停用此前独立 Go 扫码部署的登录入口，验证网页展示的二维码属于官方客户端，用户扫码后检查客户端登录、代理和保活；脱敏记录并提交推送。

## 修复扫码后网页无反应（2026-11-21）

1. 读取用户实际网页及 HK-AK 日志，核对钉钉官方扫码页源码和消息投递目标，确认问题所在。
2. 使用学校提供的临时授权码流程：钉钉二维码将临时码发送给本机网页，服务器向钉钉兑换学校回调，继续复用原认证会话；严格验证消息来源、临时码、重定向域名与 state。
3. 先复现跨域消息目标问题并增加回归检查，再修改网页与必要服务端交接；保留错误提示，避免倒计时覆盖失败结果。
4. 运行相关及全量检查、发布修复镜像、更新 HK-AK 扫码容器；保留原服务，交回用户扫码并核对实际认证结果。

学校票据解析阶段：共享 HTTPS 来源校验按主机名与有效端口判断，接受显式和省略 443 的等价地址，保留不同来源及路径拒绝。失败日志仅记录协议、主机、路径、是否有 data 和校验原因，不输出查询值或票据。

## 独立钉钉扫码网页（2026-11-21）

1. 用户明确要求不使用 VNC，将二维码提供到高位端口网页；选用已确认空闲的 28081，保留现有部署和会话作为恢复点。
2. 核对学校公开的 `auth/dingtalk` 接口与官方前端实际请求；复用当前客户端认证、会话、代理与保活能力，仅增加必要的扫码网页和部署配置。
3. 先添加能够暴露缺失行为的检查，再实现并验证取码、过期刷新、扫码状态、访问控制与认证结果交接；不以展示二维码代替登录成功。
4. 部署到 HK-AK，核对网页、客户端与真实请求结果，记录未完成条件；脱敏后提交并普通推送。

## HK-AK 钉钉扫码重试（2026-11-21）

1. 复用现有 aTrust 图形容器和 noVNC 本地转发，检查学校钉钉登录状态；已有有效登录时保留会话。
2. 检查客户端状态、隧道与实际校内 HTTP/SOCKS5 访问；保留现有密码登录配置和数据。
3. 记录真实结果及尚未完成的验证，提交推送脱敏文档。

## 从 ZJU-Connect 源码构建学校镜像（2026-11-20）

1. 克隆 ZJU-Connect v1.3.1，固定源提交 `5d7f5b11fcf231f72a0ec0d888bf0f2eadcce1da`；将完整 Go 源码、依赖锁定文件、原有测试和许可证纳入当前仓库。
2. 先增加学校默认配置测试并确认失败，再将默认协议、入口、密码认证域、HTTP 端口及保活地址改为学校配置；保留协议内部依赖，避免删坏编译链。
3. 增加从本地 Go 源码编译的多阶段 Dockerfile、排除凭据的构建上下文、GitHub Actions 测试与 GHCR 多架构镜像发布。
4. 学校 Compose 使用本仓库编译发布的镜像；验证码 Python/HTML、真实凭据与会话保持原样。更新源码来源、许可证和部署说明。
5. 本地执行 Go 测试、原生与 Linux amd64/arm64 编译、Python 测试和 Compose 检查；推送后跟踪 GitHub 实际编译、发布结果并验证镜像。
6. 更新日志，提交并普通推送，补记实际哈希。

用户明确要求从源码编译镜像部署；成品镜像不能替代源码交付。镜像已发布。

## 部署到 HK-AK（2026-11-20）

1. 用户已确认 hi-Al 指 HK-AK。通过 Termius 确认系统、现有容器、目录和端口；保留旧容器、配置和会话作为恢复点。
2. 上传本仓库 Compose、验证码 Python/HTML 和用户本地配置，配置权限保持 600，不输出或提交凭据。
3. 拉取用户 GHCR 镜像，校验 Compose，启动密码登录；需要验证码时由用户在网页完成。
4. 验证镜像版本、容器状态、HTTP/SOCKS5 校内请求和至少一次 60 秒保活，再记录实际结果并提交推送文档。

## 官方 ZJU-Connect 对照登录（2026-11-20）

1. 用户明确指定 HK-AK；拉取官方 `mythologyli/zju-connect:1.3.1`，检查版本和启动参数。
2. 保留自建镜像、配置及数据，使用同一只读学校配置与独立测试会话目录，启动官方客户端和现有验证码网页。
3. 测试使用独立回环端口 11081/18889，保留旧容器运行；用户提交验证码后核对完整认证及节点连接结果，成功则验证两种代理和保活，失败则保留日志并核对原服务状态。
