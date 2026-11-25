# 杭电信工 VPN 登录

学校入口：<https://vpn.hziee.edu.cn>。当前 HK-AK 使用官方 aTrust 客户端及独立二维码网页；下文另保留 Go 客户端的部署说明。源码版本和许可证见[源码来源](../../SOURCE.md)。

## 官方 aTrust 客户端统一登录网页（密码验证码 + 钉钉扫码）

当前容器为 `hziee-vpn-atrust-1`，镜像为 `hagb/docker-atrust`，已检查的客户端资源版本为 2.5.16.20。`atrust_qr.cjs` 与 `atrust_qr.html` 在原 Electron 界面进程提供同一套登录网页，支持两种模式：

- **密码登录**：服务端直接通过官方 Electron 会话抓取图形验证码图片并映射到网页，用户在网页输入账号密码、按顺序点选验证码后，由服务器官方客户端内原有 `master` 密码模块完成加密与认证提交；每个验证码 `challenge` 仅允许提交一次，错误返回会脱敏账号与密码。
- **钉钉扫码**：服务端直接从官方 Electron 客户端钉钉登录框架提取二维码 PNG 并映射到网页，扫码回调、登录和 VPN 隧道均由服务器官方客户端处理，不在用户浏览器加载钉钉登录页。

统一登录镜像直接监听高位端口 `58081`（可通过 `ATRUST_WEB_PORT`、`ATRUST_LISTEN_PORT`、`ATRUST_PUBLIC_PORTS` 调整）。接口保留 `Host` 白名单与同源 `Origin` 校验，免访问令牌直连访问 `http://<服务器IP>:58081/`；客户端完成认证进入 `online`/`login` 状态后，网页会显示本机 SOCKS5 开放端口（默认 `127.0.0.1:1080`，可通过 `ATRUST_SOCKS_PORT` 调整；容器内 `danted` 固定不设置账号密码且仅允许本地连接），随后登录网页服务自动关闭监听以收敛暴露窗口。启动后 10 分钟未完成登录时也会自动关闭。会话过期需要重新登录时，重启容器即可再次拉起登录页。

镜像内默认启用每 60 秒保活（`PING_INTERVAL=60`、`PING_ADDR=10.130.10.75`、`PING_ADDR_URL=http://10.130.10.75/`），通过 `/usr/local/bin/keepalive-ping.sh` 定时向 `10.130.10.75` 发送 ICMP ping 与 HTTP 探测。镜像已移除与账号密码登录、钉钉扫码登录、映射网页及 SOCKS5/HTTP 代理无关的组件（TigerVNC、noVNC、`flwm`、`stalonetray`、`xclip`、`x11-utils`、EasyConnect 脚本、`CHROMIUM` 与 `FORWARD` 转发分支），改由无监听端口的无头 `Xvfb` 为官方 Electron 客户端提供显示环境，仅暴露 `1080`（SOCKS5）、`8888`（HTTP）与 `58081`（登录网页）。

对外开放高位端口时，建议仅在云服务器安全组或防火墙放行本人来源 IP，避免在不安全网络明文传输密码（建议前置 TLS 反向代理或仅在可信链路使用）。

在网页“密码登录”标签页点击“获取 / 刷新验证码”加载官方图形验证码并点选提交；在“钉钉扫码”标签页点击“刷新客户端二维码”触发官方客户端打开或刷新钉钉二维码。原客户端代理仍使用服务器回环 1080/8888，原有代理转发保持不变。

组件文件位于 `/opt/hziee-vpn/data/.atrust-qr/`。原主文件备份为 `/opt/hziee-atrust-qr/main.js.before-qr`，客户端内备份为 `src/main.before-qr.js`；`src/main.js` 使用本仓库包装入口调用原主文件，包清单保持原内容。部署文件位于 `/opt/hziee-atrust-qr`。日常检查：

```bash
systemctl status atrust-qr.service --no-pager
docker inspect -f '{{.State.Status}}' hziee-vpn-atrust-1
curl --fail http://127.0.0.1:58081/ --output /dev/null
```

登录完成后网页服务会自动关闭；若后续 VPN 会话过期需要重新登录，重启容器即可重新打开登录页。重新创建容器或升级官方客户端后，需要重新检查并接入组件。恢复原客户端入口时，使用已保存的备份：

