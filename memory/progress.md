# 进度

- [x] 阅读 README、用法、FAQ、构建与启动脚本。
- [x] 读取学校入口完整 HTML，确认含 aTrust 客户端标识。
- [x] 用户指定通过 Termius；已确认 HK-AK 为 root / Debian 13 / amd64。
- [x] 完成环境检查：TUN 正常，无现有 Docker/服务端口冲突，约 1 GB 内存、剩余磁盘 3.7 GB。
- [x] 安装 Debian docker.io、docker-cli 和 docker-compose，Docker 服务已启动。
- [x] 通过 nano 写入 /opt/hziee-vpn/compose.yaml，仅绑定本机端口。
- [x] 部署图形版 aTrust：config 校验及启动退出码 0，running / restarts=0 / oom=false。
- [x] 验证 noVNC HTTP 200、5 个端口仅监听 127.0.0.1；容器约 430 MiB，剩余磁盘约 2.2 GB。
- [x] Termius noVNC 隧道 127.0.0.1:18080 → HK-AK 127.0.0.1:8080 已启动，本机能访问。
- [x] 用户输入 noVNC 密码后，进入 aTrust，填写学校入口并选择钉钉扫码。
- [x] 用户已通过图形二维码扫码成功，界面显示学校工作台；utun7 已分配 IPv4，并下发校内路由。
- [x] Termius 本机 HTTP 18888 → 8888、SOCKS5 11080 → 1080 已启动；两者访问学校入口均返回 302，curl 退出码 0。
- [x] 本机 aTrustAgent 占用 54631，回调规则已改为 HTTP 代理；此次内嵌扫码不需要该回调隧道。
- [ ] 终端二维码输出未完成。服务器 qrencode 已安装；图像传输发生编码损坏，期间用户已在图形界面完成扫码，当前二维码失效。
- [x] 启动异常日志未阻止本次登录及 VPN 建立，长期稳定性未验证。
- [ ] 具体校内业务系统未验证；单个下发路由 IP 的 HTTP 访问未取得有效响应，需要有效业务网址再验证。
- [x] 部署配置和验证记录已保存，提交 9839901 已普通推送到 origin/master；本次文档补记保存该提交哈希。
