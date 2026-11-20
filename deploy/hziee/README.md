# 杭电信工 aTrust 部署

学校入口：<https://vpn.hziee.edu.cn>，采用钉钉扫码认证。

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

在服务器执行：

```bash
cd /opt/hziee-vpn
docker compose config --quiet
docker compose ps
docker compose logs --tail=50
docker compose restart
```

日志已限制为每份 10 MB、最多 2 份。不要把 `.env` 或 `data/` 提交到 Git。

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
