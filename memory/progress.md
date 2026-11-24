# 进度

## 高位端口统一登录网页（2026-11-24）

- [x] 补充 Node 与 Python 单元测试用例，确认实现前对应测试失败（Node 5 项失败、Python 1 项失败）。
- [x] 实现 `deploy/hziee/atrust_qr.cjs`、`deploy/hziee/atrust_qr.html`、`deploy/hziee/atrust_qr_entry.cjs` 与 `deploy/hziee/atrust-qr.service` 的高位端口（默认 `58081`）统一登录网页：支持服务端官方会话抓取密码图形验证码并点选提交官方 `master` 模块，以及服务端抓取钉钉二维码并映射到网页。
- [x] 实现 `deploy/hziee/captcha_web.py` 的 `--host` 参数与外部高位端口 `Host`/`Origin`/Bearer 鉴权。
- [x] 新增 `Dockerfile.atrust`、`deploy/hziee/compose.atrust.yaml` 与 `.github/workflows/build-image.yml` 的 `atrust-image` 任务；推送并触发 GitHub Actions 编译发布 GHCR 镜像。
- [x] 针对 Shanghai-Aliyun 实测中暴露的问题完成三轮定向修复并推入 `origin/master`：英文/门户真实标签 `钉钉扫码` 与窗口刷新竞态（`0ea4a3e`、`84baf18`）、钉钉切回密码表单逻辑（`f5e8064`），以及 `history.pushState` 改写窗口 URL 为 `https://vpn.hziee.edu.cn/` 后的登录页识别与绝对 `file://` 模块基址解析（`e5121a3`）。
- [x] 最终本地测试通过：`node --test deploy/hziee/test_atrust_qr.cjs deploy/hziee/test_dingtalk_message.mjs`（10/10）与 `unittest`（11/11）；GitHub Actions 运行 `45320746516`（`test`、`image`、`atrust-image`）全部 `success`，产出 `ghcr.io/oyamameek/hzieevpn-easyconnect:atrust-sha-e5121a3553baa014217d5c18f8f7085ea179f1f7`（摘要 `sha256:a52cc61141a48ea9ba81c6e1014a02b1be4a025dc21c3fe07853f329b06f2b5b`）。
- [x] 在 Shanghai-Aliyun 部署 `atrust-sha-e5121a3553baa014217d5c18f8f7085ea179f1f7` 并通过完整端到端验证（鉴权与外部高位端口 `Host`/`Origin`、密码图形验证码、服务端钉钉二维码、钉钉切回密码验证码均通过，无错误日志）。
- [x] 公网浏览器直连高位端口 `58081` 已连通；根据用户实测截图修复两项页面问题（`7afe306`）：将 `[hidden]{display:none !important}` 覆盖 `.stage` 的 `display:inline-block` 以消除初始验证码破图占位，并为未携带 `#<token>` 或令牌失效的场景增加明确提示与页面内令牌输入框。
- [x] GitHub Actions 运行 `45330968083`（`test`、`image`、`atrust-image`）全部 `success`，产出 `ghcr.io/oyamameek/hzieevpn-easyconnect:atrust-sha-7afe306e6cf475d3f00a670bf8f78140d116a218`（摘要 `sha256:e2b58988b4be20a24c5de113d38b819815ed459e9c126ceb84889f0de1fc76b4`）；已在 Shanghai-Aliyun 拉取更新并确认新版页面与当前令牌鉴权返回 `200`。

## Shanghai-Aliyun 官方验证码登录（2026-11-23）

- [x] 用户要求代理点选验证码，沿用官方客户端当前会话获取原图；凭据临时保存与 Termius 截图均已有明确授权。
- [x] 较早提交返回验证码过期，测得其中两次耗时 114 秒和 129 秒；另一次 SFTP 答案没有实际上传，未产生提交标记。改为图片通过 SFTP 下载、答案直接在终端提交。
- [x] 最终图片生成至提交约 24 秒，官方密码模块返回 code=0、Succeeded；官方状态 online，校内路由经过 utun7。
- [x] 显式禁用 NO_PROXY 绕过后，两种代理均 HTTP 200、7624 字节、curl 退出 0；1080、8888、28081 只监听 127.0.0.1。
- [x] 原二维码入口恢复，SHA-256 与备份一致；远程两份和本机两份临时凭据删除并核对。一次性运行模块移除，本机临时图片服务已停止；保留当前在线会话，没有重启客户端。
- [x] 23:58:28 建立基线，23:59:53 间隔 85 秒复测；官方仍 online，两种代理再次 HTTP 200、7624 字节、退出 0，网页 HTTP 200。分钟连通性复测通过，未配置定时任务。
- [ ] Git 提交推送仍因此前自动审批拒绝而暂停，未重复执行被拒绝操作。