```bash
systemctl stop atrust-qr.service
docker cp /opt/hziee-atrust-qr/main.js.before-qr hziee-vpn-atrust-1:/usr/share/sangfor/aTrust/resources/app/src/main.js
docker restart hziee-vpn-atrust-1
```

2026-11-21 23:06 已复核原官方容器及网页服务，恢复 Termius 28081 转发，并在终端输出完整链接。客户端起始状态为 logout；重启原容器后，网页已取得并加载客户端二维码，等待本人扫码。此前扫码登录成功时，校内 HTTP/SOCKS5 请求仍为空响应，两台学校数据节点 10441 TCP 检查超时；本轮尚未复测登录后的访问与保活。二维码页面不提供 VNC 或远程桌面。

## 独立 Go 客户端钉钉扫码

该部署当前已停止，官方客户端使用上一节入口。

`compose.dingtalk.yaml` 使用本仓库无图形客户端和学校的 `auth/dingtalk` 认证，不需要 VNC、桌面环境或账号密码。网页使用学校配置中的钉钉临时授权码接口，扫码确认后由服务器向钉钉兑换学校回调，并继续完成学校认证。

在本目录执行：

```bash
docker compose -f compose.dingtalk.yaml config --quiet
docker compose -f compose.dingtalk.yaml pull
docker compose -f compose.dingtalk.yaml up -d
docker compose -f compose.dingtalk.yaml logs --tail=30 -f vpn
```

网页仅映射到宿主机 `127.0.0.1:28081`。在本机建立 SSH 本地转发，也可以在 Termius 中保存相同规则：

```bash
ssh -N -L 127.0.0.1:28081:127.0.0.1:28081 root@example.com
```

`example.com` 是占位符，替换为自己的服务器地址与 SSH 用户名。打开日志中 `DingTalk login page:` 后的完整链接，保留 `#` 后的随机访问令牌。二维码由钉钉直接提供；使用钉钉扫码并在手机确认。过期后点击“刷新二维码”。网页最多等待 10 分钟；超时后容器按重启策略重新启动，链接令牌随之变化，请重新读取日志。登录认证完成后网页服务关闭，后续认证和 VPN 连接结果以客户端日志为准。

SOCKS5 使用宿主机 `127.0.0.1:11081`，HTTP 使用 `127.0.0.1:18889`，会话保存在 `dingtalk-data/`；与原有 1080/8888 服务使用不同端口和会话目录。登录后验证：

```bash
curl --noproxy '' --proxy http://127.0.0.1:18889 --max-time 15 http://10.130.10.75/
curl --noproxy '' --socks5-hostname 127.0.0.1:11081 --max-time 15 http://10.130.10.75/
```

重启、停止或更新此服务时，对上述命令继续使用 `-f compose.dingtalk.yaml`。认证会话有效时客户端自动恢复，无需重新扫码。原生运行时设置 `-auth-type auth/dingtalk -login-domain dingtalk`；网页默认绑定 `127.0.0.1:28081`，可通过 `dingtalk_bind` 或 `-dingtalk-bind` 指定监听地址。Compose 内部绑定 `:28081`，由宿主机端口映射限制本机访问。不要将会话目录或完整登录链接公开。

## 准备与首次登录

安装 Docker、Docker Compose 和 Python 3.9 或更新版本。在本目录操作；已有配置文件时保留原文件：

```bash
cp -n headless.toml.example headless.toml
chmod 600 headless.toml
```

在编辑器中填写 `headless.toml` 的 `username` 和 `password`。示例已设置学校入口、`auth/psw`、`ShenLan` 登录域和校内保活地址。确认 1080、8888 端口空闲，然后运行：

```bash
docker compose -f compose.headless.yaml config --quiet
docker compose -f compose.headless.yaml pull
python3 captcha_web.py
```

脚本默认启动一次性前台登录容器，并输出验证码网页完整链接。按图片提示依次点选并提交；其他二次认证在终端输入。登录成功后，在另一终端验证代理：

```bash
curl --noproxy '' --proxy http://127.0.0.1:8888 --max-time 15 http://10.130.10.75/
curl --noproxy '' --socks5-hostname 127.0.0.1:1080 --max-time 15 http://10.130.10.75/
```

按 `Ctrl+C` 结束前台登录，再启动后台服务：

```bash
docker compose -f compose.headless.yaml up -d
docker compose -f compose.headless.yaml logs --tail=50 -f vpn
```

