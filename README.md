# HzieeVPN-easyconnect

杭州电子科技大学信息工程学院 VPN。当前服务器使用官方 aTrust 客户端，钉钉二维码通过独立网页展示，不使用 VNC；认证与隧道由官方客户端处理。学校入口：<https://vpn.hziee.edu.cn>。

官方客户端二维码入口及运维见[部署说明](deploy/hziee/README.md#官方-atrust-客户端二维码)。本仓库也包含从 ZJU-Connect 克隆的客户端源码，默认以学校“上网账号(I-XG)”登录；GitHub Actions 编译发布 `ghcr.io/oyamameek/hzieevpn-easyconnect:latest`。源码版本与许可证见[源码来源](SOURCE.md)。

## 编译镜像

推送源码到 `master` 后，[GitHub Actions](https://github.com/OyamaMeek/HzieeVPN-easyconnect/actions/workflows/build-image.yml) 自动运行 Go 和验证码测试，并从源码构建、发布 Linux amd64/arm64 镜像，同时保留 `sha-完整提交哈希` 标签。GitHub 内置的 `GITHUB_TOKEN` 用于发布 GHCR，无需 Docker Hub 账号。

本地安装 Go 1.27.4 后可以直接编译，或使用 Docker：

```bash
go test ./...
go build -trimpath -o bin/zju-connect .
docker build -t hziee-vpn:local .
```

默认入口为 `vpn.hziee.edu.cn:443`、协议 `atrust`、认证 `auth/psw`、登录域 `ShenLan`。账号密码在部署时填写，不写入源码或镜像。

## 首次登录

官方 aTrust 的扫码网页使用 `28081`，操作见[官方客户端二维码](deploy/hziee/README.md#官方-atrust-客户端二维码)。以下为独立 Go 客户端的账号密码登录。

准备 Docker、Docker Compose 和 Python 3.9 或更新版本，在项目目录执行；已有配置文件时保留原文件：

```bash
cd deploy/hziee
cp -n headless.toml.example headless.toml
chmod 600 headless.toml
```

在 `headless.toml` 中填写 `username` 和 `password`，其余学校参数已预设：

```bash
docker compose -f compose.headless.yaml config --quiet
docker compose -f compose.headless.yaml pull
python3 captcha_web.py
```

打开终端输出的完整链接，按验证码提示依次点选并提交。网页仅监听 `127.0.0.1:18081`；服务器部署需建立 [SSH 本地转发](deploy/hziee/README.md#验证码网页)。其他二次认证在终端输入。登录成功后，在另一终端验证代理：

```bash
curl --noproxy '' --proxy http://127.0.0.1:8888 --max-time 15 http://10.130.10.75/
```

按 `Ctrl+C` 结束前台登录，再启动后台服务：

```bash
docker compose -f compose.headless.yaml up -d
docker compose -f compose.headless.yaml logs --tail=50 -f vpn
```

SOCKS5 代理为 `127.0.0.1:1080`，HTTP 代理为 `127.0.0.1:8888`。客户端每 60 秒访问校内地址，会话保存在 `headless-data/`。

## 数据与来源

`headless.toml` 保存账号密码，`headless-data/` 保存验证码和登录会话，均已加入 Git 忽略规则。

客户端源码来自 [ZJU-Connect](https://github.com/Mythologyli/ZJU-Connect)，遵循 [AGPL-3.0](LICENSE)，原有版权声明保持不变。原 docker-easyconnect 内容保留 [WTFPL](LICENSE.txt)。本项目为非官方项目。
