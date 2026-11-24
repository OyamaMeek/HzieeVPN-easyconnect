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

- **Git 提交**：`bb3dfe26f2c03054b7093bf8e19e3dec4048d19c feat: add private HZIEE aTrust deployment`，采用历史脱敏后的提交哈希。

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

- **Git 提交**：`cc2526418a57351062cfcd766281270c73a6f773 feat: add headless HZIEE login and minute HTTP keepalive`，采用历史脱敏后的提交哈希。

---

## [2026-11-20 13:37] 本地真实账号登录与分钟保活验证

- **需求/问题描述**：
  > 使用用户在本地填写的账号密码测试登录；用户已允许查看学校验证码并继续测试。

- **实际实现的功能与改动**：
  - 安全解析实际配置，检查学校入口和必填字段，将真实配置权限收紧为 600；账号密码、会话数据均不入库。
  - 使用本机原生 ZJU-Connect 1.3.1，完成学校点选验证码，学校密码认证返回 code=0，客户端启动。
  - HTTP 8888、SOCKS5 1080 仅监听 127.0.0.1；通过两者访问目标地址均 HTTP 200、7624 字节，curl 退出 0。
  - 重启读取已保存会话，日志 Already logged in，没有再次要求验证码。
  - 自动保活于 13:35:35、13:36:35 均 HTTP 200，断言确认间隔 60 秒。
  - 正常结束测试进程并确认端口释放，删除含认证详情的临时调试日志；保存脱敏验证记录和正确的终端验证码输入格式。
  - 本机无 Docker 引擎，未执行容器启动和服务器切换；未验证长期稳定性及业务系统内具体功能。

- **涉及文件**：
  - `deploy/hziee/README.md`
  - `memory/agents.md`、`memory/plan.md`、`memory/progress.md`、`memory/verify.md`、`memory/gotchas.md`
  - `docs/CHANGELOG.md`
  - `deploy/hziee/headless.toml` 仅调整本地权限，保持 Git 忽略。

- **Git 提交**：`61472252148c65a5271d9b8b295853f7698b9c2e docs: record successful headless VPN runtime tests`，采用历史脱敏后的提交哈希。

---

## [2026-11-20 14:37] 项目与 GitHub 仓库改名

- **需求/问题描述**：
  > 将项目名称改为 HzieeVPN-easyconnect，同时修改 GitHub 仓库名称。

- **实际实现的功能与改动**：
  - 更新 README 标题、开发文档中的项目名称和四处构建示例的 clone、cd 命令。
  - GitHub 仓库改为 `OyamaMeek/HzieeVPN-easyconnect`；API 已核对改名前后仓库 ID 均为 1464974211。
  - 保留上游镜像、历史来源链接、Compose 项目名、部署数据与本地工作目录。
  - origin 已更新；项目名称、四处 clone/cd 示例、origin 与仅文档变更断言通过，`git diff --check` 和新地址 `git ls-remote` 成功。
  - 仅涉及名称与文档，未重新运行 VPN 或 Docker 容器。

- **涉及文件**：
  - `README.md`、`doc/development.md`、`doc/build.md`
  - `memory/agents.md`、`memory/plan.md`、`memory/progress.md`、`memory/verify.md`
  - `docs/CHANGELOG.md`

- **Git 提交**：`c3d3434aa3d3d37907e4a1dc409bd35355cfc2ec docs: rename project to HzieeVPN-easyconnect`，采用历史脱敏后的提交哈希。

---

## [2026-11-20 14:44] 精简为学校专用启动配置

- **需求/问题描述**：
  > 去掉与学校无关的启动方式，使项目更精简。

- **实际实现的功能与改动**：
  - 保留学校 aTrust 账号密码、钉钉扫码两套配置和原有持久化路径、代理端口、HTTP 保活。
  - 删除 76 个通用启动、镜像构建与配套文件，包括 EasyConnect CLI、X11 示例、多版本多架构参数、构建源码及自动构建工作流。
  - 首页改为学校专用说明，部署文档补充图形版首次启动步骤，精简重复验证日志；保留许可证与来源说明。
  - 4 项配置与范围检查先确认目标失败，清理后全部通过；两份 Compose 的完整解析 JSON、三份配置的 SHA-256 与清理前一致，`git diff --check` 通过。
  - 未修改真实凭据、会话数据或服务器；本机没有 Docker 引擎，未重新运行容器或学校登录。

- **涉及文件**：
  - `README.md`、`deploy/hziee/README.md`
  - 删除 `.github/` 中构建与版本检查工作流、`Dockerfile*`、`build-args/`、`build-scripts/`、`docker-root/`、`docker-root-preinst/`、`fake-getlogin/`、`fake-hwaddr/`、`doc/`、`docker-compose.yml`、`macos_example.sh`、`pkg_version.xml`。
  - `memory/agents.md`、`memory/plan.md`、`memory/progress.md`、`memory/verify.md`
  - `docs/CHANGELOG.md`

- **Git 提交**：`5bc47f9f05878a19ec2b308b6160253900aa7bc9 refactor: retain only HZIEE VPN deployment paths`，采用历史脱敏后的提交哈希。

---

## [2026-11-20 15:20] 增加验证码点选网页

- **需求/问题描述**：
  > 为账号密码登录提供一个网页，由用户点击验证码后继续登录。

- **实际实现的功能与改动**：
  - 增加 Python 标准库登录脚本，默认启动现有 Compose 前台登录容器；网页点选自动向客户端 stdin 提交完整 JSON。
  - 网页支持顺序点选、缩放坐标换算、撤销、清空、键盘选择和重试换图；仅监听 127.0.0.1:18081，随机令牌限制访问，拒绝过期或重复提交。
  - 更新首页和部署说明，提供首次登录入口及 Termius/SSH 同端口转发步骤；保留现有 Compose、凭据、会话和后台服务方式。
  - 测试先因缺少模块失败；实现后 10 项 HTTP/真实子进程管道测试通过。浏览器行为、HTML JavaScript 语法、Compose 配置与 diff 检查通过；Ctrl+C/SIGTERM 清理已验证。
  - 用户通过网页点选完成真实 ZJU-Connect 登录，15:17:26 自动换图重试、15:17:36 客户端启动；HTTP/SOCKS5 访问校内目标均 HTTP 200、7624 字节。网页与代理仅监听 127.0.0.1，会话权限 600；当前连接保持运行。未运行 Docker 容器、切换服务器或截图。

- **涉及文件**：
  - `deploy/hziee/captcha_web.py`、`deploy/hziee/captcha.html`、`deploy/hziee/test_captcha_web.py`
  - `README.md`、`deploy/hziee/README.md`
  - `memory/agents.md`、`memory/plan.md`、`memory/progress.md`、`memory/verify.md`
  - `docs/CHANGELOG.md`

