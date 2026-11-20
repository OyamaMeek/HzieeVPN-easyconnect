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

首次部署图形版时，在本目录的 `.env` 中设置 `VNC_PASSWORD`（最多 8 个字符）；已有配置保留原密码。若无图形版正在运行，先停止它以释放代理端口，再执行：

```bash
chmod 600 .env
docker compose -f compose.yaml config --quiet
docker compose -f compose.yaml up -d atrust
```

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

## 验证范围

2026-11-20 已完成服务器图形版扫码登录，以及本机原生客户端的真实密码登录、代理访问、会话恢复和 60 秒保活验证。详细过程保存在 `memory/verify.md` 和 `docs/CHANGELOG.md`。

本次精简仅修改仓库文件，两份 Compose 和学校参数保持不变。本机缺少 Docker 引擎，未重新运行容器、切换服务器或验证长期稳定性。