## Shanghai-Aliyun 密码登录试验（2026-11-23）

- [x] 本地配置文件存在、权限 600，账号及密码均非空，学校入口和 ShenLan 登录域符合现有配置；未输出凭据。
- [x] 已保存 `/opt/hziee-atrust-qr/main.js.before-password` 原入口；一次性检查文件已进行 Node 语法检查。官方页面已加载英文账号密码表单，SDK 为模块导出；原全局 SFSDP 不存在，不能按全局函数调用。客户端包包含两套网页资源，已定位两套 master 模块的密码认证导出。
- [x] 凭据临时落盘首次被自动审批拒绝；用户随后明确批准通过 Termius SFTP 上传至上海服务器的权限 600 临时文件，完成后删除副本。另已明确批准 Termius 截图检查；Git 推送仍未获本次明确批准。
- [x] 通过系统 Window 菜单 Zoom 恢复 Termius 窗口，终端文本读取恢复。更新后的检查文件远程 SHA-256 与本机一致，由官方 master 模块实际提交一次 ShenLan 密码认证。
- [x] 官方模块返回 BusinessError，code=75500000，message="The characters has expired. Please try again"，graphCheckCodeEnable=1、nextService=auth/psw。需要图形验证码，不能据此判定账号密码正确或错误；官方状态仍为 logout。
- [x] 已恢复原客户端入口，SHA-256 为 `6dc575935b73d7a932294c54f873341eb8a018d815d020c177e0f3d1a6be6af4`，与原二维码包装入口一致。远程两份临时凭据均已删除并分别检查不存在；一次性运行模块已清理，本机生成的凭据副本也已删除，原 TOML 保留。
- [x] 恢复后容器 running、重启 0，二维码 service active，网页 HTTP 200，官方状态 logout；未使用 VNC。
- [x] 后续用户要求代理点选验证码，已完成官方登录及校内代理验证，见上节。

## Shanghai-Aliyun 试部署（2026-11-23）

- [x] 读取项目部署及历史记录，确认使用官方 aTrust 和现有二维码组件。
- [x] Termius 当前窗口和会话名称为 Shanghai-Aliyun；使用现有终端及 SFTP。终端执行 clear 后全选复制到 Snippets 搜索字段读取最新文本，读取后清空，避免长字段截断历史；未截图。
- [x] 服务器 Debian 13 amd64，内存约 1.8 GiB、根分区可用约 37 GiB，TUN 存在，初始仅监听 SSH。两台学校数据节点 10441 TCP 均退出 0，认证入口返回 HTTP 302。
- [x] 安装 Docker 26.1.5、Compose 2.26.1 和 socat，Docker active。服务器直连 Docker Hub 超时、GitHub raw 连接重置，改由本机下载固定摘要镜像后通过 SFTP 上传。
- [x] 四份现有二维码组件已通过 SFTP 上传；本机三项 Node 边界测试及两份组件语法检查通过。
- [x] 镜像清单摘要为 `sha256:d564515395c2eabdbd78152ad47ea11e6d01a41b94435509ac1b8ddff79ffe26`，本机下载及远程上传归档的 SHA-256 均为 `4d26bace861850a74d6d520ba051867f97d392d50f167acb0583bbb15fb38112`。Docker 导入后镜像 ID 为 `sha256:e924a8105239be21fdb77cdca708e2949d548ebb6eead0ba589e54e3ff3d0d14`。
- [x] `/opt/hziee-vpn/data` 保存新客户端数据，`/opt/hziee-atrust-qr` 保存部署文件和原入口备份。官方客户端版本 2.5.16.20，容器 `hziee-vpn-atrust-1` running、重启 0；二维码 service active、enabled，systemd 单元校验通过。未改动 HK-AK。
- [x] 服务器网页 HTTP 200，无令牌状态请求与错误 Host 均 HTTP 403，当前令牌状态请求成功。1080、8888、28081 仅监听 127.0.0.1。学校入口通过官方 visitHistory 工具写入，返回 code=0、error.value=0。
- [ ] 取得客户端二维码：状态仍为 logout、image=null，刷新及连续五次状态轮询没有二维码；一次刷新返回 502，组件日志为 `target closed while handling command`。学校连接检测日志返回 connectSuc=true、sdpcAddr=true；当前仅有客户端 index/tray 页面，尚未确定缺少二维码的原因。
- [ ] 完成本机 SSH 转发：新转发尚未完成，未完成的规则已放弃，没有修改原 HK-AK 转发。用户随后已批准 Termius 截图检查；密码认证试验没有依赖新转发。
- [x] 用户改为密码与验证码登录，已验证官方 online 和校内两种代理；分钟复测见上节。
- [x] 保存本轮实际部署和验证结果；Git 状态见开发日志。
- [ ] 提交及普通推送：自动审批两次拒绝当前 origin/master 的文档提交与推送，要求本次明确批准。五份脱敏文档保留在工作区，未暂存，远端未变更。