- **Git 提交**：`1a3be05fe33570f24dd42ab8bc3e12ca0c4c6ac9 feat: add browser captcha login for HZIEE`，采用历史脱敏后的提交哈希。

---

## [2026-11-20 15:39] 清除公开历史中的私有服务器 IP

- **需求/问题描述**：
  > 清除 GitHub 历史中的真实 VPS IP，用户明确授权本次重写历史和强制更新远端。

- **实际实现的功能与改动**：
  - 将受影响的 12 个提交中的真实地址替换为示例域名；保留更早上游历史、签名、所有部署功能与配置。
  - 当前 SSH 示例明确说明地址占位符，代理记录不保存真实 VPS 地址；更新当前开发记录中的提交哈希。
  - 本地完整恢复备份校验通过，权限 600，存放于被忽略的工作目录；没有上传备份或替换规则。
  - 原地址检查清理前失败、清理后通过；完整 master 历史与当前跟踪文件无原地址，代码与配置对比无差异。
  - 使用绑定预期旧哈希的 --force-with-lease 更新 origin/master 成功；从 GitHub 新克隆的完整分支历史检查通过。
  - 旧提交原始文件链接实测仍返回 HTTP 200 且含原地址；GitHub 旧对象缓存尚未清理，申请稿保存在已忽略的本地工作目录，未向外发送。
  - 本次未运行 Docker 容器或修改服务器；新用户首次部署全过程尚未验证，已有克隆与 GitHub 旧对象缓存不在本地清理控制范围内。

- **涉及文件**：
  - `deploy/hziee/README.md`
  - `memory/agents.md`、`memory/plan.md`、`memory/progress.md`、`memory/verify.md`、`memory/gotchas.md`
  - `docs/CHANGELOG.md`

- **Git 提交**：`713a61d73613e3cf81c66b35d435be62cf8a69e8 fix: redact private VPS address from public history`，已按用户授权更新 origin/master；本记录通过后续文档提交补记。

---

## [2026-11-20 17:39] 恢复完整镜像构建源码

- **需求/问题描述**：
  > 把原本的源文件恢复回来，需要能够编译的版本。

- **实际实现的功能与改动**：
  - 从删除前的 `e198c26` 恢复 76 个文件，包括四份 Dockerfile、构建脚本与多架构参数、容器源码、两个 C 辅助库、工作流、通用示例和文档；恢复执行权限及三个符号链接。
  - 首页补充 Linux amd64 aTrust 的两阶段构建命令；新增 `.dockerignore`，排除真实凭据、会话、Git 历史与本地工具。
  - 保留源文件内容，仅清理旧行尾空白、末尾空行并补齐一个 C 文件的末尾换行。
  - 恢复前完整性检查因 76 个文件缺失失败，恢复后完整性和 COPY 依赖检查通过。原 Makefile 编译两个 C 库的 Linux amd64、arm64 版本成功，四个产物确认为 ELF 共享库。
  - 22 个 Shell 语法、10 项现有 Python 测试、三份 Compose 与三个工作流 YAML 解析通过；学校两份 Compose 完整 JSON 与原基线一致。
  - 本机没有 Docker 引擎，未执行完整镜像构建、容器启动或服务器变更。真实学校配置及会话未修改；编译工具、检查脚本与产物保存在已忽略目录。

- **涉及文件**：
  - `.github/`、`Dockerfile*`、`build-args/`、`build-scripts/`、`docker-root/`、`docker-root-preinst/`、`fake-getlogin/`、`fake-hwaddr/`。
  - `doc/`、`docker-compose.yml`、`macos_example.sh`、`pkg_version.xml`。
  - `.dockerignore`、`README.md`、`memory/agents.md`、`memory/plan.md`、`memory/progress.md`、`memory/verify.md`、`memory/gotchas.md`、`docs/CHANGELOG.md`。

- **Git 提交**：`c9f4984847ee8321c62ad1d8cd1a648c55d0ff71 fix: restore complete Docker image build sources`，已普通推送至 origin/master；本记录通过后续文档提交补记。

---

## [2026-11-20 18:05] 仅保留信工 VPN 密码登录与验证码网页

- **需求/问题描述**：
  > 只保留账号密码登录信工 VPN 的部分和验证码网页，删除其他无关组件。

- **实际实现的功能与改动**：
  - 保留学校密码登录 Compose、TOML 示例、验证码 Python/HTML 与原有测试；代码、配置、本地凭据和会话均保持原样。
  - 删除 78 个无关文件：扫码 Compose、通用 EasyConnect、四份 Dockerfile、构建参数与脚本、容器启动文件、C 辅助库、GitHub 工作流、通用示例与文档、失去用途的 `.dockerignore`。
  - 首页与部署说明仅描述密码登录、验证码、SSH 转发、代理和运维；精简当前 memory，保留许可证与历史开发记录，增加系统文件和 Python 缓存忽略规则。
  - 精简检查清理前 4 项中 2 项失败，清理后 4 项全部通过；保留文件与本地配置 SHA-256、Compose 完整 JSON 与基线一致。10 项 HTTP/真实子进程管道测试、Compose 配置、JavaScript 语法和 diff 检查全部通过。
  - 本机缺少 Docker 引擎，未验证容器启动或重新登录；未操作服务器、执行视觉检查或删除本地备份。恢复点为 `b789008`。

- **涉及文件**：
  - 删除 `.github/`、`Dockerfile*`、`build-args/`、`build-scripts/`、`docker-root/`、`docker-root-preinst/`、`fake-getlogin/`、`fake-hwaddr/`、`doc/`。
  - 删除 `.dockerignore`、`docker-compose.yml`、`macos_example.sh`、`pkg_version.xml`、`deploy/hziee/compose.yaml`。
  - 更新 `README.md`、`deploy/hziee/README.md`、`.gitignore`、`memory/` 五份记录、`docs/CHANGELOG.md`。

- **Git 提交**：`92721a55a4474ebc171e7eea11df5d33ecfa35af refactor: retain only HZIEE password login and captcha web`，已普通推送至 origin/master；本记录通过后续文档提交补记。

---

## [2026-11-20 18:38] 克隆客户端源码并构建学校镜像

- **需求/问题描述**：
  > 保留账号密码登录相关的可编译源码；克隆 ZJU-Connect，改为学校地址，通过 GitHub 编译镜像用于部署。

