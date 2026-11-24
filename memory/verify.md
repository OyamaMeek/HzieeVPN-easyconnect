# 当前验证标准

## 高位端口统一登录网页（2026-11-24）

- `node --test deploy/hziee/test_atrust_qr.cjs deploy/hziee/test_dingtalk_message.mjs` 全部通过，覆盖：
  - 高位端口与回环端口的 Host/Origin/恒定时间 Bearer 鉴权与拒绝非法来源/端口；
  - 官方验证码 URL 白名单与密码登录参数、坐标范围、尺寸、登录域校验；
  - 真实 HTTP 服务闭环：密码验证码获取与提交、单次 challenge 防重放、错误消息凭据脱敏、钉钉扫码刷新与状态读取、两种模式互不干扰。
- `python3 -B -m unittest discover -s deploy/hziee -p 'test_captcha_web.py' -v` 全部通过，覆盖默认回环与高位端口外部绑定模式下的鉴权与提交。
- `go test ./...` 与两份 Compose 配置校验继续通过；不触碰或泄露 `deploy/hziee/headless.toml` 真实凭据。
- 如尚未部署到线上服务器，明确说明仅完成仓库实现与本地测试，不宣称线上公网高位端口已实测通过。

实际结果（2026-11-24 11:44）：
- 本地测试：
  - `node --test deploy/hziee/test_atrust_qr.cjs deploy/hziee/test_dingtalk_message.mjs`：10/10 通过（含 `isLoginPageUrl` 与 `resolveAssetsBaseUrl` 覆盖 `history.pushState` 场景）。
  - `python3 -B -m unittest discover -s deploy/hziee -p 'test_captcha_web.py' -v`：11/11 通过。
- GitHub Actions（运行 `45320746516`，提交 `e5121a3553baa014217d5c18f8f7085ea179f1f7`）：
  - `test`、`image`、`atrust-image` 全部 `completed / success`。
  - GHCR 镜像 `ghcr.io/oyamameek/hzieevpn-easyconnect:atrust-latest` 与 `:atrust-sha-e5121a3553baa014217d5c18f8f7085ea179f1f7` OCI 索引摘要均为 `sha256:a52cc61141a48ea9ba81c6e1014a02b1be4a025dc21c3fe07853f329b06f2b5b`。
- Shanghai-Aliyun 实机端到端验证（容器 `hziee-vpn-atrust-1`，镜像 `atrust-sha-e5121a3553baa014217d5c18f8f7085ea179f1f7`）：
  - 监听端口：`0.0.0.0:58081`、`127.0.0.1:1080`、`127.0.0.1:8888`；`iptables -S INPUT` 为 `-P INPUT ACCEPT`。
  - 鉴权与高位端口校验：`GET /` 返回 `200`，无令牌 `GET /status` 返回 `403`，非法 `Host` 返回 `403`，跨源 `Origin` 返回 `403`，带外部高位端口 `Host: 203.0.113.10:58081`、`Origin: http://203.0.113.10:58081` 与当前 Bearer 令牌请求 `GET /status?mode=password` 返回 `200`。
  - 密码登录验证码：`POST /password/captcha` 返回真实学校 `272x192` PNG（`data:image/png;base64,iVBO`，长度 `124654`，`challenge` 长度 `32`，`error: null`）。
  - 服务端钉钉扫码：`POST /refresh` 后第 3 次轮询 `GET /status` 返回真实服务端钉钉二维码 PNG（`data:image/png;base64,iVBO`，长度 `1242`，`frames` 包含 `https://login.dingtalk.com/oauth2/challenge.htm`，`error: null`）。
  - 钉钉切回密码验证码：`POST /password/captcha` 返回真实 `272x192` PNG（`data:image/png;base64,iVBO`，长度 `126382`，`challenge` 长度 `32`，`error: null`），`[aTrust Web]` 日志零错误。
- 未验证范围与外部前置条件：本机直连服务器公网 `58081` 端口超时，需在阿里云安全组放行入站 TCP `58081` 后方可从公网浏览器直连；容器当前为 `logout` 状态待本人登录，本轮未重新验证登录后隧道与校内代理。

