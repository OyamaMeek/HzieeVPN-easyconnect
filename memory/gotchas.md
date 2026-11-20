# 注意事项

- “仅保留账号密码登录和验证码网页”包含对应客户端源码及完整可编译依赖链；不得用成品镜像替代。用户已明确要求克隆 ZJU-Connect、设置学校地址并由 GitHub 编译镜像，保留完整源码、测试和许可证。

- 公开仓库的代码、说明、memory 和开发日志均须脱敏；部署授权不包含公开真实 VPS 地址。SSH 示例使用明确标注的占位符，提交前检查全部待提交文件。
- 历史脱敏只重写受影响提交区间，保留此前上游提交及签名；强制更新远端必须有明确授权并使用带预期旧哈希的 --force-with-lease。
- 用户偏好直接操作已登录的 Termius 会话，优先复用该会话。
- 选择客户端前确认实际认证方式；用户已补充门户直接密码登录条件，不能继续假设只能钉钉扫码。
- EasyConnect CLI 不支持 aTrust；密码登录可使用 ZJU-Connect 的 aTrust 模式，先用 `-auth-info` 查询真实登录域，不猜测为 Radius。
- 学校入口包含 aTrust 标识，应按 aTrust 部署，不能仅根据仓库名称选择 EasyConnect。
- Termius 命令使用 paste 并单独 Return，避免 typeText 丢失 shell 标点。
- Debian 13 使用 --no-install-recommends 安装 docker.io 时需显式安装 docker-cli。
- ZJU-Connect 1.3.1 的终端验证码输入使用包含 `coordinates`、`width`、`height` 的完整 JSON 对象；宽高采用验证码原图尺寸。