- **实际实现的功能与改动**：
  - 克隆 ZJU-Connect v1.3.1 的 `5d7f5b11fcf231f72a0ec0d888bf0f2eadcce1da`，导入 132 个 Go 源码、依赖锁定文件、测试和许可证；保留完整协议依赖结构。
  - 默认配置改为 aTrust、vpn.hziee.edu.cn:443、auth/psw、ShenLan、HTTP 8888 和学校保活地址；学校默认测试先因旧协议失败，修改后通过。
  - Dockerfile 从本仓库执行 go build，GitHub Actions 测试后构建 Linux amd64/arm64 并发布 GHCR，使用 latest 与完整提交哈希标签；学校 Compose 改用本仓库镜像。
  - 补充源码来源、AGPL-3.0 许可证和编译部署说明，Docker 上下文排除本地密码、会话与工具。
  - Go 全包测试和 vet、macOS arm64 及 Linux amd64/arm64 编译均通过；10 项验证码测试、Compose、JavaScript、YAML 和 diff 检查通过。
  - 导入完整性检查通过；仅默认配置和两个测试区别于上游。验证码代码、本地凭据与会话校验未改变，Compose 完整 JSON 仅改变镜像引用。
  - GitHub Actions `44721199266` 的 test/image 均成功，实际完成两种架构的编译发布与容器启动检查；容器版本输出对应源码提交 `6f871ae`。
  - GHCR 匿名清单请求成功，确认 Linux amd64/arm64；镜像摘要为 `sha256:b8ee8094ec3dc2c0e759ccd4249d09605ddb8768a8650d365807e4ceefc34b59`。没有修改包可见性，本次未操作服务器或重新登录 VPN。

- **涉及文件**：
  - `main.go`、`init.go`、`init_test.go`、`go.mod`、`go.sum`、`LICENSE`，以及 `client/`、`configs/`、`dial/`、`internal/`、`log/`、`mobile/`、`resolve/`、`service/`、`stack/`、`underlay/`。
  - `Dockerfile`、`.dockerignore`、`.github/workflows/build-image.yml`、`.gitignore`、`SOURCE.md`。
  - `deploy/hziee/compose.headless.yaml`、首页与部署说明、`memory/` 五份记录和本日志。

- **Git 提交**：`6f871aeadffefd2367c34d46f7dcfdc313dbfb99 feat: build HZIEE VPN image from cloned client sources`，已普通推送至 origin/master；本记录通过后续文档提交补记。

---

## [2026-11-20 19:20] 在指定服务器部署用户镜像并检查网络阻碍

- **需求/问题描述**：
  > 使用用户自己的镜像和配置部署到指定服务器；用户确认目标为 Termius 中的 HK-AK。

- **实际实现的功能与改动**：
  - 通过 Termius SFTP 上传 Compose、验证码 Python/HTML 和真实配置到独立目录 `/opt/hziee-headless`；三个公开文件 SHA-256 与本地一致，私密配置也校验一致且权限为 600，凭据未输出或提交。
  - 实际拉取 GHCR 镜像，摘要与此前发布结果一致；容器版本对应源码提交 `6f871ae`，服务器 Compose config 退出 0。本地 10 项验证码测试与 Compose 校验通过。
  - 保留旧容器、配置和数据，备份旧 Compose，停止旧容器后启动验证码登录；所有代理及网页端口仅绑定回环地址，用户通过 SSH 本地转发完成验证码提交。
  - 客户端随后报 `no reachable node for ip request` 并退出。服务器到两台学校节点的 10441 TCP/TLS 检查均超时，退出 124；本机对相同节点可以完成 TLS 1.3 握手。没有修改防火墙、路由或客户端源码。
  - 已重新启动旧容器并确认 Up；旧代理校内 HTTP 请求同样超时，curl 退出 28。新服务未切换后台运行，HTTP/SOCKS5 和 60 秒保活验证未完成；需要先恢复指定服务器到学校 VPN 节点的连通性。

- **涉及文件**：
  - `deploy/hziee/README.md`、`memory/agents.md`、`memory/plan.md`、`memory/progress.md`、`memory/verify.md`、`memory/gotchas.md`、`docs/CHANGELOG.md`。
  - 远程部署文件位于 `/opt/hziee-headless`，私密配置和登录日志仅保留在服务器，未纳入 Git。

- **Git 提交**：`5dc23e8 docs: record HK-AK deployment checks and node connectivity blocker`，已普通推送至 origin/master；本记录通过后续文档提交补记。服务启用仍受节点网络连通性阻碍。

---

## [2026-11-20 19:23] 重试服务器到学校节点的连接

- **需求/问题描述**：
  > 重试指定服务器上的 VPN 部署。

- **实际实现的功能与改动**：
  - 通过现有 Termius 会话重试两台学校节点的 10441 TCP 连接，各等待 5 秒，均超时并退出 124。
  - 确认旧容器仍为 Up，用户镜像和配置保留在独立目录，尚无新登录会话。节点网络仍不可达，未再次触发验证码登录或切换服务；未修改代码、配置、防火墙或路由。
  - 本次仅执行连接和状态检查，未重复运行代码测试。

- **涉及文件**：
  - `memory/progress.md`、`docs/CHANGELOG.md`。

- **Git 提交**：`75e58e3 docs: record repeated HK-AK node connection timeouts`，已普通推送至 origin/master；本记录通过后续文档提交补记。

---

## [2026-11-20 19:35] 在英国服务器对照检查学校节点

- **需求/问题描述**：
  > 在截图指定的 UK-Happa-GreenCloud 上测试学校节点连通性。

- **实际实现的功能与改动**：
  - 通过 Termius 已登录会话检查两台学校节点的 10441 TCP 与 TLS 连接，每项等待 8 秒，四项均超时，退出 124。
  - 使用 curl 直接访问学校认证入口 HTTPS，返回 HTTP 302，耗时 1.918342 秒，退出 0。
  - 英国和香港 VPS 均存在数据节点连接失败，仍不能确认具体过滤或路由原因。未上传凭据、安装程序、执行 VPN 登录或更改服务器设置；未重复运行代码测试。

- **涉及文件**：
  - `memory/progress.md`、`docs/CHANGELOG.md`。

- **Git 提交**：`c47003b docs: record UK server VPN node connectivity checks`，已普通推送至 origin/master；本记录通过后续文档提交补记。

---

## [2026-11-20 21:56] 在香港服务器使用官方 ZJU-Connect 重试登录

- **需求/问题描述**：
  > 改用官方 ZJU-Connect 再连接一次，用户明确指定 HK-AK。

- **实际实现的功能与改动**：
  - 实际拉取 `mythologyli/zju-connect:1.3.1`，摘要为 `sha256:6e14b16b979fd76a205b8da97d937574fedcd72f9dc2c99a435644778f1d6ed8`；容器 `-version` 输出 `ZJU Connect v1.3.1`，退出 0。
  - 只读挂载现有学校配置，以独立目录保存测试数据，通过现有验证码网页启动官方客户端。测试 SOCKS5/HTTP 使用回环端口 11081/18889，旧容器保持运行；日志权限 600，数据目录权限 700。
  - 用户提交验证码后，日志于本地时间 21:52:01 获取并解析学校 clientResource，21:52:08 报 `no reachable node for ip request` 并退出；未建立 VPN 隧道、未保存会话，与此前自建镜像失败阶段相同。
  - 最终确认官方一次性容器退出，测试代理与网页端口释放，旧容器仍为 Up 3 hours。没有修改客户端代码、原配置、Compose、路由或防火墙；未建立隧道，因此未执行代理与分钟保活验证，未重复运行代码测试。

