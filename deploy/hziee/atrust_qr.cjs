const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const LOOPBACK_PORT = 28081;
const CAPTCHA_MAX_BYTES = 2 * 1024 * 1024;
const CAPTCHA_TTL_MS = 300000;
const LOGIN_BODY_MAX_BYTES = 16384;
const DEFAULT_DOMAIN = 'ShenLan';
const TRUSTED_CAPTCHA_HOSTS = ['vpn.hziee.edu.cn', '127.0.0.1', 'localhost.sangfor.com.cn'];

function parsePorts(raw) {
  const parsed = String(raw || '')
    .split(',')
    .map(item => Number(item.trim()))
    .filter(port => Number.isInteger(port) && port >= 1024 && port <= 65535);
  return parsed.length ? Array.from(new Set(parsed)) : [58081];
}

const DEFAULT_PUBLIC_PORTS = parsePorts(process.env.ATRUST_PUBLIC_PORTS || process.env.ATRUST_WEB_PORT || '58081');

function parseListenPort(raw) {
  const port = Number(raw);
  return Number.isInteger(port) && port >= 1024 && port <= 65535 ? port : LOOPBACK_PORT;
}

const LISTEN_PORT = parseListenPort(process.env.ATRUST_LISTEN_PORT);

function trustedFrame(raw) {
  try {
    const url = new URL(raw);
    if (url.username || url.password) return false;
    return (url.protocol === 'https:' && ['login.dingtalk.com', 'vpn.hziee.edu.cn'].includes(url.hostname) && !url.port) ||
      (url.protocol === 'file:' && !url.host && url.pathname.startsWith('/usr/share/sangfor/aTrust/resources/app/web/'));
  } catch (_) {
    return false;
  }
}

function trustedCaptchaUrl(raw) {
  try {
    const url = new URL(raw);
    if (url.protocol !== 'https:' || url.username || url.password) return false;
    return TRUSTED_CAPTCHA_HOSTS.includes(url.hostname);
  } catch (_) {
    return false;
  }
}

