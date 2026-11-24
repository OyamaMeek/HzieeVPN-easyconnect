const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { fileURLToPath, pathToFileURL } = require('url');

const LOOPBACK_PORT = 28081;
const CAPTCHA_MAX_BYTES = 2 * 1024 * 1024;
const CAPTCHA_TTL_MS = 300000;
const AUTO_CLOSE_TIMEOUT_MS = 10 * 60 * 1000;
const STATUS_POLL_INTERVAL_MS = 2000;
const CLOSE_DELAY_MS = 3500;
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

function isLoginPageUrl(raw) {
  try {
    const url = new URL(raw || 'about:blank');
    if (url.username || url.password) return false;
    if (url.protocol === 'file:' && !url.host && path.basename(url.pathname) === 'index.html') {
      return true;
    }
    return url.protocol === 'https:' && !url.port && url.hostname === 'vpn.hziee.edu.cn';
  } catch (_) {
    return false;
  }
}

function resolveAssetsBaseUrl(electron, rawUrl, existsSync = fs.existsSync) {
  try {
    const url = new URL(rawUrl || 'about:blank');
    if (url.protocol === 'file:' && !url.host) {
      const localAssets = path.join(path.dirname(fileURLToPath(url)), 'assets');
      if (existsSync(localAssets)) return pathToFileURL(localAssets).href + '/';
      return './assets/';
    }
  } catch (_) {
  }
  const candidates = [];
  try {
    if (electron && electron.app && typeof electron.app.getAppPath === 'function') {
      candidates.push(path.join(electron.app.getAppPath(), 'web', 'assets'));
    }
  } catch (_) {
  }
  candidates.push('/usr/share/sangfor/aTrust/resources/app/web/assets');
  for (const dir of candidates) {
    if (existsSync(dir)) return pathToFileURL(dir).href + '/';
  }
  return './assets/';
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

function isLoggedIn(status) {
  return status === 'online' || status === 'login';
}

function authorized(headers, publicPorts = DEFAULT_PUBLIC_PORTS) {
  if (!headers || !allowedHost(headers.host, publicPorts)) return false;
  if (headers.origin && headers.origin !== 'http://' + headers.host && headers.origin !== 'https://' + headers.host) {
    return false;
  }
  return true;
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

const selectPassword = `(() => {
  const labels = new Set([
    '上网账号(i-xg)',
    '上网账号',
    '账号密码',
    '密码登录',
    '用户名密码',
    'password',
    'account',
    'username',
    'password login',
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
    return text.length > 0 && text.length <= 24 && (text.includes('上网账号') || text.includes('密码登录') || text.includes('账号密码'));
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

async function findPasswordForm(electron, allowSwitch = false) {
  for (const contents of electron.webContents.getAllWebContents()) {
    if (contents.isDestroyed()) continue;
    const rawUrl = contents.getURL() || 'about:blank';
    if (!isLoginPageUrl(rawUrl)) continue;
    const assetsBaseUrl = resolveAssetsBaseUrl(electron, rawUrl);
    try {
      const source = await contents.executeJavaScript(`(async () => {
        if (!document.querySelector('input[type="password"]')) return null;
        const base = ${JSON.stringify(assetsBaseUrl)};
        const scripts = Array.from(document.scripts).map(e => (e.src || e.dataset.src || '').split('/').pop().split('?')[0]);
        const older = scripts.includes('index.8d430ddd.js');
        const api = await import(base + (older ? 'common.147d417f.js' : 'common.72564e07.js'));
        return {
          url: older ? api.z() : api.N(),
          master: base + (older ? 'master.eedc111d.js' : 'master.c998f688.js'),
        };
      })()`);
      if (source && source.url && source.master) {
        return { contents, url: source.url, master: source.master };
      }
      if (allowSwitch) {
        await contents.executeJavaScript(selectPassword);
      }
    } catch (_) {
      continue;
    }
  }
  return null;
}

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function withFreshRnd(rawUrl) {
  try {
    const parsed = new URL(rawUrl);
    if (parsed.searchParams.has('rnd')) {
      parsed.searchParams.set('rnd', String(Date.now()));
    }
    return parsed.toString();
  } catch (_) {
    return rawUrl;
  }
}

function describeInvalidCaptcha(bytes) {
  const base = '官方验证码返回内容不是有效图片';
  if (!Buffer.isBuffer(bytes) || !bytes.length) return base;
  const text = bytes.slice(0, 512).toString('utf8').trim();
  if (!text.startsWith('{')) return base;
  try {
    const parsed = JSON.parse(text);
    const parts = [];
    if (parsed && (typeof parsed.code === 'number' || typeof parsed.code === 'string')) {
      parts.push('code=' + String(parsed.code));
    }
    if (parsed && typeof parsed.message === 'string' && parsed.message.trim()) {
      parts.push(sanitizeMessage(parsed.message.trim()));
    }
    return parts.length ? base + ' (' + parts.join(': ') + ')' : base;
  } catch (_) {
    return base;
  }
}

async function loadCaptchaFromForm(form, readImage, decodeImage, refreshRnd = false) {
  const targetUrl = refreshRnd ? withFreshRnd(form.url) : form.url;
  const bytes = await readImage(targetUrl, form.contents && form.contents.session);
  const parsed = decodeImage(bytes);
  if (!parsed || parsed.isEmpty()) {
    throw new Error(describeInvalidCaptcha(bytes));
  }
  const size = parsed.getSize();
  return {
    image: 'data:image/png;base64,' + parsed.toPNG().toString('base64'),
    width: size.width,
    height: size.height,
    master: form.master,
    contents: form.contents,
  };
}

async function fetchCaptchaWithReload({
  findForm,
  reloadForm,
  readImage,
  decodeImage,
  wait = delay,
  postReloadAttempts = 3,
  postReloadDelayMs = 600,
}) {
  let form = await findForm();
  let reloaded = false;
  if (!form) {
    form = await reloadForm();
    reloaded = true;
  }
  if (!form) throw new Error('未找到官方客户端密码登录页面');

  if (!reloaded) {
    try {
      return await loadCaptchaFromForm(form, readImage, decodeImage, false);
    } catch (_) {
      form = await reloadForm();
      reloaded = true;
      if (!form) throw new Error('未找到官方客户端密码登录页面');
    }
  }

  let lastError = null;
  for (let attempt = 0; attempt < postReloadAttempts; attempt += 1) {
    if (attempt > 0) await wait(postReloadDelayMs);
    try {
      return await loadCaptchaFromForm(form, readImage, decodeImage, attempt > 0);
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError || new Error('官方验证码返回内容不是有效图片');
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
    publicPorts = DEFAULT_PUBLIC_PORTS,
    htmlPath = path.join(__dirname, 'atrust_qr.html'),
    autoCloseTimeoutMs = AUTO_CLOSE_TIMEOUT_MS,
    statusPollIntervalMs = STATUS_POLL_INTERVAL_MS,
    closeDelayMs = CLOSE_DELAY_MS,
    getLoginStatus,
    readDingTalk,
    fetchCaptcha,
    submitPassword,
  } = options;
  let busy = false;
  let activeCaptcha = null;
  let closing = false;
  let closed = false;
  let pollTimer = null;
  let timeoutTimer = null;
  let closeTimer = null;
  let forceCloseTimer = null;

  function clearTimers() {
    if (pollTimer) { clearInterval(pollTimer); pollTimer = null; }
    if (timeoutTimer) { clearTimeout(timeoutTimer); timeoutTimer = null; }
    if (closeTimer) { clearTimeout(closeTimer); closeTimer = null; }
    if (forceCloseTimer) { clearTimeout(forceCloseTimer); forceCloseTimer = null; }
  }

  function finalizeClose(reason) {
    if (closed) return;
    closed = true;
    closing = true;
    clearTimers();
    if (server.listening) {
      console.log('[aTrust Web] Closing login web server (' + reason + ')');
      server.close();
      if (typeof server.closeIdleConnections === 'function') {
        server.closeIdleConnections();
      }
      forceCloseTimer = setTimeout(() => {
        if (typeof server.closeAllConnections === 'function') {
          server.closeAllConnections();
        }
      }, 200);
      if (typeof forceCloseTimer.unref === 'function') forceCloseTimer.unref();
    }
  }

  function scheduleClose(reason, delayMs = 0) {
    if (closed) return;
    closing = true;
    if (delayMs <= 0) {
      finalizeClose(reason);
      return;
    }
    if (!closeTimer) {
      closeTimer = setTimeout(() => finalizeClose(reason), delayMs);
      if (typeof closeTimer.unref === 'function') closeTimer.unref();
    }
  }

  const server = http.createServer(async (request, response) => {
    const headers = {
      'Cache-Control': 'no-store',
      'Referrer-Policy': 'no-referrer',
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'DENY',
      'Content-Security-Policy': "default-src 'none'; script-src 'self' 'unsafe-inline'; style-src 'unsafe-inline'; img-src data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'",
    };
    function send(status, data, type = 'application/json; charset=utf-8', extraHeaders = null) {
      response.writeHead(status, Object.assign({}, headers, extraHeaders, { 'Content-Type': type }));
      response.end(typeof data === 'string' ? data : JSON.stringify(data));
    }
    function sendAndClose(status, data, reason) {
      closing = true;
      response.once('finish', () => finalizeClose(reason));
      scheduleClose(reason, Math.min(closeDelayMs, 1500));
      send(status, data, 'application/json; charset=utf-8', { Connection: 'close' });
    }
    if (!allowedHost(request.headers.host, publicPorts)) return send(403, { error: '来源不允许' });
    const parsedUrl = new URL(request.url || '/', 'http://127.0.0.1');
    const pathname = parsedUrl.pathname;
    if (pathname === '/' && request.method === 'GET') {
      if (closing) return send(503, { error: '登录网页服务已自动关闭' }, 'application/json; charset=utf-8', { Connection: 'close' });
      return send(200, fs.readFileSync(htmlPath, 'utf8'), 'text/html; charset=utf-8');
    }
    if (!authorized(request.headers, publicPorts)) return send(403, { error: '来源不允许' });

    const isStatus = pathname === '/status' && request.method === 'GET';
    const isRefresh = pathname === '/refresh' && request.method === 'POST';
    const isCaptcha = pathname === '/password/captcha' && request.method === 'POST';
    const isPasswordLogin = pathname === '/password/login' && request.method === 'POST';
    if (!isStatus && !isRefresh && !isCaptcha && !isPasswordLogin) {
      return send(404, { error: '接口不存在' });
    }
    if (closing && !isStatus) {
      return send(503, { error: '登录网页服务已自动关闭' }, 'application/json; charset=utf-8', { Connection: 'close' });
    }
    if (busy) return send(409, { error: '正在操作官方客户端，请稍后重试' });
    busy = true;
    try {
      const status = getLoginStatus();
      if (isStatus) {
        const mode = parsedUrl.searchParams.get('mode') === 'password' ? 'password' : 'dingtalk';
        const captchaValid = Boolean(activeCaptcha && (Date.now() - activeCaptcha.createdAt) <= CAPTCHA_TTL_MS);
        if (mode === 'password') {
          const body = {
            status,
            mode,
            image: null,
            frames: [],
            sources: [],
            captchaActive: captchaValid,
            captchaChallenge: captchaValid ? activeCaptcha.challenge : null,
            captchaWidth: captchaValid ? activeCaptcha.width : null,
            captchaHeight: captchaValid ? activeCaptcha.height : null,
            closing: isLoggedIn(status),
          };
          if (isLoggedIn(status)) return sendAndClose(200, body, 'logged-in');
          return send(200, body);
        }
        const result = { status, mode, image: null, frames: [], sources: [], captchaActive: captchaValid, closing: isLoggedIn(status) };
        if (status === 'logout') {
          const current = await readDingTalk({ refresh: false });
          result.image = current.image || null;
          result.frames = current.frames || [];
          result.sources = current.sources || [];
        }
        if (isLoggedIn(status)) return sendAndClose(200, result, 'logged-in');
        return send(200, result);
      }

      if (isRefresh) {
        activeCaptcha = null;
        const result = { status, mode: 'dingtalk', image: null, frames: [], sources: [], captchaActive: false, closing: isLoggedIn(status) };
        if (status === 'logout') {
          const current = await readDingTalk({ refresh: true });
          result.image = current.image || null;
          result.frames = current.frames || [];
          result.sources = current.sources || [];
        }
        if (isLoggedIn(status)) return sendAndClose(200, result, 'logged-in');
        return send(200, result);
      }

      if (isCaptcha) {
        if (status !== 'logout') {
          if (isLoggedIn(status)) {
            return sendAndClose(409, { error: '客户端当前状态为 ' + status + '，无需再次登录', status, closing: true }, 'logged-in');
          }
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
          const willClose = isLoggedIn(nextStatus);
          const body = {
            ok: true,
            code: 0,
            status: nextStatus,
            closing: willClose,
            message: safeMessage || '密码与验证码校验成功',
            nextService: authResult.nextService || null,
          };
          if (willClose) return sendAndClose(200, body, 'logged-in');
          return send(200, body);
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
  server.on('listening', () => {
    if (autoCloseTimeoutMs > 0) {
      timeoutTimer = setTimeout(() => finalizeClose('timeout'), autoCloseTimeoutMs);
      if (typeof timeoutTimer.unref === 'function') timeoutTimer.unref();
    }
    if (statusPollIntervalMs > 0) {
      pollTimer = setInterval(() => {
        if (busy || closing || closed) return;
        try {
          if (isLoggedIn(getLoginStatus())) {
            scheduleClose('logged-in', closeDelayMs);
          }
        } catch (error) {
          console.error('[aTrust Web] status check failed:', sanitizeMessage(error && error.message));
        }
      }, statusPollIntervalMs);
      if (typeof pollTimer.unref === 'function') pollTimer.unref();
    }
  });
  server.on('close', clearTimers);
  return server;
}

function start(electron, appConfig, mainWindow) {
  let selectUntil = 0;
  const publicPorts = LISTEN_PORT === LOOPBACK_PORT
    ? DEFAULT_PUBLIC_PORTS
    : Array.from(new Set(DEFAULT_PUBLIC_PORTS.concat([LISTEN_PORT])));
  const server = createServer({
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
      const findForm = async () => {
        let form = await findPasswordForm(electron, true);
        const hasLocalLogin = electron.webContents.getAllWebContents().some(contents => {
          if (contents.isDestroyed()) return false;
          return isLoginPageUrl(contents.getURL() || 'about:blank');
        });
        if (!form && hasLocalLogin) {
          for (let attempt = 0; attempt < 6; attempt += 1) {
            await delay(400);
            form = await findPasswordForm(electron, attempt === 2);
            if (form) break;
          }
        }
        return form;
      };
      const reloadForm = async () => {
        mainWindow.closeMainWindow();
        mainWindow.showLoginPagePreCheck('https://vpn.hziee.edu.cn', false, false, true);
        for (let attempt = 0; attempt < 16; attempt += 1) {
          await delay(500);
          const form = await findPasswordForm(electron, attempt >= 2);
          if (form) return form;
        }
        return null;
      };
      return fetchCaptchaWithReload({
        findForm,
        reloadForm,
        readImage: (url, session) => readCaptchaImage(electron, url, session),
        decodeImage: bytes => electron.nativeImage.createFromBuffer(bytes),
      });
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
          const moduleUrl = (input.master.includes('://') || input.master.startsWith('./'))
            ? input.master
            : './assets/' + input.master;
          const mod = await import(moduleUrl);
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
    console.log('[aTrust Web] Ready on container loopback port ' + LISTEN_PORT + ' (public ports: ' + publicPorts.join(',') + ', auto-closes after login or ' + Math.round(AUTO_CLOSE_TIMEOUT_MS / 1000) + 's)');
  });
  electron.app.on('before-quit', () => server.close());
}

module.exports = {
  trustedFrame,
  trustedCaptchaUrl,
  isLoginPageUrl,
  resolveAssetsBaseUrl,
  allowedHost,
  authorized,
  qrData,
  sanitizeMessage,
  validatePasswordLogin,
  selectDingTalk,
  selectPassword,
  fetchCaptchaWithReload,
  createServer,
  start,
};