- **涉及文件**：
  - `memory/plan.md`、`memory/verify.md`、`memory/progress.md`、`memory/gotchas.md`、`docs/CHANGELOG.md`。
  - 远程私密日志为 `/opt/hziee-headless/upstream-login.log`，测试数据位于同目录的 `upstream-test-data/`，未纳入 Git。

- **Git 提交**：`57934be docs: record official ZJU-Connect login failure on HK`，已普通推送至 origin/master；本记录通过后续文档提交补记。

---

## [2026-11-21 12:40] 再次检查香港服务器的学校连接

- **需求/问题描述**：
  > 再测一下现有 VPN 连接条件。

- **实际实现的功能与改动**：
  - 通过 Termius 在 HK-AK 重试两台学校数据节点的 10441 TCP 连接，每台等待 10 秒，均超时并退出 124。
  - 学校认证入口 HTTPS 返回 302，耗时 0.839961 秒，curl 退出 0；旧容器保持 Up 17 hours。
  - 数据节点连接未恢复，未重新触发验证码登录，未修改代码、配置或服务器设置；本次仅执行网络与容器状态检查。

- **涉及文件**：
  - `memory/progress.md`、`docs/CHANGELOG.md`。

- **Git 提交**：`f9ff1d0 docs: record next-day HK VPN connectivity retest`，已普通推送至 origin/master；本记录通过后续文档提交补记。

---

## [2026-11-21 12:59] 核实香港服务器的钉钉登录与校内访问

- **需求/问题描述**：
  > 使用钉钉扫码登录测试；用户反馈远程桌面好像正常。

- **实际实现的功能与改动**：
  - 远程桌面恢复连接，官方图形客户端显示已登录工作台。保留已有登录，本轮未重新扫码。
  - HTTP 与 SOCKS5 代理请求校内测试地址均为空响应，curl 退出 52；绕过代理直接请求同一地址，连接被重置，退出 56。记录不含本轮具体内部地址或认证详情。
  - 尚未确认校内访问恢复，未执行成功连接后的分钟保活；本次未修改代码，因此未重复运行代码测试。
  - 原 VNC 密码未输出或重置；为读取密码创建的本地和远程私密副本已清理，保留原配置与登录会话。工作台页面已交回用户。

- **涉及文件**：
  - `memory/plan.md`、`memory/verify.md`、`memory/progress.md`、`docs/CHANGELOG.md`。

- **Git 提交**：`9bce64a docs: record DingTalk login and HK tunnel verification`，已普通推送至 origin/master；本记录通过后续文档提交补记。

---

## [2026-11-21 14:05] 独立钉钉扫码网页

- **需求/问题描述**：
  > 不使用 VNC，将钉钉二维码提供到网页，并选择一个高位端口。