## 复用原官方部署并提供网页链接（2026-11-21 23:04）

- [x] 核对原官方容器固定镜像，容器 running、重启计数 0；二维码 service active，服务器仅监听回环 28081，网页 HTTP 200。
- [x] 连接 Termius `HZIEE DingTalk` 本地转发，本机网页 HTTP 200；在 HK-AK 终端输出完整访问链接。三项 Node 边界测试及组件语法检查通过。
- [x] 本轮起始状态为 logout、image=null；重启原容器后重新打开登录页面，网页已显示 VPS 官方客户端真实二维码，图片加载成功、尺寸 180×180。原配置和数据保留。
- [x] 终端重新输出轮换后的完整链接，应用内浏览器已打开并保留扫码页，全程未使用 VNC；复用现有组件，未修改客户端代码或部署配置。
- [x] 23:09 网页显示客户端 online；校内测试目标的容器路由经过 utun7。
- [ ] 23:15 按用户要求通过 VPS 回环 8888 HTTP 代理请求校内保活地址：curl 退出 52、Empty reply from server，HTTP 000、0 字节、耗时 0.045432 秒。请求未成功，未配置定时保活。

## 改为官方 aTrust 客户端（2026-11-21）

- [x] 用户明确要求官方 aTrust，网页只展示该客户端二维码，继续不使用 VNC。
- [x] 官方容器运行镜像 `hagb/docker-atrust`，客户端资源版本 2.5.16.20；组件部署前的本地 HTTPS 状态接口返回 `code=0`、`status=logout`。此前 Go 扫码容器已停止，原 aTrust 容器保留。
- [x] 用户同意 REA 分析后，对五份客户端脚本完成静态分析；3 项来源、令牌及图片边界测试通过，不以此替代真实登录。
- [x] 官方客户端 `src/main.js` 包装入口加载原主文件 `main.before-qr.js`，包清单恢复原内容；备份还保存在 `/opt/hziee-atrust-qr/`。组件位于原数据挂载 `.atrust-qr/`，原配置与数据保留。
- [x] `atrust-qr.service` 通过 Docker 转发官方客户端回环端口，宿主机仅监听 127.0.0.1:28081；服务器与本机网页 HTTP 200。旧 Go 扫码容器停止。
- [x] 实际从客户端 `web/qrcode.html` 与钉钉 `oauth2/challenge.htm` 连续读到二维码；过期后的原有控件刷新检查失败后，改为只在 logout 状态重新打开官方登录窗口。
- [x] `69eea0c` 已部署。按用户“重新获取”在应用内浏览器实际点击刷新，10.8 秒内显示新二维码图片及官方客户端提示，页面已更新。Node 边界及语法检查通过，Actions `44892973042` 的 test/image 均成功。
- [x] 18:17 用户要求检查后，网页及官方本地 HTTPS 接口均确认 `online`，接口 `code=0`；扫码登录成功。容器 running、重启 0；`utun7` 含 UP/LOWER_UP、有地址，校内测试目标的实际路由使用 `utun7`。
- [ ] 校内访问与保活：HTTP/SOCKS5 请求测试目标均为空响应，HTTP 000、0 字节，curl 退出 52。两台学校节点 10441 TCP 各等 5 秒均超时，退出 124；具体失败原因未确定，没有执行成功连接后的分钟保活。本次未重启、退出登录或修改配置。
- 重建容器或升级客户端需要重新接入组件，重启会轮换页面令牌。

## 修复扫码后网页无反应（2026-11-21）