## 官方客户端验证码点选（2026-11-23）

- 图片必须来自本轮官方客户端同一会话；读取原图提示，提交顺序坐标、宽高，不能以另一认证会话的图片代替。
- 验证码点选已由用户本轮明确要求；账号密码临时保存和 Termius 截图授权沿用已取得的明确答复。
- 只有官方 online 并实际请求校内地址成功，才能记录代理或分钟保活通过。
- 记录真实错误码及原因；完成后恢复原入口并确认临时凭据副本已删除。

实际结果：最终真实验证码在生成约 24 秒后提交，官方密码模块 code=0、Succeeded；客户端 online，校内路由经过 utun7。23:58:28（Asia/Taipei）显式禁用 NO_PROXY 绕过后，SOCKS5 与 HTTP 代理均 HTTP 200、7624 字节、curl 退出 0。原二维码入口 SHA-256 恢复为 `6dc575935b73d7a932294c54f873341eb8a018d815d020c177e0f3d1a6be6af4`；远程两份、本机两份临时凭据已清理，原 TOML 权限保留 600。本机临时图片服务停止，容器 running、重启计数 0，二维码 service active，三端口只监听回环。当前进程完成的一次性操作已停止，保留在线会话，没有重启；下次启动使用已恢复的入口。

分钟复测：23:59:53（Asia/Taipei）距上述基线 85 秒，官方仍 online，SOCKS5 与 HTTP 代理再次 HTTP 200、7624 字节、curl 退出 0，网页 HTTP 200。未配置额外定时保活任务。

## Shanghai-Aliyun 密码登录试验（2026-11-23）

- 账号密码仅从已忽略的本地配置读取，通过 SFTP 传至用户指定上海主机，不在终端、公开记录或 Git 中展示。
- 继续使用官方客户端及其 SDK，不能用独立 Go 登录成功替代官方客户端登录证据。
- 保留原入口恢复点；一次性文件进行语法检查及实际运行验证，状态与日志只输出允许字段。
- 验证码、短信等额外认证与登录成功分别记录；只有官方 online 且实际校内请求成功，才验证分钟保活。

实际结果：一次性操作文件语法检查通过；更新文件远程校验和与本机一致，通过官方客户端网页 master 模块实际提交一次密码认证。返回 code=75500000、graphCheckCodeEnable=1、nextService=auth/psw，提示字符验证码已过期；未处理验证码，官方状态 logout。用户已明确批准权限 600 的临时凭据落盘及 Termius 截图检查。恢复后的客户端入口校验和与原二维码包装入口一致，远程两份凭据副本分别检查不存在，本机生成副本已删除；原 TOML 保留。最终容器 running、重启 0，二维码 service active，服务器网页 HTTP 200。未使用 VNC，未验证校内代理与分钟保活。

## Shanghai-Aliyun 试部署（2026-11-23）

- 确认当前目标为 Shanghai-Aliyun，读取真实系统、Docker、监听端口和学校节点连接结果。
- 复用官方客户端和现有二维码组件；检查配置、容器、服务及网页真实 HTTP 响应，入口只监听回环地址。
- 本人扫码前只记录等待状态；官方登录成功后实际验证 HTTP/SOCKS5 校内访问和一次分钟保活。
- 命令已发送不算执行成功，必须取得退出码或实际输出；未获截图授权前继续使用文本方式。

实际结果：服务器 Debian 13 amd64，学校两个数据节点 10441 TCP 均退出 0、认证入口 HTTP 302。安装 Docker 26.1.5、Compose 2.26.1、socat 和 jq；固定摘要镜像通过本机下载及 SFTP 上传，归档校验和一致，导入成功。四份二维码组件文件校验和一致，本机三项 Node 边界测试和两份组件语法检查通过。官方 aTrust 2.5.16.20 容器 running、重启 0，二维码服务 active、enabled，systemd 单元校验通过；服务器网页 HTTP 200，无令牌与错误 Host HTTP 403，鉴权状态请求成功，三端口仅监听回环。首次安装仍停留 logout、image=null；刷新时一次返回 502，随后五次轮询均未取得二维码。Termius 本地转发主机选择无法通过辅助功能文本读取，截图授权尚未收到答复，未完成新转发。未扫码、未验证隧道、代理或分钟保活；未使用 VNC 或截图，也未更改客户端源码。

