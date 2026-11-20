# HzieeVPN-easyconnect

杭州电子科技大学信息工程学院的 aTrust VPN 账号密码登录与验证码网页。学校入口：<https://vpn.hziee.edu.cn>。

使用 ZJU-Connect 1.3.1 成品镜像，以“上网账号(I-XG)”登录。完整操作见[部署说明](deploy/hziee/README.md)。

## 首次登录

准备 Docker、Docker Compose 和 Python 3.9 或更新版本，在项目目录执行；已有配置文件时保留原文件：

```bash
cd deploy/hziee
cp -n headless.toml.example headless.toml
chmod 600 headless.toml
```

在 `headless.toml` 中填写 `username` 和 `password`，其余学校参数已预设：

```bash
docker compose -f compose.headless.yaml config --quiet
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

项目基于 [docker-easyconnect](https://github.com/docker-easyconnect/docker-easyconnect)，密码登录使用 [ZJU-Connect](https://github.com/Mythologyli/ZJU-Connect)。仓库采用 [WTFPL](LICENSE.txt) 许可证；aTrust 软件版权归深信服所有。本项目为非官方项目。
