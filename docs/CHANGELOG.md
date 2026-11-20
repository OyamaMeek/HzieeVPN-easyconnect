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

- **Git 提交**：待提交。

---
