# 杭电信工 aTrust 部署

学校入口：<https://vpn.hziee.edu.cn>，支持“上网账号(I-XG)”密码认证和钉钉扫码。

## 无图形界面部署（账号密码）

`compose.headless.yaml` 使用 ZJU-Connect 1.3.1 的 aTrust 协议实现，无需 VNC、浏览器、`NET_ADMIN` 或 TUN 设备。配置参考[客户端参数](https://github.com/Mythologyli/zju-connect/tree/v1.3.1)与[官方 Docker 用法](https://github.com/Mythologyli/zju-connect/blob/v1.3.1/docs/docker.md)。

在本目录操作，先准备仅本机保存的配置文件；已有配置时不要重新复制：

```bash
cp -n headless.toml.example headless.toml
chmod 600 headless.toml
```

在编辑器中填写 `headless.toml` 的 `username` 和 `password`。示例已设置学校入口、`auth/psw` 和 `ShenLan` 登录域；该登录域对应服务器实际返回的“上网账号(I-XG)”。若使用其他类型账号，先查询认证方式，再使用对应 `loginDomain`：

```bash
docker compose -f compose.headless.yaml config --quiet
docker compose -f compose.headless.yaml run --rm vpn -auth-info
```

若同一服务器已运行图形版，先停止它以释放代理端口，再以前台交互模式完成首次登录：

```bash
docker compose -f compose.yaml stop atrust
docker compose -f compose.headless.yaml run --rm --service-ports -it vpn
```

新安装无需执行停止图形版的命令。客户端若提示图形验证码或短信验证码，按终端提示完成验证；验证码图片保存在 `headless-data/captcha.png`。首次登录成功后，用另一终端验证内网地址：

```bash
curl --noproxy '' --proxy http://127.0.0.1:8888 --max-time 15 http://10.130.10.75/
```

然后按 `Ctrl+C` 结束前台容器，启动后台服务：

```bash
docker compose -f compose.headless.yaml up -d
docker compose -f compose.headless.yaml logs --tail=50 -f vpn
```

登录后客户端立即向 `http://10.130.10.75/` 发送 HTTP GET，之后每 60 秒执行一次，单次请求最多 10 秒；日志会记录响应状态。HTTP 错误状态仍表示已收到响应，需结合实际状态码确认业务可用。会话保存在 `headless-data/`，容器配置自动重启和日志轮换。

仅开放 `127.0.0.1:1080`（SOCKS5）与 `127.0.0.1:8888`（HTTP），可继续使用现有 Termius 代理转发。`headless.toml` 和 `headless-data/` 已加入 Git 忽略规则；不要提交或分享凭据和会话数据。

恢复图形版时执行，原有 `.env` 和 `data/` 保留：

```bash
docker compose -f compose.headless.yaml stop vpn
docker compose -f compose.yaml up -d atrust
```

本地原生客户端已使用真实账号完成密码认证，并验证 HTTP / SOCKS5 访问目标网址均返回 HTTP 200；恢复已保存会话时无需重复验证码。服务器尚未切换，本机未运行 Docker 容器。

## HK-AK 当前部署

- 服务器：`example.com:22`，Debian 13，amd64。
- 目录：`/opt/hziee-vpn`。
- 容器：`hziee-vpn-atrust-1`，使用本目录的 `compose.yaml`。
- Docker 服务开机启动；容器配置 `restart: unless-stopped`。
- `.env` 保存自动生成的 8 位 VNC 密码，权限为 600；`data/` 保存客户端配置。
- 镜像固定为 Docker Hub 上 hagb/docker-atrust 的已验证摘要。

所有端口仅监听服务器 `127.0.0.1`：

| 端口 | 用途 |
| --- | --- |
| 8080 | noVNC 网页 |
| 5901 | VNC |
| 1080 | SOCKS5 代理 |
| 8888 | HTTP 代理 |
| 54631 | aTrust 浏览器认证回调 |

## 登录

Termius 中已创建并启动以下本地转发规则，均仅绑定本机 127.0.0.1：

| 规则 | 本机端口 | HK-AK 目标 |
| --- | --- | --- |
| HZIEE noVNC | 18080 | 127.0.0.1:8080 |
| HZIEE HTTP | 18888 | 127.0.0.1:8888 |
| HZIEE SOCKS5 | 11080 | 127.0.0.1:1080 |

1. 保持 Termius 的转发规则运行，打开 <http://127.0.0.1:18080/>。
2. 从服务器 `/opt/hziee-vpn/.env` 读取 `VNC_PASSWORD`，输入 noVNC。
3. 在 aTrust 中填写学校入口并选择钉钉扫码，由本人完成认证。

本次已通过 aTrust 内嵌的钉钉二维码完成登录。会话到期后可能需要重新扫码。

## 使用代理

保持 Termius 中对应转发规则运行，在应用中设置 HTTP 代理 `127.0.0.1:18888`，或 SOCKS5 代理 `127.0.0.1:11080`。SOCKS5 应启用代理端 DNS 解析。

例如，在本机执行：

```bash
curl --socks5-hostname 127.0.0.1:11080 https://vpn.hziee.edu.cn
curl --proxy http://127.0.0.1:18888 https://vpn.hziee.edu.cn
```

服务器上的程序可直接使用 `127.0.0.1:1080` 或 `127.0.0.1:8888`。宿主机路由未配置为全局 VPN，应用需要显式使用代理。

## 运维

以下命令适用于图形版；无图形版需加 `-f compose.headless.yaml`。

在服务器执行：

```bash
cd /opt/hziee-vpn
docker compose config --quiet
docker compose ps
docker compose logs --tail=50
docker compose restart
```

日志已限制为每份 10 MB、最多 2 份。不要把 `.env` 或 `data/` 提交到 Git。

图形版配置也已设置 `PING_ADDR_URL=http://10.130.10.75/`、`PING_INTERVAL=60`，复用现有 HTTP 探测。每轮等待 60 秒后探测，单次最多 10 秒。将本次更新后的 `compose.yaml` 放入部署目录，再运行 `docker compose up -d atrust` 才会应用新的环境变量；`restart` 不会应用配置变更。

## 验证记录

2026-11-20（Asia/Taipei）：

- 已安装 Docker 26.1.5 和 Compose 2.26.1，Docker 服务 active。
- 学校入口从服务器请求返回 HTTP 200。
- `docker compose config --quiet` 成功，拉取和启动退出码 0。
- 容器 running，重启次数 0，OOMKilled=false。
- 5 个映射端口均只监听 127.0.0.1。
- noVNC 从服务器和本机 SSH 隧道均可访问，已由用户完成钉钉扫码，界面显示学校工作台。
- utun7 已分配 IPv4 地址，学校下发的内网路由已存在。
- 本机分别通过两个代理访问学校入口，均返回 HTTP 302，curl 退出码 0。
- 登录后容器检查时使用约 532 MiB 内存，服务器剩余磁盘约 2.2 GB。
- 启动日志存在 D-Bus、aTrustShell.conf 权限和 bsod_checker.js 异常；本次已完成认证及 VPN 接口建立，长期稳定性未验证。
- 具体校内业务系统尚未验证；对一条已下发路由中的 IP 发起 HTTP 请求未取得有效响应。
- 终端二维码输出未完成；本次扫码在图形界面完成。

本次项目配置检查：

- 两份 Compose 均通过 Docker Compose 5.8.0 的 `config --quiet`；图形版校验使用临时环境值，仅验证配置展开，未启动容器。
- 配置断言、原启动脚本 `bash -n` 和 `git diff --check` 通过；凭据、会话和验证工具均被 Git 忽略。
- Docker Hub 确认 `mythologyli/zju-connect:1.3.1` 的 Linux amd64、arm64 镜像存在。
- ZJU-Connect 1.3.1 成功解析 `headless.toml.example`，并通过 `-auth-info` 实际查询学校服务器，退出码 0；“上网账号(I-XG)”返回 `loginDomain=ShenLan`、`authType=auth/psw`。
- 本机通过现有 HTTP 18888 代理访问 `http://10.130.10.75/`，10 秒无响应，curl 退出码 28。
- 本地真实账号测试：学校服务器要求点选图形验证码，完成后密码认证成功，客户端启动；没有要求短信验证码。
- HTTP 8888 和 SOCKS5 1080 均仅监听 127.0.0.1；通过两者访问目标网址均返回 HTTP 200，响应体各 7624 字节。
- 结束客户端后读取同一会话文件重启，日志显示 `Already logged in`，没有再次要求图形验证码；会话恢复后的首次保活返回 HTTP 200。
- 实际保活日志：13:35:35、13:36:35 均返回 HTTP 200，间隔 60 秒；测试进程已结束，本机测试代理端口已释放。
- 真实配置和测试会话文件权限为 600；测试数据保存在已忽略的 `.agent/work/login-test/`，不提交账号、密码或会话。
- 本机未安装 Docker 引擎，容器启动及 HK-AK 迁移尚未验证。
