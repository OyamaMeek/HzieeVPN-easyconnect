# 当前设计与计划

## 仅保留信工 VPN 密码登录和验证码网页（2026-11-20）

1. 保存保留文件及本地凭据的 SHA-256、Compose 完整解析结果，增加精简范围检查并确认清理前失败。
2. 保留 `deploy/hziee/compose.headless.yaml`、`headless.toml.example`、验证码 Python/HTML 与测试；删除扫码 Compose、通用 EasyConnect、Docker 构建链、辅助库、工作流和配套文档。
3. 首页和部署说明只描述密码登录、验证码、代理、会话与运维，保留原文件名和运行命令。
4. 运行精简检查、10 项 HTTP/管道测试、Compose 配置和 JavaScript 语法检查；核对凭据、会话与保留代码未改变。
5. 更新开发日志，提交并普通推送到已配置的 origin/master，补记实际提交哈希。

恢复点：`b789008afddb9443cbf49d4e86456eedbc96781f`。本次明确授权删除无关构建源码；不操作服务器或删除本地凭据、会话、历史备份。没有 Docker 引擎时仅验证配置，不宣称容器运行通过。无需视觉验证。