## 校内 HTTP 保活请求复测（2026-11-21 23:15）

- 在 HK-AK 通过官方容器的宿主机回环 HTTP 代理 8888 实际请求校内保活地址，显式禁用 NO_PROXY 绕过，连接超时 5 秒、总超时 10 秒。
- 返回 curl 52、Empty reply from server，HTTP 000、0 字节、耗时 0.045432 秒；请求未成功，未配置定时任务，未验证分钟保活。
- 本次未修改客户端、配置、会话或服务器设置；只保存脱敏检查记录，未重复运行代码测试。

## 复用原官方部署并提供网页链接（2026-11-21 23:06）

- 已核对原官方容器固定镜像和运行状态，二维码服务 active；服务器回环 28081、本机 Termius 转发网页均 HTTP 200。
- 初始客户端为 logout，重启原容器并点击网页刷新后实际显示客户端二维码；DOM 确认图片加载成功，原始尺寸 180×180。终端输出重启后的完整链接，页面已保留供本人扫码。
- 三项 Node 边界测试和组件语法检查通过。仅复用现有实现，未修改认证、隧道、配置或数据，未使用 VNC、截图或视觉验收。
- 本轮尚未本人扫码，未复测登录后的校内访问和分钟保活。

## 官方 aTrust 二维码网页

- 二维码来自 HK-AK 官方 aTrust 客户端当前会话；扫码结果由该客户端接收，网页不另起学校门户或 Go 客户端认证。
- 网页展示和刷新真实二维码，不使用 VNC；只绑定回环高位端口，不公开客户端接口及凭据。
- 保留已有官方客户端配置与会话；本人扫码前不宣称登录成功，登录后分别检查代理和保活。

实际结果：3 项边界测试、语法检查通过；服务器 systemd 单元校验及实际回环转发通过，服务器与本机网页 HTTP 200。真实客户端二维码读取成功，过期控件刷新检查失败后改为重新打开原客户端登录窗口；更新后应用内浏览器实际点击刷新，在 10.8 秒内显示新二维码图片。用户扫码后，网页及官方本地 HTTPS 接口确认 online，code=0；utun7 为 UP/LOWER_UP、有地址，测试目标路由使用该接口。HTTP/SOCKS5 校内请求均 HTTP 000、0 字节、curl 退出 52，两台学校节点 10441 TCP 检查各 5 秒超时、退出 124。登录已成功，实际校内访问未通过，未执行成功连接后的分钟保活。未使用 VNC，也未执行二维码截图或额外视觉检查。

## 修复扫码后网页无反应

- 回归检查覆盖扫码临时码到服务端提交、错误消息不被倒计时覆盖、来源及重定向地址和 state 校验。
- 实际加载官方二维码，服务器收到临时码后仅向钉钉和学校白名单地址交接，不记录完整认证码或 Cookie。
- 更新后由用户本人扫码确认；学校认证、VPN 隧道及代理验证分别记录，不以合成事件测试代替真实认证。
- 共享票据解析的回归检查覆盖 HTTPS 默认端口等价、大小写、非默认端口和外域拒绝；实际学校跳转的失败日志只保留结构，不输出查询值与票据。

实际结果：Go 回归检查先暴露旧 iframe 与回调参数不匹配，修复后 Go 全部测试、Go vet、消息来源及格式检查、10 项 Python 测试、Compose 校验和 Linux amd64/arm64 编译均通过。HK-AK 临时码修复版收到用户两次实际扫码，钉钉兑换完成后在学校票据跳转解析阶段被拒绝。新增回归检查先确认显式/省略 443 的等价来源错误被拒绝；修复后 Go 全部测试、Go vet、消息边界检查通过，GitHub Actions `44876942487` 两项成功。服务器版本实际输出 `f3a61a5`，网页 HTTP 200；应用内浏览器已更新访问链接并从真实学校配置加载二维码。默认端口缺陷可复现，但尚未取得此前失败跳转的原始结构；仍待用户再次扫码核对真实票据解析结果，不能宣称 VPN 隧道、代理或分钟保活通过。

