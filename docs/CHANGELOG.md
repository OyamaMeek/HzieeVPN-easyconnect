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

- **Git 提交**：待提交英国服务器对照记录。

---
