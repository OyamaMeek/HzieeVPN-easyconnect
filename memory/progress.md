# 进度

## 从源码构建信工 VPN 镜像（2026-11-20）

- [x] 读取现有配置与实际依赖；克隆上游 v1.3.1，核对提交 `5d7f5b11fcf231f72a0ec0d888bf0f2eadcce1da`。
- [x] 导入 132 个 Go 源码、模块和许可证文件；学校默认测试先因 easyconnect 默认值失败，修改学校默认配置后通过。相对克隆来源仅修改配置默认值和两个对应测试。
- [x] 完成从本地源码编译的多阶段 Dockerfile、GitHub Actions 测试/GHCR 多架构发布，Compose 改为本仓库 GHCR 镜像。
- [x] Go 全部测试与 vet、macOS arm64 和 Linux amd64/arm64 编译通过；10 项验证码测试、Compose、JavaScript 和工作流 YAML 检查通过。凭据与网页校验一致，Compose 仅改变镜像引用；说明与源码许可证已更新。
- [ ] 提交并普通推送，跟踪 GitHub 构建和镜像发布，补记实际结果。

## 环境与限制

- 本机无 Docker 引擎；已从 Go 官方下载 Go 1.27.4，SHA-256 与官方一致，保存在被忽略的 `.agent/work/password-source/`。
- 本地真实凭据与会话保持 Git 忽略；本次不操作服务器。
- 公开历史已脱敏，GitHub 旧对象缓存仍待 Support 处理；此前申请稿未发送。