## 独立钉钉扫码网页

- 网页使用 28081，展示实际学校签发的二维码；不使用 VNC 传输、远程桌面或桌面截图。
- 按实际接口检查扫码状态、过期与错误；认证结果归属于发起会话，访问令牌和 Cookie 不进入公开日志或 Git。
- 保留原配置与会话；实际执行取码、网页 HTTP 检查与相关测试；需要本人扫码时明确交回用户。
- 扫码成功、客户端认证成功、数据节点可达及代理请求分别验证，未运行项目不得标记通过。

实际结果：新增登录类型测试先失败，补测修正后 Go 全部测试、Go vet、10 项 Python 测试、原生与 Linux amd64/arm64 编译、JavaScript 语法和两份 Compose 校验均通过。GitHub Actions `44874060686` 测试和镜像发布成功，服务器版本输出对应源码 `0727867`。HK-AK 新容器 running、重启 0，目录与配置权限和端口监听符合预期；服务器与本机 SSH 转发网页均 HTTP 200，鉴权配置接口 HTTP 200。浏览器实际加载并刷新钉钉二维码 iframe，等待用户本人扫码；尚未验证认证回调、VPN 隧道、代理和分钟保活。未执行二维码截图或视觉验收，未改动原服务配置和会话。

## 钉钉扫码重试

- 复用现有官方图形客户端，二维码由用户钉钉扫码确认，不更改账号密码及现有部署配置。
- 实际校内代理请求与隧道状态共同判断成功；只显示工作台或容器 Up 不算校内访问成功。

实际结果：远程桌面恢复连接，官方图形客户端显示已登录工作台；本轮未重新发起扫码或退出登录。HTTP/SOCKS5 请求校内测试地址均为空响应，curl 退出 52；绕过代理直接请求同一地址被重置，退出 56。未确认校内访问恢复，未执行成功连接后的分钟保活。临时私密副本均已清理，原凭据与配置保持不变；记录不含本轮具体内部地址或认证详情。

## 官方 ZJU-Connect 对照登录

- 实际使用官方 1.3.1 镜像，读取已有学校配置，不更改自建镜像部署文件；会话与日志独立保存且不输出凭据。
- 实际启动完整登录，记录认证、验证码和节点连接结果；不能以 TCP 预检替代此次用户要求的客户端重试。
- 完成后核对运行容器、端口和原服务恢复情况；成功连接后才执行代理与保活验证。

实际结果：官方镜像版本输出 v1.3.1，复用原配置实际启动学校密码登录。验证码提交后成功进入 clientResource 获取和解析，最终报 `no reachable node for ip request`，未建立隧道、未保存会话。最终检查确认测试容器退出、三个测试端口释放，旧容器保持 Up。代理与保活检查因隧道未建立而未执行。

## HK-AK 部署

- 确认目标主机、旧服务恢复点、所用镜像与本地配置一致；凭据只上传到用户指定主机，不出现在公开记录中。
- 服务器 Compose 校验、镜像版本、容器状态和监听地址检查通过；代理保持仅监听回环地址。
- 实际完成密码登录、HTTP/SOCKS5 校内请求和一次 60 秒保活；验证码如需用户操作则明确记录等待状态。
- 不执行额外视觉检查；通过 Termius 界面读取服务器执行结果。

实际结果：本地 10 项验证码测试和 Compose config 通过；服务器镜像摘要、源码版本、Compose config、部署文件校验和配置权限检查通过。用户完成验证码提交后，客户端因 `no reachable node for ip request` 退出；两台学校节点的 10441 TCP/TLS 检查均超时，本机对同节点可完成 TLS 握手。新服务的代理和保活未能验证。旧容器已重新启动并确认 Up，但其校内 HTTP 请求也超时，不能判定旧 VPN 可用。

## 已完成的源码构建验证