- [x] 实际网页显示过期，服务器只有刷新请求、没有继续认证；未手动重启或退出原会话。
- [x] 官方新版登录脚本把成功消息的 targetOrigin 设置为学校回调域名，与 localhost 父页面不符。学校同时提供临时码流程，官方 `qrcode.htm` 使用 `window.parent.postMessage(code, '*')`，可由接收端严格核对来源。
- [x] 回归测试先确认旧版生成了受域名限制的 OAuth iframe、回调参数不匹配；改为学校临时码接口，服务端兑换并校验学校回调。错误提示保留，过期/刷新窗口拒绝旧消息。
- [x] Go 全部测试、Go vet、消息来源及格式检查、10 项验证码测试和 Compose 校验通过；本机原生客户端实际从学校配置加载 `/login/qrcode.htm` 二维码。
- [x] Linux amd64/arm64 编译通过；修复提交 `3763bb8dcb7e98cff1985683afa9d6cf0aa21b9d fix: relay DingTalk temporary codes from localhost` 已普通推送。GitHub Actions `44875918557` 的 test/image 均成功。
- [x] HK-AK 已拉取并运行修复镜像，容器版本输出源码 `3763bb8`；扫码和原容器均 running、重启 0。网页与消息模块均实际 HTTP 200。
- [x] 复用用户应用内浏览器标签，换入修复版链接并刷新；真实钉钉 iframe 显示二维码图片和扫码提示。没有改动原配置与会话，未使用 VNC。
- [x] 用户两次实际扫码后，14:37:59 和 14:38:18 收到临时码，已完成钉钉兑换并进入学校接口；均在学校 302 跳转的票据解析阶段失败，网页提示“学校认证跳转无效”。
- [x] 新回归测试实际暴露共享票据解析器错误拒绝显式/省略 HTTPS 默认端口的等价来源；修复为主机名与有效端口校验，仍拒绝外域、非默认端口、用户信息及不同路径。新增跳转结构诊断，不输出查询值或票据。
- [x] 默认端口校验修复 `f3a61a5` 已普通推送；GitHub Actions `44876942487` 的 test/image 均成功。HK-AK 已拉取运行对应版本，网页实际 HTTP 200。
- [ ] 核对修复后的真实学校跳转；当前只确认默认端口缺陷可复现，尚未取得此前失败跳转的原始结构。应用内浏览器已更新本轮访问链接，等待用户实际扫码。

## 独立钉钉扫码网页（2026-11-21）

- [x] 用户选择不使用 VNC 的二维码网页；HK-AK 的 28081 无监听。
- [x] 实际查询学校认证信息，钉钉使用 `auth/dingtalk`；Go 客户端已接入学校新版钉钉扫码配置及回调。
- [x] 核对官方 `qrcode.html`、`scan_common.js` 与钉钉 SDK；实现独立网页及新版扫码回调接入，不使用 VNC。
- [x] 本机实际取得学校扫码配置，浏览器加载钉钉 iframe，页面含二维码 canvas；刷新后实际获得 60 秒有效期。未执行截图或用户扫码确认。
- [x] 新登录类型测试先确认旧工厂拒绝 `auth/dingtalk`；安全边界补测后 Go 全部测试与 Go vet 通过。10 项 Python 测试、原生/Linux amd64/arm64 编译、JavaScript 语法及两份 Compose 校验通过。
- [x] 功能随 `072786709e346ce5f629a04c9cd663ab8c37b7f5 feat: add headless DingTalk QR login page` 普通推送；GitHub Actions `44874060686` 的 test/image 均成功。
- [x] HK-AK `/opt/hziee-dingtalk` 已部署，源码版本输出 `hziee-072786709e346ce5f629a04c9cd663ab8c37b7f5`。Compose 与 TOML 的 SHA-256 和本地一致；目录和数据权限 700、配置权限 600。
- [x] 新容器 running、重启计数 0；网页和代理仅监听回环 28081/11081/18889。原容器 running、重启计数 0，配置与会话保留。
- [x] Termius 保存并连接 `HZIEE DingTalk` 本地转发；远程网页、本机转发网页和带令牌配置接口均为 HTTP 200。浏览器使用服务器真实配置加载钉钉 iframe，点击刷新后取得有效二维码配置。
- [ ] 等待用户本人在钉钉扫码确认，再验证学校回调、VPN 隧道、代理请求与分钟保活；当前没有宣称这些项目通过。
- 镜像摘要为 `sha256:903be76106df0bcf0ab2ffd352920b213a3155cd3437c15c7d7620b3a8198da0`。完整访问令牌仅保留在私密日志与浏览器，不写入 Git。

## HK-AK 钉钉扫码重试（2026-11-21）