function allowedHost(host, publicPorts = DEFAULT_PUBLIC_PORTS) {
  if (typeof host !== 'string' || !host || host.length > 255 || /[\s@/?#\\]/.test(host)) return false;
  try {
    const parsed = new URL('http://' + host);
    if (parsed.username || parsed.password || parsed.pathname !== '/' || parsed.search || parsed.hash) return false;
    if (!parsed.port || parsed.host !== host.toLowerCase()) return false;
    const port = Number(parsed.port);
    if (port === LOOPBACK_PORT) {
      return ['127.0.0.1', 'localhost', '[::1]'].includes(parsed.hostname);
    }
    return Boolean(parsed.hostname) && publicPorts.includes(port);
  } catch (_) {
    return false;
  }
}

function constantTimeEqual(left, right) {
  if (typeof left !== 'string' || typeof right !== 'string') return false;
  const leftBuf = Buffer.from(left, 'utf8');
  const rightBuf = Buffer.from(right, 'utf8');
  return leftBuf.length === rightBuf.length && crypto.timingSafeEqual(leftBuf, rightBuf);
}

function authorized(headers, token, publicPorts = DEFAULT_PUBLIC_PORTS) {
  if (!headers || !allowedHost(headers.host, publicPorts)) return false;
  if (headers.origin && headers.origin !== 'http://' + headers.host && headers.origin !== 'https://' + headers.host) {
    return false;
  }
  return constantTimeEqual(headers.authorization, 'Bearer ' + token);
}

function qrData(value) {
  return typeof value === 'string' && value.length < 262144 && /^data:image\/png;base64,[A-Za-z0-9+/]+={0,2}$/.test(value) ? value : null;
}

function sanitizeMessage(value, secrets = []) {
  if (typeof value !== 'string') return '';
  let cleaned = value;
  const uniqueSecrets = Array.from(new Set(secrets.filter(item => typeof item === 'string' && item.length > 0)))
    .sort((left, right) => right.length - left.length);
  for (const secret of uniqueSecrets) {
    cleaned = cleaned.split(secret).join('[redacted]');
  }
  return cleaned.slice(0, 350);
}

function validatePasswordLogin(payload, activeCaptcha, now = Date.now()) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return { ok: false, status: 400, error: '提交内容必须为 JSON 对象' };
  }
  if (!activeCaptcha || typeof payload.challenge !== 'string' || payload.challenge !== activeCaptcha.challenge
      || (now - activeCaptcha.createdAt) > CAPTCHA_TTL_MS) {
    return { ok: false, status: 409, error: '验证码已过期或已使用，请重新获取验证码' };
  }
  const rawUsername = typeof payload.username === 'string' ? payload.username.trim() : '';
  if (!rawUsername || rawUsername.length > 256 || /[\r\n\0]/.test(rawUsername)) {
    return { ok: false, status: 400, error: '请输入有效的账号' };
  }
  if (typeof payload.password !== 'string' || !payload.password || payload.password.length > 512 || payload.password.includes('\0')) {
    return { ok: false, status: 400, error: '请输入有效的密码' };
  }
  let account;
  if (rawUsername.includes('@')) {
    const atIndex = rawUsername.lastIndexOf('@');
    const localPart = rawUsername.slice(0, atIndex);
    const domainPart = rawUsername.slice(atIndex + 1);
    if (!localPart || !/^[A-Za-z0-9._-]{1,64}$/.test(domainPart)) {
      return { ok: false, status: 400, error: '账号中的登录域格式无效' };
    }
    account = rawUsername;
  } else {
    const domain = payload.domain === undefined || payload.domain === '' ? DEFAULT_DOMAIN : payload.domain;
    if (typeof domain !== 'string' || !/^[A-Za-z0-9._-]{1,64}$/.test(domain)) {
      return { ok: false, status: 400, error: '登录域格式无效' };
    }
    account = rawUsername + '@' + domain;
  }
  if (!Number.isInteger(payload.width) || !Number.isInteger(payload.height)
      || payload.width !== activeCaptcha.width || payload.height !== activeCaptcha.height) {
    return { ok: false, status: 400, error: '验证码尺寸不匹配，请重新获取验证码' };
  }
  const points = payload.coordinates;
  if (!Array.isArray(points) || points.length < 1 || points.length > 10) {
    return { ok: false, status: 400, error: '请按顺序点选 1 至 10 个验证码坐标' };
  }
  for (const point of points) {
    if (!Array.isArray(point) || point.length !== 2 || !Number.isInteger(point[0]) || !Number.isInteger(point[1])
        || point[0] < 0 || point[0] >= payload.width || point[1] < 0 || point[1] >= payload.height) {
      return { ok: false, status: 400, error: '验证码点选坐标超出范围' };
    }
  }
  return {
    ok: true,
    account,
    username: rawUsername,
    password: payload.password,
    answer: { coordinates: points, width: payload.width, height: payload.height },
  };
}

const readQR = `(() => {
  if (location.hostname !== 'login.dingtalk.com') return null;
  const expired = document.querySelector('.module-qrcode-expired-cover,.module-qrcode-expired-new-cover,.factor-onlineDevice-expired-cover,.edu-qrCode-expired-cover');
  if (expired && expired.getClientRects().length) return null;
  const square = e => e.width >= 120 && e.width <= 800 && Math.abs(e.width - e.height) < 8;
  for (const image of document.images) {
    if (square(image) && image.src.startsWith('data:image/png;base64,')) return image.src;
  }
  for (const canvas of document.querySelectorAll('canvas')) {
    if (square(canvas)) return canvas.toDataURL('image/png');
  }
  return null;
})()`;

