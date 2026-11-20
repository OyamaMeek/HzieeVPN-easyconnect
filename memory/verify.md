# 当前验证标准

- 上游源代码、Go 模块校验文件、协议依赖和许可证必须完整纳入 GitHub，镜像构建必须执行本地源码的 `go build`。
- 学校默认配置测试覆盖 aTrust、vpn.hziee.edu.cn:443、auth/psw、ShenLan、1080/8888 和校内 HTTP 保活；先确认测试因原默认配置失败。
- 运行 Go 全部测试、Go vet、原生编译和 Linux amd64/arm64 交叉编译；构建产物放入忽略目录。
- 运行 10 项验证码 HTTP/子进程测试、JavaScript 语法检查和 Compose 配置；验证码代码、真实配置与会话不得改变。
- Docker 构建上下文排除 .git、.agent、本地密码、会话和日志；镜像不得使用 mythologyli/zju-connect 成品镜像。
- GitHub Actions 实际完成测试、构建和 GHCR 发布后，检查多架构镜像清单与工作流结果；失败时修正并跟踪完成。
- 提交仅包含源码、构建、配置、测试与文档；运行 git diff --check，普通推送后核对远端。
- 本次不操作服务器或重新登录；没有实际运行的检查不得记为通过。

本地结果：学校默认测试首先因原默认协议 easyconnect 失败，修改后通过。Go 全包测试及 vet 通过，macOS arm64、Linux amd64/arm64 静态编译均退出 0，原生二进制 `-version` 正常。10 项验证码测试、Compose config、JavaScript 语法、工作流 YAML 和 diff 检查通过。`.agent/work/password-source/check.py` 核对 132 个导入文件，仅学校默认配置与两个对应测试区别于上游；验证码代码、TOML 示例、本地凭据及会话 SHA-256 一致，Compose 完整 JSON 仅改变镜像引用。GitHub 实际构建和发布待跟踪。
