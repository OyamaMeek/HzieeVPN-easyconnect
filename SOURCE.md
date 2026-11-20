# 客户端源码来源

本仓库客户端源码通过 `git clone --depth 1 --branch v1.3.1 https://github.com/Mythologyli/zju-connect.git` 获取，上游固定提交为 `5d7f5b11fcf231f72a0ec0d888bf0f2eadcce1da`。

保留上游完整 Go 源码、`go.mod`、`go.sum`、测试与许可证。学校修改位于 `configs/config.go`：默认使用 aTrust、`vpn.hziee.edu.cn:443`、密码认证 `auth/psw`、登录域 `ShenLan`、HTTP 代理端口 8888 和学校保活地址。对应测试同步采用学校默认值。底层依赖和其他协议代码保留上游结构，避免破坏完整编译链。

根目录 `Dockerfile` 从本仓库源码执行 `go build`，GitHub Actions 运行测试并向 GHCR 发布 linux/amd64、linux/arm64 镜像。运行镜像只包含编译结果及许可证，账号密码和会话通过部署时挂载提供。

ZJU-Connect 源码遵循上游 [AGPL-3.0](LICENSE)；文件中的其他版权声明和 `internal/ping/LICENSE` 保持原样。原 docker-easyconnect 来源的 [WTFPL](LICENSE.txt) 仅适用于对应原有内容，不能覆盖导入的客户端许可证。