- [x] 远程桌面恢复连接，官方图形客户端显示已登录工作台；本轮未退出或重新扫码。工作台已保留并交回用户。
- [x] HTTP/SOCKS5 访问校内测试地址均为空响应，HTTP code 000、0 字节，curl 退出 52。
- [x] 绕过代理直接请求同一测试地址，连接被重置，curl 退出 56。无法确认校内访问恢复，未执行成功连接后的分钟保活。
- [x] 临时私密副本均已清理，原凭据、部署配置和会话保留；记录不含本轮具体内部地址或认证详情。
- [x] 脱敏检查记录已随 `9bce64a` 提交并普通推送至 origin/master。

## HK-AK 再次复测（2026-11-21 12:40）

- 两台学校数据节点的 10441 TCP 连接各等待 10 秒，均超时，退出 124。
- 学校认证入口 HTTPS 返回 302，耗时 0.839961 秒，curl 退出 0；旧容器为 Up 17 hours。
- 数据节点连接未恢复，本次未重新发起验证码登录，未修改配置或服务器设置。

## 官方 ZJU-Connect 对照登录（2026-11-20）

- 用户最终明确目标为 HK-AK，已通过该 Termius 会话完成官方 `mythologyli/zju-connect:1.3.1` 的完整登录重试。
- [x] 官方镜像已拉取，摘要 `sha256:6e14b16b979fd76a205b8da97d937574fedcd72f9dc2c99a435644778f1d6ed8`；`-version` 输出 `ZJU Connect v1.3.1`，退出 0。
- [x] 官方容器 `hziee-zju-upstream-test` 已复用原配置启动 aTrust / auth/psw / ShenLan 登录，用户完成验证码提交。
- 独立数据目录 `/opt/hziee-headless/upstream-test-data` 权限 700，日志 `upstream-login.log` 权限 600；只读挂载原配置。测试代理仅绑定 127.0.0.1:11081（SOCKS5）、18889（HTTP），旧容器保持 Up，未修改原 Compose。
- 验证码网页使用现有 Python 脚本并指定独立图片路径；现有 HZIEE Captcha SSH 转发已连接，本机 HTTP 检查返回 200。随机令牌未写入 Git。
- [x] 日志确认用户验证码重试后，于本地时间 21:52:01 获取并解析学校 clientResource，21:52:08 报 `VPN client setup error: no reachable node for ip request`；未出现 `VPN client started`，独立数据目录只有验证码图片，没有保存会话。
- [x] 最终 docker ps -a 只显示旧容器 `hziee-vpn-atrust-1` 为 Up 3 hours；官方一次性容器已退出，测试端口 11081/18889 和网页 18081 均已释放，旧容器未停止，原配置与 Compose 未改动。
- 官方和自建镜像在 HK-AK 均于节点探测阶段失败；此次未建立隧道，因此没有执行官方客户端的 HTTP/SOCKS5 校内请求与 60 秒保活检查，具体网络过滤或路由原因仍未确定。
- [x] 实际结果和开发记录已随 `57934be` 提交并普通推送至 origin/master。

## 英国服务器网络对照（2026-11-20）

- [x] 按用户截图指定的 Termius 会话 UK-Happa-GreenCloud 执行只读连接检查。
- 两台学校节点 `124.160.40.2:10441`、`124.160.107.90:10441` 的 TCP 与 TLS 检查各等待 8 秒，四项均超时，退出 124。
- 直接访问 `https://vpn.hziee.edu.cn/` 返回 HTTP 302，耗时 1.918342 秒，curl 退出 0；认证入口 HTTPS 可达，数据节点连接失败。
- 英国与香港 VPS 均无法连接这两个数据节点，不能将现象归因于 HK-AK 单个公网 IP 被封；具体过滤或路由原因尚未确定。
- 未上传配置、安装程序、运行登录或更改英国服务器设置；未修改 HK-AK。仅更新脱敏检查记录。

## 部署到 HK-AK（2026-11-20）

