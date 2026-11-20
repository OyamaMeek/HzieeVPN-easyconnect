# HzieeVPN-easyconnect

杭州电子科技大学信息工程学院的 aTrust VPN 部署配置。学校入口：<https://vpn.hziee.edu.cn>。

| 登录方式 | 配置 | 用途 |
| --- | --- | --- |
| 上网账号密码 | `deploy/hziee/compose.headless.yaml` | 使用 ZJU-Connect，无需图形界面 |
| 钉钉扫码 | `deploy/hziee/compose.yaml` | 使用 aTrust，通过 noVNC 登录 |

两种方式共用代理端口，同一主机上只运行一套。详细登录、切换与服务器运维见[部署说明](deploy/hziee/README.md)。

## 账号密码登录

准备好 Docker、Docker Compose 和 Python 3（3.9 或更新版本），在项目目录执行；已有配置文件时保留原文件：

```bash
cd deploy/hziee
cp -n headless.toml.example headless.toml
chmod 600 headless.toml
```

在 `headless.toml` 中填写 `username` 和 `password`，其余学校参数已预设。若已运行图形版，先按部署说明停止它，再完成首次登录：

```bash
docker compose -f compose.headless.yaml config --quiet
python3 captcha_web.py
```

打开终端输出的完整网页链接，按验证码提示依次点击并提交；网页仅监听本机 `127.0.0.1:18081`。服务器部署时，先在 Termius 添加同端口的 SSH 本地转发，详见[验证码网页](deploy/hziee/README.md#验证码网页)。短信或其他二次认证仍在终端输入。登录成功后，在另一终端检查校内地址：

```bash
curl --noproxy '' --proxy http://127.0.0.1:8888 --max-time 15 http://10.130.10.75/
```

按 `Ctrl+C` 结束前台容器，再启动后台服务：

```bash
docker compose -f compose.headless.yaml up -d
docker compose -f compose.headless.yaml logs --tail=50 -f vpn
```

代理地址为 SOCKS5 `127.0.0.1:1080`、HTTP `127.0.0.1:8888`。客户端每 60 秒访问校内地址以保持连接，会话保存在 `headless-data/`。远程部署通过 SSH 隧道使用代理。

## 钉钉扫码登录

使用 `deploy/hziee/compose.yaml`，按[部署说明](deploy/hziee/README.md#登录)通过 noVNC 打开 aTrust，填写学校入口并选择钉钉扫码。

## 从源码构建

仓库包含原有 Dockerfile、构建脚本、容器启动源码、C 辅助库及多架构参数。先构建辅助镜像，再构建 VPN 镜像；以下命令适用于 Linux amd64 的 aTrust 图形版：

```bash
docker build --platform linux/amd64 -f Dockerfile.build -t hagb/docker-easyconnect:build .
docker build --platform linux/amd64 $(cat build-args/atrust-amd64.txt) -f Dockerfile -t hziee-atrust:local .
```

构建需要 Docker 引擎并联网下载 Debian 依赖与客户端安装包。其他架构、EasyConnect CLI 和无 VNC 版本见[构建说明](doc/build.md)，源码目录见[开发说明](doc/development.md)。学校部署配置默认使用成品镜像。

## 数据与来源

`.env`、`headless.toml`、`data/` 和 `headless-data/` 保存密码或登录会话，均已加入 Git 忽略规则。

项目基于 [docker-easyconnect](https://github.com/docker-easyconnect/docker-easyconnect)，密码登录使用 [ZJU-Connect](https://github.com/Mythologyli/ZJU-Connect)。仓库采用 [WTFPL](LICENSE.txt) 许可证；aTrust 软件版权归深信服所有。本项目为非官方项目。
