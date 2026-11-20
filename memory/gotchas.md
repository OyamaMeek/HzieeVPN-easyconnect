# 注意事项

- 用户偏好直接操作已登录的 Termius 会话，优先复用该会话。
- 钉钉扫码需图形界面或浏览器认证，命令行 EasyConnect 不支持本任务的登录方式。
- 学校入口包含 aTrust 标识，应按 aTrust 部署，不能仅根据仓库名称选择 EasyConnect。
- Termius 命令使用 paste 并单独 Return，避免 typeText 丢失 shell 标点。
- Debian 13 使用 --no-install-recommends 安装 docker.io 时需显式安装 docker-cli。