const selectDingTalk = `(() => {
  const labels = new Set([
    '钉钉',
    '钉钉扫码',
    '钉钉登录',
    '钉钉扫码登录',
    '钉钉认证',
    'dingtalk',
    'dingtalk login',
    'scan with dingtalk',
    'dingtalk authentication',
  ]);
  const exactMatch = element => {
    if (!element.getClientRects().length) return false;
    const text = (element.textContent || '').trim().toLowerCase();
    const title = (element.getAttribute('title') || '').trim().toLowerCase();
    const aria = (element.getAttribute('aria-label') || '').trim().toLowerCase();
    return labels.has(text) || labels.has(title) || labels.has(aria);
  };
  const partialMatch = element => {
    if (!element.getClientRects().length) return false;
    const text = (element.textContent || '').trim().toLowerCase();
    return text.length > 0 && text.length <= 20 && (text.includes('钉钉') || text.includes('dingtalk'));
  };
  const elements = Array.from(document.querySelectorAll('button,a,[role="button"],[role="tab"],li,p,span,div')).reverse();
  const element = elements.find(exactMatch) || elements.find(partialMatch);
  if (element) { element.click(); return true; }
  return false;
})()`;

async function inspectWindow(contents, select) {
  const debuggerClient = contents.debugger;
  if (!debuggerClient.isAttached()) debuggerClient.attach('1.3');
  const tree = await debuggerClient.sendCommand('Page.getFrameTree');
  const frames = [];
  function collect(node) {
    if (trustedFrame(node.frame.url)) frames.push(node.frame);
    (node.childFrames || []).forEach(collect);
  }
  collect(tree.frameTree);
  let image = null;
  for (const frame of frames) {
    const world = await debuggerClient.sendCommand('Page.createIsolatedWorld', { frameId: frame.id, worldName: 'atrust-qr-reader' });
    if (select && new URL(frame.url).hostname !== 'login.dingtalk.com') {
      const selected = await debuggerClient.sendCommand('Runtime.evaluate', {
        expression: selectDingTalk, contextId: world.executionContextId, returnByValue: true, timeout: 3000,
      });
      if (selected.exceptionDetails) throw new Error('无法打开客户端钉钉登录');
    }
    const result = await debuggerClient.sendCommand('Runtime.evaluate', {
      expression: readQR, contextId: world.executionContextId, returnByValue: true, timeout: 3000,
    });
    if (result.exceptionDetails) throw new Error('无法读取官方客户端二维码');
    image = qrData(result.result.value) || image;
  }
  return { image, frames: frames.map(frame => {
    const url = new URL(frame.url);
    return url.protocol === 'file:' ? url.pathname : url.origin + url.pathname;
  }) };
}

function readCaptchaImage(electron, url, session) {
  return new Promise((resolve, reject) => {
    if (!trustedCaptchaUrl(url)) return reject(new Error('验证码地址不在允许范围内'));
    const request = electron.net.request({ url, session, useSessionCookies: true, redirect: 'error' });
    request.setHeader('Accept', 'image/webp,image/apng,image/*,*/*;q=0.8');
    const timeout = setTimeout(() => { request.abort(); reject(new Error('获取验证码超时')); }, 15000);
    request.on('error', error => { clearTimeout(timeout); reject(error); });
    request.on('response', response => {
      const chunks = [];
      let length = 0;
      response.on('data', chunk => {
        length += chunk.length;
        if (length > CAPTCHA_MAX_BYTES) {
          request.abort();
          return;
        }
        chunks.push(chunk);
      });
      response.on('end', () => {
        clearTimeout(timeout);
        if (response.statusCode !== 200 || length > CAPTCHA_MAX_BYTES) {
          return reject(new Error('官方验证码响应无效'));
        }
        resolve(Buffer.concat(chunks));
      });
    });
    request.end();
  });
}

