# 进度

## 部署到 HK-AK（2026-11-20）

- [x] 确认 Termius 目标主机和现有部署，建立恢复点。
- [x] 上传用户配置和部署文件，拉取并核对用户镜像。
- [ ] 完成密码登录与后台运行：验证码提交后进入资源解析，节点探测失败，客户端退出。
- [ ] 网络恢复后验证新服务的 HTTP/SOCKS5 校内访问和 60 秒保活。
- [ ] 更新部署阻碍记录，提交并推送。
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