- **实际实现的功能与改动**：
  - 在现有 Go 客户端增加学校 `auth/dingtalk` 新版扫码认证，网页默认使用 28081，复用原认证会话、VPN、代理与保活流程。
  - 网页直接内嵌钉钉二维码，提供过期提示和刷新；校验访问令牌、Host、Origin、扫码来源窗口、回调地址与会话 state，拒绝跨会话及过期提交。扫码认证完成后关闭临时网页，不将扫码通过标记为隧道已连接。
  - 增加独立 Compose 和公开配置，网页与代理端口仅映射回环地址；使用独立、被忽略的会话目录。保留原账号密码和服务器部署。
  - 新登录类型测试先确认旧代码报不支持认证；新增请求边界测试发现并修正缺少结果代码、尾随 JSON 的校验缺口。补测后 Go 全部测试与 Go vet 通过；10 项验证码 Python 测试、原生/Linux amd64/arm64 编译、JavaScript 语法及两份 Compose 校验通过。
  - 本机真实获取学校扫码配置，浏览器加载钉钉二维码 iframe 和 canvas，刷新返回新的 60 秒有效期；未替用户扫码、未执行截图或声明隧道连接成功。
  - [GitHub Actions 44874060686](https://github.com/OyamaMeek/HzieeVPN-easyconnect/actions/runs/44874060686) 的 test/image 均成功。HK-AK 实际拉取并运行新镜像，版本为源码提交 `0727867`，摘要 `sha256:903be76106df0bcf0ab2ffd352920b213a3155cd3437c15c7d7620b3a8198da0`。
  - 部署目录 `/opt/hziee-dingtalk`，两份配置校验和与本地一致，目录及数据权限 700、配置权限 600。新容器 running、重启 0，仅映射回环 28081/11081/18889；原容器保持 running、重启 0，配置与会话保留。
  - Termius `HZIEE DingTalk` 转发已保存并连接，远程和本机网页 HTTP 200、鉴权配置 HTTP 200，浏览器实际从服务器加载并刷新钉钉二维码 iframe。等待用户本人扫码，学校回调、隧道和代理与保活尚未验证；完整令牌不写入公开记录。

- **涉及文件**：
  - `client/atrust/auth/dingtalk.go`、`dingtalk.html`、`dingtalk_test.go`、`login_method.go`、`login_method_test.go`、`request.go`。
  - `configs/config.go`、`main.go`、`init.go`、`deploy/hziee/compose.dingtalk.yaml`、`deploy/hziee/dingtalk.toml`。
  - `.github/workflows/build-image.yml`、`.gitignore`、`.dockerignore`、`README.md`、`deploy/hziee/README.md`、`memory/plan.md`、`memory/progress.md`、`memory/verify.md`、`memory/gotchas.md`。
  - `memory/agents.md`；远程新增独立 `/opt/hziee-dingtalk` 部署，不含账号密码。

- **Git 提交**：`072786709e346ce5f629a04c9cd663ab8c37b7f5 feat: add headless DingTalk QR login page`，已普通推送至 origin/master；部署结果与本记录通过后续文档提交保存。

---

## [2026-11-21 14:29] 修复钉钉扫码结果无法到达本机网页

- **需求/问题描述**：
  > 用户扫码登录后网页没有反应。

- **实际实现的功能与改动**：
  - 实际网页显示二维码过期，服务器只有刷新请求、没有继续认证。核对钉钉官方脚本，确认新版成功消息 targetOrigin 为学校回调域名，无法投递给 localhost 父页面。
  - 使用学校配置提供的 `qrcode.htm` 临时授权码流程，消息只接受来自当前钉钉窗口的有效字符串；由服务器向钉钉兑换学校回调，继续核对 HTTPS 域名、路径、登录域及 state，再复用学校认证。
  - 提交错误后保留错误消息，刷新时清除旧二维码窗口；访问链接令牌改变时重新加载页面。增加不含授权码和 Cookie 的认证阶段日志。
  - 回归测试先确认旧 iframe 与回调不符合临时码协议；Go 全部测试、Go vet、消息边界检查、10 项 Python 测试、Compose 校验和 Linux amd64/arm64 编译通过。本机实际从学校配置加载临时码二维码。
  - [GitHub Actions 44875918557](https://github.com/OyamaMeek/HzieeVPN-easyconnect/actions/runs/44875918557) 的 test/image 均成功；HK-AK 实际更新扫码容器，版本输出对应源码 `3763bb8`，扫码和原容器均 running、重启 0，网页与消息模块 HTTP 200。
  - 用户实际应用内浏览器已换入修复版链接并显示临时码二维码图片，已请求用户再次扫码。学校认证票据、隧道、代理与保活仍待真实扫码后验证，未以测试输入代替认证成功。

- **涉及文件**：
  - `client/atrust/auth/dingtalk.go`、`dingtalk.html`、`dingtalk_message.mjs`、`dingtalk_test.go`、`deploy/hziee/test_dingtalk_message.mjs`。
  - `.github/workflows/build-image.yml`、`deploy/hziee/README.md`、`memory/agents.md`、`memory/plan.md`、`memory/progress.md`、`memory/verify.md`、`memory/gotchas.md`。

- **Git 提交**：`3763bb8dcb7e98cff1985683afa9d6cf0aa21b9d fix: relay DingTalk temporary codes from localhost`，已普通推送至 origin/master；部署记录通过后续文档提交保存。

---

## [2026-11-21 14:43] 修正学校认证跳转的 HTTPS 来源校验

- **需求/问题描述**：
  > 用户再次扫码后看到“学校认证跳转无效”。

- **实际实现的功能与改动**：
  - 实际日志确认两次收到临时码，完成钉钉兑换，随后学校返回 302，客户端在票据跳转解析阶段拒绝；未确认隧道连接成功。
  - 回归测试先确认共享解析器会错误拒绝显式和省略 443 的相同 HTTPS 来源。复用标准 URL 解析与有效端口比较，保留不同来源、端口和路径拒绝。
  - 学校跳转失败时仅记录协议、主机、路径、是否含 data 和校验原因；移除该共享解析器中原有的完整跳转与票据调试输出。
  - 相关及 Go 全部测试、Go vet 和消息来源检查通过；[GitHub Actions 44876942487](https://github.com/OyamaMeek/HzieeVPN-easyconnect/actions/runs/44876942487) 的 test/image 均成功。
  - HK-AK 已拉取并运行修复镜像，版本实际输出 `f3a61a5`，网页 HTTP 200。应用内浏览器已更新访问链接并加载真实钉钉二维码，等待用户再次扫码核对学校票据与后续隧道。当前尚未取得此前失败跳转的原始结构，不把默认端口缺陷写作已证实的实际跳转原因。

- **涉及文件**：
  - `client/atrust/auth/request.go`、`dingtalk.go`、`redirect_test.go`、`memory/plan.md`、`memory/progress.md`、`memory/verify.md`。

- **Git 提交**：`f3a61a5d59966fb7a139f68ee636a649f4420ad1 fix: normalize HTTPS origin in portal redirects`，已普通推送至 origin/master；部署结果通过后续文档提交保存。

---

## [2026-11-21 17:48] 接入官方 aTrust 客户端二维码读取

- **需求/问题描述**：
  > 用户要求使用官方 aTrust 客户端，网页只展示客户端二维码，不使用 VNC。

- **实际实现的功能与改动**：
  - 停止独立 Go 扫码容器；官方 aTrust 原容器保持运行，本地 HTTPS 状态接口实际返回 `code=0`、`status=logout`。
  - 增加在官方 Electron 界面进程中读取钉钉二维码的组件、独立展示网页与回环端口转发单元。认证仍由官方客户端处理，组件不兑换授权码、不替换学校认证。
  - 三项来源、令牌及图片数据边界测试先因缺失组件失败，新增组件后通过；JavaScript 语法检查通过。真实官方客户端接入及二维码读取尚待部署验证。
  - REA 调用首次被自动审批拒绝；用户明确同意后，对已复制的五份客户端脚本完成静态分析，不将其当作认证或运行成功证据。

- **涉及文件**：
  - `deploy/hziee/atrust_qr.cjs`、`atrust_qr_entry.cjs`、`atrust_qr.html`、`atrust-qr.service`、`test_atrust_qr.cjs`。
  - `.github/workflows/build-image.yml`、`memory/plan.md`、`memory/progress.md`、`memory/verify.md`、`memory/gotchas.md`。

- **Git 提交**：`1115f32310b3e2d4cfc0dfeb31a18dc8bf2d7d79 feat: read QR codes from official aTrust client`，已普通推送。

---

## [2026-11-21 17:55] 修正官方客户端入口和回环转发参数

- **需求/问题描述**：
  > 官方 aTrust 二维码组件首次部署后未启动。

- **实际实现的功能与改动**：
  - 首次组件提交的 Actions `44891373966` 测试与镜像任务成功，服务器文件校验和与本地一致；官方客户端运行，但包清单指定的新入口未生效，未生成组件访问令牌。
  - 调整包装入口为加载备份的原客户端主文件；修正 socat 嵌套 TCP 地址的冒号转义。
  - 实际入口接入后，服务器与本机网页 HTTP 200，鉴权状态返回官方 `logout` 和客户端页面；刷新操作接入原客户端登录窗口并选择钉钉，二维码仍待实际读取。
  - 后续实际读取到官方客户端中的 `qrcode.html` 与钉钉 `oauth2/challenge.htm` 二维码，连续三次 `hasQR=true`。过期后真实刷新接口返回 `refreshed=false`，检查原生页面发现可见刷新控件位于过期遮罩内；调整为选择可见控件，并过滤已过期的钉钉二维码。
  - 修复后应用内浏览器显示真实客户端二维码；过期后点击刷新并等待图片的检查仍超时。将刷新改为仅在官方 logout 状态重新打开原客户端登录窗口，由官方流程重建二维码。
  - 更新后按用户“重新获取”实际点击网页刷新，10.8 秒内重新显示官方客户端二维码图片。服务器与本机网页 HTTP 200，systemd 单元校验及回环转发通过；入口仅监听宿主机回环地址，原客户端配置和数据保留。
  - Node 边界与语法检查通过；[Actions 44892973042](https://github.com/OyamaMeek/HzieeVPN-easyconnect/actions/runs/44892973042) 的 test/image 均成功。本人扫码、登录、隧道、代理与保活尚未确认；未使用 VNC 或二维码截图。

- **涉及文件**：
  - `deploy/hziee/atrust_qr.cjs`、`deploy/hziee/atrust_qr_entry.cjs`、`deploy/hziee/atrust-qr.service`。
  - `README.md`、`deploy/hziee/README.md`、`memory/agents.md`、`memory/progress.md`、`memory/verify.md`。

- **Git 提交**：`9af9adb fix: load QR bridge from aTrust client entry`、`efb5753 fix: open native DingTalk login from QR page`、`c77ddad fix: inspect native login frame locations`、`d426731 fix: refresh expired native DingTalk QR codes`、`69eea0c2bf336415b5eedbe8ec6ac2961dea036c fix: recreate native login window for QR refresh`，均已普通推送。部署记录通过后续文档提交保存。

---

## [2026-11-21 18:17] 检查官方 aTrust 扫码登录与连通性

- **需求/问题描述**：
  > 用户扫码后要求检查实际结果。

- **实际实现的功能与改动**：
  - 应用内网页显示 online，独立查询官方本地 HTTPS 状态接口返回 code=0、status=online，确认官方客户端扫码登录成功。
  - 容器 running、重启 0；utun7 具有 UP/LOWER_UP、有地址，校内测试目标的实际路由使用 utun7。
  - HTTP 和 SOCKS5 访问校内测试目标均为空响应，HTTP 000、0 字节，curl 退出 52；耗时分别约 0.061 秒与 0.043 秒。
  - 两台学校节点的 10441 TCP 各检查 5 秒，均超时，退出 124。具体访问失败原因未确定，未执行成功连接后的分钟保活。
  - 本轮为只读运行检查，未重启客户端、退出登录或修改服务器配置；未使用 VNC，未执行二维码截图。

- **涉及文件**：
  - `memory/agents.md`、`memory/progress.md`、`memory/verify.md`、`deploy/hziee/README.md`、`docs/CHANGELOG.md`。

- **Git 提交**：`ee04b2e80d51b5fda44670a39069d81c3c96a2ce docs: verify official aTrust scan login`，已普通推送；提交信息通过后续文档提交补记。

---

## [2026-11-21 23:06] 复用原官方容器并恢复二维码网页入口

- **需求/问题描述**：
  > 沿用首次官方 aTrust 部署，从 VPS 获取二维码映射到网页，在终端显示链接，不使用 VNC，继续使用原选定端口。

- **实际实现的功能与改动**：
  - 核对原固定镜像容器 running、重启计数 0，二维码 service active，服务器仅监听回环 28081；恢复 Termius 本地转发，服务器与本机网页均 HTTP 200。
  - 起始客户端为 logout，刷新未取得二维码；保留配置和数据，重启原容器后重新打开登录窗口，网页实际取得二维码，DOM 确认图片加载成功、尺寸 180×180。
  - HK-AK 终端已输出重启后的完整链接，应用内浏览器保留扫码页。复用现有组件，未修改认证、隧道或部署配置，未使用 VNC 或截图。
  - 三项 Node 边界测试和组件语法检查通过；等待本人扫码，本轮未验证登录后的校内访问和分钟保活。完整令牌及私密检查输出不写入 Git。

- **涉及文件**：
  - `memory/agents.md`、`memory/plan.md`、`memory/progress.md`、`memory/verify.md`、`deploy/hziee/README.md`、`docs/CHANGELOG.md`。

- **Git 提交**：`9bbaa51 docs: record restored official aTrust QR entry`，已普通推送；提交信息通过后续文档提交补记。

---

## [2026-11-21 23:15] 测试官方容器的校内 HTTP 保活请求

- **需求/问题描述**：
  > 测试通过 VPS 的官方容器代理请求校内保活地址能否成功。

- **实际实现的功能与改动**：
  - 实际通过 VPS 回环 8888 HTTP 代理发送 GET，显式禁用 NO_PROXY 绕过，连接超时 5 秒、总超时 10 秒。
  - curl 返回 Empty reply from server，退出码 52；HTTP 000、0 字节、耗时 0.045432 秒。请求未成功，未配置定时保活。
  - 本轮没有修改客户端、配置、会话或服务器设置；只更新脱敏记录，未重复运行代码测试。文档执行 git diff --check。

- **涉及文件**：
  - `memory/progress.md`、`memory/verify.md`、`docs/CHANGELOG.md`。

- **Git 提交**：`e2ed0f1 docs: record campus keepalive request failure`，已普通推送；提交信息通过后续文档提交补记。

---

## [2026-11-23 13:21] 在上海服务器试部署官方 aTrust

- **需求/问题描述**：
  > 将当前项目部署到 Termius 的 Shanghai-Aliyun 试用。

- **实际实现的功能与改动**：
  - 通过现有 Termius 终端及 SFTP 操作 Debian 13 amd64 服务器，安装 Docker 26.1.5、Compose 2.26.1、socat 和 jq；两台学校节点 10441 TCP 均连接成功，认证入口 HTTP 302。
  - 服务器直连 Docker Hub 超时、GitHub raw 连接重置。本机使用校验过的 crane 下载固定摘要 amd64 镜像，通过 SFTP 上传后核对归档 SHA-256 一致，再成功导入 Docker。
  - 官方客户端 2.5.16.20 容器 running、重启 0；复用现有二维码组件，保留原入口备份，二维码 systemd 单元校验通过、服务 active 和 enabled。新数据位于 `/opt/hziee-vpn/data`，部署文件位于 `/opt/hziee-atrust-qr`，未修改香港部署。
  - 服务器网页 HTTP 200，未授权状态请求及错误 Host 均 HTTP 403，当前令牌状态请求成功。1080、8888、28081 均只监听回环。四份组件文件校验和与本机一致；三项 Node 边界测试及两份组件语法检查通过。
  - 官方工具成功写入学校入口，但客户端仍为 logout、image=null。刷新时一次返回 502，日志为 `target closed while handling command`，后续五次轮询仍无二维码，尚未确定原因。
  - Termius 本地转发的主机选择弹层无可用辅助功能文本；依据用户 AGENTS.md 请求截图授权，尚未收到答复，新转发尚未完成。没有使用 VNC 或截图，没有执行扫码、隧道、校内代理或分钟保活验证。
  - 本轮复用已有组件，未修改客户端或认证代码；仅更新脱敏记录，执行文档差异检查。

- **涉及文件**：
  - `memory/agents.md`、`memory/plan.md`、`memory/progress.md`、`memory/verify.md`、`docs/CHANGELOG.md`。
  - 远程部署文件及私密日志留在目标服务器；本机工具和归档位于已忽略的 `.agent/work/shanghai/`。

- **Git 提交**：未提交。自动审批两次拒绝提交及普通推送至当前 `origin/master`，认为用户提供的自动推送条款不足以授权本次操作；尚未暂存或更改远端，等待本次明确批准。

---

## [2026-11-23 23:26] 在上海官方客户端尝试账号密码登录

- **需求/问题描述**：
  > 使用已有账号密码登录试试看，并继续完成验证。

- **实际实现的功能与改动**：
  - 从权限 600、已忽略的 TOML 配置读取现有学校账号密码，确认入口和 ShenLan 登录域；没有将凭据写入终端命令或公开记录。
  - 凭据临时保存首次被自动审批拒绝；用户明确批准后，通过 Termius SFTP 使用权限 600 的临时文件。用户另已批准 Termius 截图检查，通过系统 Window 菜单恢复显示并读取真实命令结果。
  - 保留原入口恢复点，通过官方客户端页面内原有 master 模块实际提交一次密码认证，继续由官方模块处理密码加密和认证，没有使用独立 Go 客户端替代。
  - 官方返回 BusinessError，code=75500000，提示 `The characters has expired. Please try again`，graphCheckCodeEnable=1、nextService=auth/psw。学校要求图形验证码；本轮未处理验证码，不能判定账号密码正确或错误，未登录成功。
  - 已恢复原客户端入口，其 SHA-256 与原二维码包装入口一致；远程两份临时凭据均已删除并检查不存在，一次性运行模块及本机凭据副本已清理。原 TOML、客户端数据及入口备份保留。
  - 一次性文件 Node 语法检查通过，上传文件校验和与本机一致；最终容器 running、重启 0，二维码服务 active，服务器网页 HTTP 200、官方状态 logout。未使用 VNC，未验证校内代理或分钟保活，未修改仓库认证代码。

- **涉及文件**：
  - `memory/agents.md`、`memory/plan.md`、`memory/progress.md`、`memory/verify.md`、`docs/CHANGELOG.md`。
  - 一次性操作源文件位于已忽略的 `.agent/work/shanghai/`，不含真实凭据；原账号密码配置保持不变。

- **Git 提交**：未提交。此前自动审批拒绝向当前 `origin/master` 提交和普通推送，仍等待本次明确批准；本轮没有再次执行被拒绝的 Git 操作。

---

## [2026-11-24 00:00] 完成上海官方客户端验证码登录

- **需求/问题描述**：
  > 由代理点选验证码，继续完成 Shanghai-Aliyun 官方客户端的账号密码登录。

- **实际实现的功能与改动**：
  - 在官方 Electron 页面当前会话中取得学校验证码原图，由官方密码模块处理加密与认证。最终图片生成约 24 秒后提交，返回 code=0、Succeeded，客户端状态 online。
  - 较早点选提交因耗时返回验证码过期；核对时间与提交标记后，改为 SFTP 下载图片、终端直接提交坐标，未修改仓库认证代码，未使用 VNC。
  - 实际校内路由经过 utun7；23:58:28 显式禁用 NO_PROXY 绕过后，SOCKS5 和 HTTP 代理均 HTTP 200、7624 字节、curl 退出 0。23:59:53 间隔 85 秒复测，客户端仍 online，两种代理再次得到相同成功结果；网页 HTTP 200。未配置额外定时任务。
  - 原二维码启动入口已恢复，SHA-256 与恢复点一致。远程两份、本机两份临时凭据均已删除并检查，原配置保留且权限 600；一次性运行模块已清理，本机临时图片服务已停止。当前在线会话保持运行，没有重启客户端。
  - 容器 running、重启计数 0，二维码 service active；1080、8888、28081 均只监听 127.0.0.1。本机新 SSH 转发仍未完成，香港部署保持原状。
  - 文档差异检查通过；本轮验证采用真实官方认证、状态、路由及代理请求，没有以模拟结果替代。

- **涉及文件**：
  - `memory/agents.md`、`memory/plan.md`、`memory/progress.md`、`memory/verify.md`、`docs/CHANGELOG.md`。
  - 一次性操作与脱敏结果位于已忽略的 `.agent/work/shanghai/`，凭据副本已清理。

- **Git 提交**：未提交。此前自动审批拒绝向当前 `origin/master` 提交和普通推送，要求本次明确批准；本轮没有重复执行被拒绝操作。

---

## [2026-11-24 10:37] 高位端口统一登录网页（密码验证码映射与服务端钉钉扫码映射）

- **需求/问题描述**：
  > 把密码登录的验证码映射到一个网页上开一个高位端口放出来，钉钉扫码登录也是在服务器上获取二维码再把二维码映射到一个网页上。

- **实际实现的功能与改动**：
  - 扩展官方 aTrust 客户端内嵌网页服务 `deploy/hziee/atrust_qr.cjs` 与 `deploy/hziee/atrust_qr.html`：在同一网页提供“密码登录”与“钉钉扫码”两个标签页。
    - 密码登录模式在服务器端通过官方 Electron 会话抓取图形验证码并转为 PNG 映射到网页，网页完成顺序点选与坐标换算后提交给服务器官方 `master` 密码认证模块，强制单次 `challenge` 防重放，并对错误消息做账号与密码脱敏。
    - 钉钉扫码模式继续在服务器端从官方 Electron 客户端提取钉钉二维码 PNG 并映射到网页，不依赖客户端浏览器加载钉钉登录框，并与密码模式状态隔离。
  - 调整 `deploy/hziee/atrust-qr.service` 与主机白名单校验：容器内仍监听 `127.0.0.1:28081`，宿主机服务默认改为对外监听高位端口 `58081`（支持通过 `/etc/default/atrust-qr` 与 `ATRUST_PUBLIC_PORTS` 调整），同时保持端口白名单、同源 `Origin` 与恒定时间 `Bearer` 令牌校验。
  - 同步为 Go 无图形客户端的 `deploy/hziee/captcha_web.py` 增加 `--host` 参数及外部高位端口 `Host`/`Origin`/令牌校验，默认仍保持 `127.0.0.1:18081` 兼容。
  - 测试与验证：`node --check` 与 HTML 内联脚本检查通过；`node --test deploy/hziee/test_atrust_qr.cjs deploy/hziee/test_dingtalk_message.mjs` 8/8 通过；`python3 -B -m unittest discover -s deploy/hziee -p 'test_captcha_web.py' -v` 11/11 通过；本次未修改 Go 源码（当前 PATH 未安装 `go`），且尚未覆盖部署到线上服务器，保留 Shanghai-Aliyun 当前在线会话。

- **涉及文件**：
  - `deploy/hziee/atrust_qr.cjs` (+472 / -43)
  - `deploy/hziee/atrust_qr.html` (+300 / -28)
  - `deploy/hziee/atrust-qr.service` (+6 / -2)
  - `deploy/hziee/captcha_web.py` (+44 / -8)
  - `deploy/hziee/test_atrust_qr.cjs` (+222 / -3)
  - `deploy/hziee/test_captcha_web.py` (+31 / -0)
  - `deploy/hziee/README.md`、`memory/plan.md`、`memory/progress.md`、`memory/verify.md`、`docs/CHANGELOG.md`

- **Git 提交**：`944f4ef feat: add high-port unified login web and aTrust image build`

---

## [2026-11-24 11:44] GitHub Actions 构建统一登录镜像并部署至 Shanghai-Aliyun 验证

- **需求/问题描述**：
  > 用 GitHub Actions 编译成 Docker 镜像并部署到上海 VPS 机器上测试密码验证码网页与服务端钉钉扫码网页。

- **实际实现的功能与改动**：
  - 新增 `Dockerfile.atrust`、`deploy/hziee/compose.atrust.yaml` 与 `.github/workflows/build-image.yml` 的 `atrust-image` 任务，将统一登录网页内置到 `/opt/atrust-web/`，并在镜像内将 `vpn-config.sh` 的 `FORCE_OPEN_PORTS` 扩展为 `54631 ${ATRUST_WEB_PORT:-58081}` 以保证 VPN 隧道建立后高位端口回包正常。
  - 依据 Shanghai-Aliyun 实机测试结果连续修复四个运行时问题：兼容英文与学校门户真实认证标签 `钉钉扫码`、处理刷新时窗口关闭竞态（`0ea4a3e`、`84baf18`）、支持从钉钉扫码切回密码表单（`f5e8064`），以及处理点击钉钉后官方页面 `history.pushState` 将主窗口 URL 改写为 `https://vpn.hziee.edu.cn/` 导致的页面跳过与相对 `import('./assets/...')` 失效问题，改为显式匹配门户 URL 并基于本地 `web/assets/` 绝对 `file://` URL 加载官方模块（`e5121a3`）。
  - 在 Shanghai-Aliyun 停用旧 `atrust-qr.service`，改由 `/opt/hziee-vpn/compose.yaml` 运行 GHCR 镜像 `atrust-sha-e5121a3553baa014217d5c18f8f7085ea179f1f7`，并完成完整双模式端到端验证。
  - 测试与验证：
    - 本地 `node --test deploy/hziee/test_atrust_qr.cjs deploy/hziee/test_dingtalk_message.mjs` 10/10 通过，`python3 -B -m unittest discover -s deploy/hziee -p 'test_captcha_web.py' -v` 11/11 通过。
    - GitHub Actions 运行 `45320746516`（`e5121a3553baa014217d5c18f8f7085ea179f1f7`）中 `test`、`image`、`atrust-image` 均 `success`，发布 `ghcr.io/oyamameek/hzieevpn-easyconnect:atrust-latest` 与 `:atrust-sha-e5121a3553baa014217d5c18f8f7085ea179f1f7`（摘要 `sha256:a52cc61141a48ea9ba81c6e1014a02b1be4a025dc21c3fe07853f329b06f2b5b`）。
    - Shanghai-Aliyun 实测：`0.0.0.0:58081`、`127.0.0.1:1080`、`127.0.0.1:8888` 监听正常；鉴权与高位端口 `Host`/`Origin` 校验通过（`root=200`、`noauth=403`、`badhost=403`、`bad_origin=403`、`ext_status=200`）；密码验证码返回真实 `272x192` PNG（`img_len=124654`、`ch_len=32`）；钉钉扫码返回真实服务端二维码 PNG（`img_len=1242`，含 `https://login.dingtalk.com/oauth2/challenge.htm`）；从钉钉切回密码验证码返回真实 `272x192` PNG（`img_len=126382`、`ch_len=32`），`[aTrust Web]` 日志零报错。
    - 外部网络说明：宿主机 `iptables` 未拦截，但公网直连 `58081` 超时，需在阿里云安全组放行入站 TCP `58081`；本轮未执行真实登录后代理验证。

- **涉及文件**：
  - `Dockerfile.atrust`、`deploy/hziee/compose.atrust.yaml`、`.github/workflows/build-image.yml`
  - `deploy/hziee/atrust_qr.cjs`、`deploy/hziee/atrust_qr_entry.cjs`、`deploy/hziee/test_atrust_qr.cjs`
  - `memory/agents.md`、`memory/plan.md`、`memory/progress.md`、`memory/verify.md`、`docs/CHANGELOG.md`

- **Git 提交**：代码提交 `944f4ef`、`0ea4a3e`、`84baf18`、`f5e8064`、`e5121a3`；文档提交 `3d7decd`。

---

## [2026-11-24 13:13] 修复统一登录页初始验证码占位破图并支持页内令牌输入

- **需求/问题描述**：
  > 用户公网访问高位端口统一登录页时，页面显示未加载验证码的破图图标以及未携带 `#<token>` 导致的“登录链接已失效，请重新获取”。

- **实际实现的功能与改动**：
  - 修复 `deploy/hziee/atrust_qr.html` 中 `.stage { display: inline-block }` 覆盖默认 `[hidden]` 规则导致未获取验证码前出现破图图标的问题，改为 `[hidden]{display:none !important}` 并在隐藏验证码容器时清除 `src`。
  - 增加页内访问令牌输入区 `#tokenGate`：当 URL 缺少 `#<token>` 或服务端返回 403 令牌失效时，停止无效轮询、将右上角状态更新为“未认证”、提示附带 `#<token>` 或直接粘贴服务器令牌，并在应用令牌后通过 `history.replaceState` 写入 URL 片段并恢复轮询。
  - 在 `deploy/hziee/test_atrust_qr.cjs` 新增前端隐藏规则、令牌输入框元素与内联脚本语法校验单测。
  - 测试与验证：
    - 本地 `node --check` 与 `node --test deploy/hziee/test_atrust_qr.cjs deploy/hziee/test_dingtalk_message.mjs` 11/11 通过。
    - GitHub Actions 运行 `45330968083`（`7afe306e6cf475d3f00a670bf8f78140d116a218`）中 `test`、`image`、`atrust-image` 全部 `success`，发布 GHCR 镜像摘要 `sha256:e2b58988b4be20a24c5de113d38b819815ed459e9c126ceb84889f0de1fc76b4`。
    - Shanghai-Aliyun 已更新运行 `atrust-sha-7afe306e6cf475d3f00a670bf8f78140d116a218`，复测 `HTML_GATE=7`、`NOAUTH=403`、`AUTH_OK=200`。

- **涉及文件**：
  - `deploy/hziee/atrust_qr.html`、`deploy/hziee/test_atrust_qr.cjs`
  - `memory/agents.md`、`memory/progress.md`、`memory/verify.md`、`docs/CHANGELOG.md`

- **Git 提交**：代码提交 `7afe306`；本轮文档记录待提交。

---