async function findPasswordForm(electron) {
  for (const contents of electron.webContents.getAllWebContents()) {
    if (contents.isDestroyed()) continue;
    let url;
    try {
      url = new URL(contents.getURL() || 'about:blank');
    } catch (_) {
      continue;
    }
    if (url.protocol !== 'file:' || path.basename(url.pathname) !== 'index.html') continue;
    const source = await contents.executeJavaScript(`(async () => {
      if (!document.querySelector('input[type="password"]')) return null;
      const scripts = Array.from(document.scripts).map(e => (e.src || e.dataset.src || '').split('/').pop().split('?')[0]);
      const older = scripts.includes('index.8d430ddd.js');
      const api = await import(older ? './assets/common.147d417f.js' : './assets/common.72564e07.js');
      return { url: older ? api.z() : api.N(), master: older ? 'master.eedc111d.js' : 'master.c998f688.js' };
    })()`);
    if (source && source.url && source.master) {
      return { contents, url: source.url, master: source.master };
    }
  }
  return null;
}

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function readJsonBody(request, maxBytes = LOGIN_BODY_MAX_BYTES) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let total = 0;
    let done = false;
    request.on('data', chunk => {
      if (done) return;
      total += chunk.length;
      if (total > maxBytes) {
        done = true;
        reject({ status: 413, error: '请求体过大' });
        return;
      }
      chunks.push(chunk);
    });
    request.on('end', () => {
      if (done) return;
      done = true;
      if (!total) return reject({ status: 400, error: '请求体不能为空' });
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString('utf8')));
      } catch (_) {
        reject({ status: 400, error: '请求体 JSON 格式无效' });
      }
    });
    request.on('error', () => {
      if (done) return;
      done = true;
      reject({ status: 400, error: '读取请求体失败' });
    });
  });
}