- 上游源代码、Go 模块校验文件、协议依赖和许可证必须完整纳入 GitHub，镜像构建必须执行本地源码的 `go build`。
- 学校默认配置测试覆盖 aTrust、vpn.hziee.edu.cn:443、auth/psw、ShenLan、1080/8888 和校内 HTTP 保活；先确认测试因原默认配置失败。
- 运行 Go 全部测试、Go vet、原生编译和 Linux amd64/arm64 交叉编译；构建产物放入忽略目录。
- 运行 10 项验证码 HTTP/子进程测试、JavaScript 语法检查和 Compose 配置；验证码代码、真实配置与会话不得改变。
- Docker 构建上下文排除 .git、.agent、本地密码、会话和日志；镜像不得使用 mythologyli/zju-connect 成品镜像。
- GitHub Actions 实际完成测试、构建和 GHCR 发布后，检查多架构镜像清单与工作流结果；失败时修正并跟踪完成。
- 提交仅包含源码、构建、配置、测试与文档；运行 git diff --check，普通推送后核对远端。
- 没有实际运行的检查不得记为通过。

本地结果：学校默认测试首先因原默认协议 easyconnect 失败，修改后通过。Go 全包测试及 vet 通过，macOS arm64、Linux amd64/arm64 静态编译均退出 0，原生二进制 `-version` 正常；不指定学校地址执行 `-auth-info` 成功取得学校真实认证方式，确认 ShenLan / auth/psw。10 项验证码测试、Compose config、JavaScript 语法、工作流 YAML 和 diff 检查通过。`.agent/work/password-source/check.py` 核对 132 个导入文件，仅学校默认配置与两个对应测试区别于上游；验证码代码、TOML 示例、本地凭据及会话 SHA-256 一致，Compose 完整 JSON 仅改变镜像引用。

GitHub 实际结果：[Actions 44721199266](https://github.com/OyamaMeek/HzieeVPN-easyconnect/actions/runs/44721199266) 的 test/image 两项均为 success，构建日志确认两种架构分别执行 go build，发布摘要为 `sha256:b8ee8094ec3dc2c0e759ccd4249d09605ddb8768a8650d365807e4ceefc34b59`。Smoke test published image 成功，容器输出 `ZJU Connect hziee-6f871aeadffefd2367c34d46f7dcfdc313dbfb99`。匿名请求 GHCR token 和 latest OCI 清单成功，检查确认 linux/amd64、linux/arm64；未更改包可见性。镜像可公开拉取；本次没有在服务器启动或切换 VPN。

补充结果（2026-11-24 13:13）：
- 本地 `node --check` 与 `node --test deploy/hziee/test_atrust_qr.cjs deploy/hziee/test_dingtalk_message.mjs`：11/11 通过（新增 HTML `[hidden]` 规则、令牌输入框元素与内联脚本编译校验）。
- GitHub Actions 运行 `45330968083`（提交 `7afe306e6cf475d3f00a670bf8f78140d116a218`）中 `test`、`image`、`atrust-image` 全部 `completed / success`，GHCR 摘要 `sha256:e2b58988b4be20a24c5de113d38b819815ed459e9c126ceb84889f0de1fc76b4`。
- Shanghai-Aliyun 已更新至 `atrust-sha-7afe306e6cf475d3f00a670bf8f78140d116a218`：`HTML_GATE=7`、`NOAUTH=403`、`AUTH_OK=200`；浏览器直连 `58081` 端口已可用，待用户粘贴最新令牌后完成实际登录。

补充结果（2026-11-24 13:40）：
- 本地 TDD：更新 `deploy/hziee/test_atrust_qr.cjs` 后，修改实现前 5 项新用例按预期失败。
- 修改后本地检查：`node --check deploy/hziee/atrust_qr.cjs deploy/hziee/atrust_qr_entry.cjs deploy/hziee/test_atrust_qr.cjs` 通过；`node --test deploy/hziee/test_dingtalk_message.mjs deploy/hziee/test_atrust_qr.cjs` 13/13 通过；`python3 -B -m unittest discover -s deploy/hziee -p 'test_captcha_web.py' -v` 11/11 通过；`git diff --check` 无告警。
- 未在本地执行的检查：本机未安装 `docker`，未在本地运行 `docker compose config` 与容器构建；未直接更新 Shanghai-Aliyun 服务器容器。