会话保存于 `headless-data/`，会话有效时自动恢复。登录后客户端立即访问 `http://10.130.10.75/`，之后每 60 秒执行一次，单次最多 10 秒；日志记录响应状态。容器配置自动重启和日志轮换。

## 验证码网页

在本目录执行 `python3 captcha_web.py`。默认监听 `127.0.0.1:18081`；如需在服务器上通过高位端口直接放行验证码页面，可执行 `python3 captcha_web.py --host 0.0.0.0 --port 58081`（并在安全组放行对应高位端口）。启动链接带随机令牌，复制时需保留 `#` 及后面的内容。网页显示当前验证码与连接状态，支持顺序点选、撤销、清空、触摸操作和自动换图；聚焦图片后可用方向键移动、回车确认。坐标按原图尺寸换算，提交内容自动写入客户端 stdin。

图片保存在 `headless-data/captcha.png`。网页不提供账号密码或会话文件下载；脚本和登录进程退出后网页服务结束。同一主机上只启动一份使用这些代理端口的客户端。

在服务器部署时，在本机另开终端建立 SSH 隧道：

```bash
ssh -N -L 127.0.0.1:18081:127.0.0.1:18081 root@example.com
```

`example.com` 是占位符，请替换为自己的服务器地址，并使用自己的 SSH 用户名。也可在 Termius 中配置相同的本地转发。随后在本机浏览器打开服务器终端输出的完整链接。

需要纯终端输入验证码时执行：

```bash
docker compose -f compose.headless.yaml run --rm --service-ports -it vpn
```

本机原生 ZJU-Connect 也可使用此页面：用 `--image` 指定与客户端 `--graph-code-file` 相同的文件，在 `--` 后传入客户端命令。配置、会话和代理监听地址由客户端命令决定。网页端口可用 `--port` 指定，SSH 隧道两端使用相同端口。

## 使用代理与运维

代理仅监听宿主机 `127.0.0.1:1080`（SOCKS5）和 `127.0.0.1:8888`（HTTP）。宿主机程序需显式设置代理，SOCKS5 使用代理端 DNS 解析。远程使用时，在本机建立代理转发：

```bash
ssh -N -L 127.0.0.1:11080:127.0.0.1:1080 -L 127.0.0.1:18888:127.0.0.1:8888 root@example.com
```

应用使用 HTTP `127.0.0.1:18888` 或 SOCKS5 `127.0.0.1:11080`。服务器地址与用户名同样需要替换。

在部署目录执行日常命令：

```bash
docker compose -f compose.headless.yaml ps
docker compose -f compose.headless.yaml logs --tail=50 -f vpn
docker compose -f compose.headless.yaml restart vpn
docker compose -f compose.headless.yaml stop vpn
```

会话失效时，先停止后台服务，再运行 `python3 captcha_web.py` 重新登录。修改配置后运行 `docker compose -f compose.headless.yaml up -d` 应用变更。日志每份最多 10 MB，保留 2 份。`headless.toml` 和 `headless-data/` 已被 Git 忽略，请勿分享。

更新客户端源码后，等待 GitHub Actions 镜像发布成功，再执行：

```bash
docker compose -f compose.headless.yaml pull
docker compose -f compose.headless.yaml up -d
```

需要固定版本时，将 Compose 的镜像标签改为 GitHub Actions 对应的 `sha-完整提交哈希`。凭据和会话通过原路径挂载，更新镜像继续复用。

## 开发检查

在项目根目录运行：

```bash
node --test deploy/hziee/test_atrust_qr.cjs deploy/hziee/test_dingtalk_message.mjs
python3 -B -m unittest discover -s deploy/hziee -p 'test_captcha_web.py' -v
go test ./...
```

测试验证 HTTP 服务、真实子进程输入、请求鉴权、坐标检查及过期和重复提交处理。本机原生客户端此前已完成真实密码登录、网页点选、HTTP/SOCKS5 访问、会话恢复和 60 秒保活验证，历史记录见项目开发日志。GitHub Actions 负责验证源码测试、镜像构建和容器启动。服务器已实际拉取本仓库镜像并执行密码登录，节点探测报 `no reachable node for ip request`；服务器到学校节点 10441 端口的 TCP 检查超时，尚未完成服务器代理和保活验证。部署环境需能访问学校认证入口及其分配的 VPN 节点。