function createServer(options) {
  const {
    token,
    publicPorts = DEFAULT_PUBLIC_PORTS,
    htmlPath = path.join(__dirname, 'atrust_qr.html'),
    getLoginStatus,
    readDingTalk,
    fetchCaptcha,
    submitPassword,
  } = options;
  let busy = false;
  let activeCaptcha = null;

  const server = http.createServer(async (request, response) => {
    const headers = {
      'Cache-Control': 'no-store',
      'Referrer-Policy': 'no-referrer',
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'DENY',
      'Content-Security-Policy': "default-src 'none'; script-src 'self' 'unsafe-inline'; style-src 'unsafe-inline'; img-src data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'",
    };
    function send(status, data, type = 'application/json; charset=utf-8') {
      response.writeHead(status, Object.assign({}, headers, { 'Content-Type': type }));
      response.end(typeof data === 'string' ? data : JSON.stringify(data));
    }
    if (!allowedHost(request.headers.host, publicPorts)) return send(403, { error: '来源不允许' });
    const parsedUrl = new URL(request.url || '/', 'http://127.0.0.1');
    const pathname = parsedUrl.pathname;
    if (pathname === '/' && request.method === 'GET') {
      return send(200, fs.readFileSync(htmlPath, 'utf8'), 'text/html; charset=utf-8');
    }
    if (!authorized(request.headers, token, publicPorts)) return send(403, { error: '登录链接已失效，请重新获取' });

    const isStatus = pathname === '/status' && request.method === 'GET';
    const isRefresh = pathname === '/refresh' && request.method === 'POST';
    const isCaptcha = pathname === '/password/captcha' && request.method === 'POST';
    const isPasswordLogin = pathname === '/password/login' && request.method === 'POST';
    if (!isStatus && !isRefresh && !isCaptcha && !isPasswordLogin) {
      return send(404, { error: '接口不存在' });
    }
    if (busy) return send(409, { error: '正在操作官方客户端，请稍后重试' });
    busy = true;
    try {
      const status = getLoginStatus();
      if (isStatus) {
        const mode = parsedUrl.searchParams.get('mode') === 'password' ? 'password' : 'dingtalk';
        const captchaValid = Boolean(activeCaptcha && (Date.now() - activeCaptcha.createdAt) <= CAPTCHA_TTL_MS);
        if (mode === 'password') {
          return send(200, {
            status,
            mode,
            image: null,
            frames: [],
            sources: [],
            captchaActive: captchaValid,
            captchaChallenge: captchaValid ? activeCaptcha.challenge : null,
            captchaWidth: captchaValid ? activeCaptcha.width : null,
            captchaHeight: captchaValid ? activeCaptcha.height : null,
          });
        }
        const result = { status, mode, image: null, frames: [], sources: [], captchaActive: captchaValid };
        if (status === 'logout') {
          const current = await readDingTalk({ refresh: false });
          result.image = current.image || null;
          result.frames = current.frames || [];
          result.sources = current.sources || [];
        }
        return send(200, result);
      }

      if (isRefresh) {
        activeCaptcha = null;
        const result = { status, mode: 'dingtalk', image: null, frames: [], sources: [], captchaActive: false };
        if (status === 'logout') {
          const current = await readDingTalk({ refresh: true });
          result.image = current.image || null;
          result.frames = current.frames || [];
          result.sources = current.sources || [];
        }
        return send(200, result);
      }

      if (isCaptcha) {
        if (status !== 'logout') {
          return send(409, { error: '客户端当前状态为 ' + status + '，无需再次登录', status });
        }
        const captcha = await fetchCaptcha();
        if (!captcha || !captcha.image || !Number.isInteger(captcha.width) || !Number.isInteger(captcha.height)) {
          return send(502, { error: '无法从官方客户端获取验证码图片' });
        }
        const challenge = crypto.randomBytes(16).toString('hex');
        const createdAt = Date.now();
        activeCaptcha = {
          challenge,
          width: captcha.width,
          height: captcha.height,
          master: captcha.master,
          contents: captcha.contents,
          createdAt,
        };
        return send(200, {
          status,
          challenge,
          width: captcha.width,
          height: captcha.height,
          image: captcha.image,
          createdAt,
        });
      }

      if (isPasswordLogin) {
        const contentType = String(request.headers['content-type'] || '');
        if (!contentType.toLowerCase().startsWith('application/json')) {
          return send(400, { error: '请提交 JSON 格式数据' });
        }
        let payload;
        try {
          payload = await readJsonBody(request);
        } catch (bodyError) {
          return send(bodyError.status || 400, { error: bodyError.error || '请求体无效' });
        }
        const checked = validatePasswordLogin(payload, activeCaptcha);
        if (!checked.ok) {
          return send(checked.status, { ok: false, error: checked.error });
        }
        const currentCaptcha = activeCaptcha;
        activeCaptcha = null;
        if (currentCaptcha.contents && typeof currentCaptcha.contents.isDestroyed === 'function'
            && currentCaptcha.contents.isDestroyed()) {
          return send(409, { ok: false, error: '官方登录页面已关闭，请重新获取验证码' });
        }
        const authResult = await submitPassword({
          account: checked.account,
          username: checked.username,
          password: checked.password,
          answer: checked.answer,
          master: currentCaptcha.master,
          contents: currentCaptcha.contents,
        });
        const secrets = [checked.password, checked.username, checked.account];
        const safeMessage = sanitizeMessage(authResult && authResult.message, secrets);
        const nextStatus = getLoginStatus();
        if (authResult && authResult.code === 0) {
          return send(200, {
            ok: true,
            code: 0,
            status: nextStatus,
            message: safeMessage || '密码与验证码校验成功',
            nextService: authResult.nextService || null,
          });
        }
        return send(400, {
          ok: false,
          code: authResult ? authResult.code : null,
          status: nextStatus,
          error: safeMessage || '认证未通过，请重新获取验证码后重试',
          graphCheckCodeEnable: authResult ? authResult.graphCheckCodeEnable : null,
          nextService: authResult ? authResult.nextService : null,
        });
      }
    } catch (error) {
      console.error('[aTrust Web]', error && error.message ? sanitizeMessage(error.message) : (error && error.name ? error.name : 'Error'));
      send(502, { error: '官方 aTrust 客户端交互失败，请重试或检查客户端日志' });
    } finally {
      busy = false;
    }
  });
  server.requestTimeout = 25000;
  server.on('error', error => console.error('[aTrust Web]', error.message));
  return server;
}