- 19:23 按用户要求重试：HK-AK 到两台学校节点的 10441 TCP 检查各等待 5 秒，均退出 124；旧容器仍为 Up，新目录仍只有验证码图片、没有会话文件。未再次触发验证码登录或切换服务，网络连通性阻碍未解除。
- [x] 确认 Termius 目标主机和现有部署，建立恢复点。
- [x] 上传用户配置和部署文件，拉取并核对用户镜像。
- [ ] 完成密码登录与后台运行：验证码提交后进入资源解析，节点探测失败，客户端退出。
- [ ] 网络恢复后验证新服务的 HTTP/SOCKS5 校内访问和 60 秒保活。
- [x] 更新部署阻碍记录，提交 `5dc23e8` 并普通推送至 origin/master。
- Termalin 账户限制仍存在，改用用户偏好的 Termius。
- 用户已确认 hi-Al 指 Termius 中的 HK-AK，目标为 Debian 13 amd64；现有 `hziee-vpn-atrust-1` 占用 1080/8888，仅监听回环地址。
- 旧部署位于 `/opt/hziee-vpn`，独立新目录使用 `/opt/hziee-headless`，保留旧配置、容器和数据。
- 本次本地 Compose config 与 10 项验证码测试通过。Termius SFTP 已上传四份部署文件，配置 SHA-256 与本地一致；配置和登录日志权限为 600。
- 服务器拉取镜像摘要与发布记录一致，`-version` 输出源码提交 `6f871ae`，服务器 Compose config 退出 0；三个公开部署文件 SHA-256 与本地一致。
- 旧 Compose 备份为 `/opt/hziee-vpn/compose.yaml.before-headless`，旧配置和数据保留。新登录失败后已重新启动旧容器 `hziee-vpn-atrust-1`，确认 Up；其 HTTP 代理请求校内地址超时，退出 28，不能声称旧 VPN 已恢复可用。
- 用户已通过网页提交验证码；首次校验失败后自动换图，后续进入节点探测，最终 `VPN client setup error: no reachable node for ip request`。一次性新容器和验证码网页已退出，未生成可恢复会话，未启动后台 Compose 服务。
- Termius 已保存 `HZIEE Captcha` 本地转发 127.0.0.1:18081 → HK-AK 127.0.0.1:18081；已结束的验证码标签已关闭。随机访问令牌只在服务器私密日志中，不写入 Git。
- HK-AK 到两台已知学校节点的 10441 端口 TCP 和 TLS 均超时，timeout 退出 124；本机到同样节点完成 TLS 1.3 握手，随后 HTTP 探测为空响应（curl 52，节点为 VPN 协议，未记作 HTTP 成功）。服务器 OUTPUT 为 ACCEPT，节点使用正常默认路由；学校入口 443 TCP 可连接，TLS 检查超时。
- 当前恢复条件：先解决 HK-AK 到学校 VPN 节点的连通性，再在 `/opt/hziee-headless` 运行 `python3 captcha_web.py` 重试；与旧容器共用端口，重试前需停止旧容器。未修改防火墙或路由，未改动客户端源码或本地凭据。

## 从源码构建信工 VPN 镜像（2026-11-20）

- [x] 读取现有配置与实际依赖；克隆上游 v1.3.1，核对提交 `5d7f5b11fcf231f72a0ec0d888bf0f2eadcce1da`。
- [x] 导入 132 个 Go 源码、模块和许可证文件；学校默认测试先因 easyconnect 默认值失败，修改学校默认配置后通过。相对克隆来源仅修改配置默认值和两个对应测试。
- [x] 完成从本地源码编译的多阶段 Dockerfile、GitHub Actions 测试/GHCR 多架构发布，Compose 改为本仓库 GHCR 镜像。
- [x] Go 全部测试与 vet、macOS arm64 和 Linux amd64/arm64 编译通过；10 项验证码测试、Compose、JavaScript 和工作流 YAML 检查通过。凭据与网页校验一致，Compose 仅改变镜像引用；说明与源码许可证已更新。
- [x] 源码提交 `6f871aeadffefd2367c34d46f7dcfdc313dbfb99` 已普通推送，触发 GitHub Actions `44721199266`。
- [x] GitHub Actions `44721199266` 的 test/image 两项成功，Linux amd64/arm64 镜像发布完成；容器 `-version` 输出源码提交 `6f871ae`。匿名读取 GHCR 清单成功，确认两种架构，镜像摘要为 `sha256:b8ee8094ec3dc2c0e759ccd4249d09605ddb8768a8650d365807e4ceefc34b59`。

## 环境与限制

- 本机无 Docker 引擎；已从 Go 官方下载 Go 1.27.4，SHA-256 与官方一致，保存在被忽略的 `.agent/work/password-source/`。
- 本地真实凭据与会话保持 Git 忽略；当前用户已授权部署到 HK-AK。
- 公开历史已脱敏，GitHub 旧对象缓存仍待 Support 处理；此前申请稿未发送。