function start(electron, appConfig, mainWindow) {
  const tokenPath = process.env.ATRUST_TOKEN_PATH || path.join(__dirname, 'token');
  fs.mkdirSync(path.dirname(tokenPath), { recursive: true, mode: 0o700 });
  const token = crypto.randomBytes(32).toString('hex');
  fs.writeFileSync(tokenPath, token, { mode: 0o600 });
  let selectUntil = 0;
  const publicPorts = LISTEN_PORT === LOOPBACK_PORT
    ? DEFAULT_PUBLIC_PORTS
    : Array.from(new Set(DEFAULT_PUBLIC_PORTS.concat([LISTEN_PORT])));
  const server = createServer({
    token,
    publicPorts,
    getLoginStatus: () => appConfig.getLoginStatus(),
    readDingTalk: async ({ refresh }) => {
      const result = { image: null, frames: [], sources: [] };
      if (refresh) {
        selectUntil = Date.now() + 60000;
        mainWindow.closeMainWindow();
        mainWindow.showLoginPagePreCheck('https://vpn.hziee.edu.cn', false, false, true);
        await delay(800);
      }
      for (const contents of electron.webContents.getAllWebContents()) {
        if (contents.isDestroyed()) continue;
        const rawUrl = contents.getURL() || 'about:blank';
        try {
          const source = new URL(rawUrl);
          result.sources.push(source.protocol === 'file:' ? source.pathname : source.origin + source.pathname);
        } catch (_) {
          continue;
        }
        if (!trustedFrame(rawUrl)) continue;
        try {
          const current = await inspectWindow(contents, Date.now() < selectUntil);
          result.image = current.image || result.image;
          result.frames.push(...current.frames);
        } catch (windowError) {
          console.error('[aTrust Web] inspectWindow skipped:', sanitizeMessage(windowError && windowError.message));
        }
      }
      if (result.image) selectUntil = 0;
      return result;
    },
    fetchCaptcha: async () => {
      selectUntil = 0;
      let form = await findPasswordForm(electron);
      if (!form) {
        mainWindow.closeMainWindow();
        mainWindow.showLoginPagePreCheck('https://vpn.hziee.edu.cn', false, false, true);
        for (let attempt = 0; attempt < 16; attempt += 1) {
          await delay(500);
          form = await findPasswordForm(electron);
          if (form) break;
        }
      }
      if (!form) throw new Error('未找到官方客户端密码登录页面');
      const bytes = await readCaptchaImage(electron, form.url, form.contents.session);
      const parsed = electron.nativeImage.createFromBuffer(bytes);
      if (parsed.isEmpty()) throw new Error('官方验证码返回内容不是有效图片');
      const size = parsed.getSize();
      return {
        image: 'data:image/png;base64,' + parsed.toPNG().toString('base64'),
        width: size.width,
        height: size.height,
        master: form.master,
        contents: form.contents,
      };
    },
    submitPassword: async ({ account, username, password, answer, master, contents }) => {
      if (!contents || contents.isDestroyed()) {
        throw new Error('官方登录窗口已失效');
      }
      const payload = { account, username, password, answer, master };
      return contents.executeJavaScript(`(async () => {
        const input = ${JSON.stringify(payload)};
        const clean = value => {
          if (typeof value !== 'string') return '';
          return value
            .split(input.password).join('[redacted]')
            .split(input.account).join('[redacted]')
            .split(input.username).join('[redacted]')
            .slice(0, 350);
        };
        try {
          const mod = await import('./assets/' + input.master);
          const res = await mod.a({
            username: input.account,
            password: input.password,
            rememberPwd: '0',
            graphCheckCode: JSON.stringify(input.answer),
          });
          return {
            status: 'auth-returned',
            code: res && res.code,
            nextService: res && res.nextService,
            message: clean(res && res.message),
          };
        } catch (error) {
          return {
            status: 'auth-error',
            code: error && error.code,
            type: error && error.name,
            message: clean(error && error.message),
            graphCheckCodeEnable: error && error.data && error.data.graphCheckCodeEnable,
            nextService: error && error.data && error.data.nextService,
          };
        }
      })()`);
    },
  });
  server.listen(LISTEN_PORT, '127.0.0.1', () => {
    console.log('[aTrust Web] Ready on container loopback port ' + LISTEN_PORT + ' (public ports: ' + publicPorts.join(',') + ')');
  });
  electron.app.on('before-quit', () => server.close());
}

module.exports = {
  trustedFrame,
  trustedCaptchaUrl,
  allowedHost,
  authorized,
  qrData,
  sanitizeMessage,
  validatePasswordLogin,
  selectDingTalk,
  createServer,
  start,
};
