const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const test = require('node:test');
const {
  trustedFrame,
  trustedCaptchaUrl,
  isLoginPageUrl,
  resolveAssetsBaseUrl,
  allowedHost,
  authorized,
  parseSocksPort,
  buildSocks5Info,
  qrData,
  sanitizeMessage,
  validatePasswordLogin,
  selectDingTalk,
  selectPassword,
  fetchCaptchaWithReload,
  createServer,
} = require('./atrust_qr.cjs');

const ONE_PIXEL_PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+j3ioAAAAASUVORK5CYII=';

function httpRequest(port, method, reqPath, headers = {}, body = null) {
  return new Promise((resolve, reject) => {
    const req = http.request({ host: '127.0.0.1', port, method, path: reqPath, headers }, res => {
      const chunks = [];
      res.on('data', chunk => chunks.push(chunk));
      res.on('end', () => resolve({
        status: res.statusCode,
        headers: res.headers,
        body: Buffer.concat(chunks).toString('utf8'),
      }));
    });
    req.on('error', reject);
    if (body !== null) req.write(body);
    req.end();
  });
}

test('only reads official client and DingTalk login frames', () => {
  assert.equal(trustedFrame('https://login.dingtalk.com/oauth2/auth'), true);
  assert.equal(trustedFrame('https://vpn.hziee.edu.cn/portal/index.html'), true);
  assert.equal(trustedFrame('file:///usr/share/sangfor/aTrust/resources/app/web/index.html'), true);
  for (const url of ['https://login.dingtalk.com.evil.test/', 'http://login.dingtalk.com/', 'https://evil.test/', 'file:///etc/passwd']) {
    assert.equal(trustedFrame(url), false);
  }
});

test('only fetches captcha images from trusted official origins', () => {
  assert.equal(trustedCaptchaUrl('https://vpn.hziee.edu.cn/por/login_psw.csp?rnd=1'), true);
  assert.equal(trustedCaptchaUrl('https://127.0.0.1:443/captcha'), true);
  assert.equal(trustedCaptchaUrl('https://localhost.sangfor.com.cn/captcha'), true);
  for (const url of ['http://vpn.hziee.edu.cn/captcha', 'https://evil.test/captcha', 'https://user:pass@vpn.hziee.edu.cn/captcha', 'not-a-url']) {
    assert.equal(trustedCaptchaUrl(url), false);
  }
});

test('recognizes login window URLs before and after pushState and resolves local assets base URL', () => {
  assert.equal(isLoginPageUrl('file:///usr/share/sangfor/aTrust/resources/app/web/index.html?host=https://vpn.hziee.edu.cn#/login'), true);
  assert.equal(isLoginPageUrl('https://vpn.hziee.edu.cn/'), true);
  for (const url of [
    'file:///usr/share/sangfor/aTrust/resources/app/web/tray.html',
    'file:///usr/share/sangfor/aTrust/resources/app/web/qrcode.html',
    'https://login.dingtalk.com/oauth2/challenge.htm',
    'https://evil.test/',
    'http://vpn.hziee.edu.cn/',
  ]) {
    assert.equal(isLoginPageUrl(url), false);
  }

  const fakeElectron = { app: { getAppPath: () => '/usr/share/sangfor/aTrust/resources/app' } };
  const exists = target => target === '/usr/share/sangfor/aTrust/resources/app/web/assets';
  assert.equal(
    resolveAssetsBaseUrl(fakeElectron, 'https://vpn.hziee.edu.cn/', exists),
    'file:///usr/share/sangfor/aTrust/resources/app/web/assets/'
  );
  assert.equal(
    resolveAssetsBaseUrl(fakeElectron, 'file:///usr/share/sangfor/aTrust/resources/app/web/index.html', exists),
    'file:///usr/share/sangfor/aTrust/resources/app/web/assets/'
  );
  assert.equal(
    resolveAssetsBaseUrl(fakeElectron, 'https://vpn.hziee.edu.cn/', () => false),
    './assets/'
  );
});

test('requires allowed loopback or configured high port and exact Origin without token', () => {
  const headers = { host: '127.0.0.1:28081' };
  assert.equal(authorized(headers), true);
  assert.equal(authorized({ ...headers, origin: 'http://127.0.0.1:28081' }), true);
  assert.equal(authorized({ host: '203.0.113.10:58081', origin: 'http://203.0.113.10:58081' }), true);
  assert.equal(authorized({ host: 'vpn.example.com:58081', origin: 'https://vpn.example.com:58081' }), true);
  assert.equal(authorized({ host: '[::1]:58081', origin: 'http://[::1]:58081' }), true);
  assert.equal(allowedHost('203.0.113.10:58081'), true);
  assert.equal(allowedHost('203.0.113.10:28081'), false);
  for (const badHost of ['evil.test', '203.0.113.10:80', '203.0.113.10:18081', 'user:pass@203.0.113.10:58081', '203.0.113.10:58081/x', '']) {
    assert.equal(allowedHost(badHost), false);
  }
  for (const extra of [
    { host: 'evil.test' },
    { host: '203.0.113.10:80' },
    { origin: 'http://evil.test' },
  ]) {
    assert.equal(authorized({ ...headers, ...extra }), false);
  }
});

test('accepts bounded PNG data URLs only', () => {
  assert.equal(qrData('data:image/png;base64,aGVsbG8='), 'data:image/png;base64,aGVsbG8=');
  for (const value of ['https://evil.test/image', 'data:image/svg+xml,<svg/>', 'data:image/png;base64,!!', null]) {
    assert.equal(qrData(value), null);
  }
  assert.equal(qrData('data:image/png;base64,' + 'a'.repeat(300000)), null);
});

test('sanitizes credentials from error messages', () => {
  assert.equal(sanitizeMessage('bad user alice with pass s3cr3t!', ['s3cr3t!', 'alice']), 'bad user [redacted] with pass [redacted]');
  assert.equal(sanitizeMessage(null, ['a']), '');
});

test('DingTalk selector matches both Chinese and English official client labels', () => {
  assert.match(selectDingTalk, /钉钉扫码/);
  assert.match(selectDingTalk, /钉钉扫码登录/);
  assert.match(selectDingTalk, /scan with dingtalk/);
  assert.match(selectDingTalk, /dingtalk/);
  assert.match(selectPassword, /上网账号/);
  assert.match(selectPassword, /password/);
});

test('validates password login payload, coordinates, domain and challenge', () => {
  const active = { challenge: 'ch-1', width: 272, height: 192, master: 'master.c998f688.js', createdAt: Date.now() };
  const valid = validatePasswordLogin({
    username: 'alice',
    password: 'demo-password',
    domain: 'ShenLan',
    challenge: 'ch-1',
    width: 272,
    height: 192,
    coordinates: [[10, 20], [100, 150]],
  }, active);
  assert.equal(valid.ok, true);
  assert.equal(valid.account, 'alice@ShenLan');

  const withDomain = validatePasswordLogin({
    username: 'alice@Custom',
    password: 'demo-password',
    challenge: 'ch-1',
    width: 272,
    height: 192,
    coordinates: [[1, 2]],
  }, active);
  assert.equal(withDomain.ok, true);
  assert.equal(withDomain.account, 'alice@Custom');

  assert.equal(validatePasswordLogin({ username: 'alice', password: 'p', challenge: 'wrong', width: 272, height: 192, coordinates: [[1, 2]] }, active).status, 409);
  assert.equal(validatePasswordLogin({ username: 'alice', password: 'p', challenge: 'ch-1', width: 272, height: 192, coordinates: [[1, 2]] }, null).status, 409);
  for (const patch of [
    { username: '' },
    { password: '' },
    { domain: 'bad domain!' },
    { width: 200 },
    { height: 100 },
    { coordinates: [] },
    { coordinates: [[-1, 5]] },
    { coordinates: [[272, 5]] },
    { coordinates: [[5, 192]] },
    { coordinates: [[1.5, 5]] },
    { coordinates: Array.from({ length: 11 }, () => [1, 1]) },
  ]) {
    const res = validatePasswordLogin({
      username: 'alice',
      password: 'demo-password',
      domain: 'ShenLan',
      challenge: 'ch-1',
      width: 272,
      height: 192,
      coordinates: [[10, 20]],
      ...patch,
    }, active);
    assert.equal(res.ok, false);
    assert.equal(res.status, 400);
  }
});

test('unified high-port web server supports password captcha flow, DingTalk QR, and auto-closes after login', async () => {
  let statusValue = 'logout';
  let dingTalkRefreshes = 0;
  let loginCalls = 0;

  const server = createServer({
    publicPorts: [58081],
    autoCloseTimeoutMs: 60000,
    statusPollIntervalMs: 50,
    closeDelayMs: 50,
    getLoginStatus: () => statusValue,
    readDingTalk: async ({ refresh }) => {
      if (refresh) dingTalkRefreshes += 1;
      return { image: ONE_PIXEL_PNG, frames: ['https://login.dingtalk.com/login/qrcode.htm'], sources: ['file:///usr/share/sangfor/aTrust/resources/app/web/index.html'] };
    },
    fetchCaptcha: async () => ({
      image: ONE_PIXEL_PNG,
      width: 272,
      height: 192,
      master: 'master.c998f688.js',
      contents: { isDestroyed: () => false },
    }),
    submitPassword: async ({ account, password, answer }) => {
      loginCalls += 1;
      if (password === 'wrong-pass') {
        return { status: 'auth-error', code: 75500001, message: `failed for ${account} with ${password}`, graphCheckCodeEnable: 1 };
      }
      assert.equal(account, 'alice@ShenLan');
      assert.deepEqual(answer, { coordinates: [[20, 30], [100, 120]], width: 272, height: 192 });
      statusValue = 'online';
      return { status: 'auth-returned', code: 0, message: 'Succeeded' };
    },
  });

  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address();
  const apiHeaders = {
    Host: '203.0.113.10:58081',
    Origin: 'http://203.0.113.10:58081',
  };
  const closed = new Promise(resolve => server.once('close', resolve));

  try {
    const page = await httpRequest(port, 'GET', '/', { Host: '203.0.113.10:58081' });
    assert.equal(page.status, 200);
    assert.equal(page.headers['cache-control'], 'no-store');
    assert.match(page.body, /密码登录/);
    assert.match(page.body, /钉钉扫码/);

    const denied = await httpRequest(port, 'GET', '/status', { Host: '203.0.113.10:58081', Origin: 'http://evil.test' });
    assert.equal(denied.status, 403);

    const directStatus = await httpRequest(port, 'GET', '/status?mode=password', { Host: '203.0.113.10:58081' });
    assert.equal(directStatus.status, 200);
    const directBody = JSON.parse(directStatus.body);
    assert.equal(directBody.status, 'logout');
    assert.equal(directBody.socks5, null);

    const qrRes = await httpRequest(port, 'POST', '/refresh', apiHeaders);
    assert.equal(qrRes.status, 200);
    assert.equal(dingTalkRefreshes, 1);
    assert.equal(JSON.parse(qrRes.body).image, ONE_PIXEL_PNG);

    const cap1 = await httpRequest(port, 'POST', '/password/captcha', apiHeaders);
    assert.equal(cap1.status, 200);
    const cap1Body = JSON.parse(cap1.body);
    assert.equal(cap1Body.width, 272);
    assert.equal(cap1Body.height, 192);
    assert.ok(cap1Body.challenge);

    const pwdStatus = await httpRequest(port, 'GET', '/status?mode=password', apiHeaders);
    assert.equal(pwdStatus.status, 200);
    assert.equal(JSON.parse(pwdStatus.body).captchaActive, true);

    const badLogin = await httpRequest(port, 'POST', '/password/login', { ...apiHeaders, 'Content-Type': 'application/json' }, JSON.stringify({
      username: 'alice',
      password: 'wrong-pass',
      domain: 'ShenLan',
      challenge: cap1Body.challenge,
      width: 272,
      height: 192,
      coordinates: [[20, 30]],
    }));
    assert.equal(badLogin.status, 400);
    const badBody = JSON.parse(badLogin.body);
    assert.equal(badBody.ok, false);
    assert.doesNotMatch(badBody.error, /wrong-pass/);
    assert.doesNotMatch(badBody.error, /alice/);

    const cap2 = await httpRequest(port, 'POST', '/password/captcha', apiHeaders);
    const cap2Body = JSON.parse(cap2.body);
    const okPayload = JSON.stringify({
      username: 'alice',
      password: 'good-password',
      domain: 'ShenLan',
      challenge: cap2Body.challenge,
      width: 272,
      height: 192,
      coordinates: [[20, 30], [100, 120]],
    });
    const okLogin = await httpRequest(port, 'POST', '/password/login', { ...apiHeaders, 'Content-Type': 'application/json' }, okPayload);
    assert.equal(okLogin.status, 200);
    const okBody = JSON.parse(okLogin.body);
    assert.equal(okBody.ok, true);
    assert.equal(okBody.status, 'online');
    assert.equal(okBody.closing, true);
    assert.deepEqual(okBody.socks5, {
      host: '127.0.0.1',
      port: 1080,
      address: '127.0.0.1:1080',
      auth: false,
      localOnly: true,
    });
    assert.equal(loginCalls, 2);

    await closed;
    assert.equal(server.listening, false);
    await assert.rejects(() => httpRequest(port, 'GET', '/status', apiHeaders));
  } finally {
    if (server.listening) await new Promise(resolve => server.close(resolve));
  }
});

test('auto-closes login server when client enters online state in background', async () => {
  let statusValue = 'logout';
  const server = createServer({
    publicPorts: [58081],
    autoCloseTimeoutMs: 60000,
    statusPollIntervalMs: 25,
    closeDelayMs: 30,
    getLoginStatus: () => statusValue,
    readDingTalk: async () => ({ image: null, frames: [], sources: [] }),
    fetchCaptcha: async () => { throw new Error('unused'); },
    submitPassword: async () => { throw new Error('unused'); },
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const closed = new Promise(resolve => server.once('close', resolve));
  try {
    assert.equal(server.listening, true);
    statusValue = 'online';
    await closed;
    assert.equal(server.listening, false);
  } finally {
    if (server.listening) await new Promise(resolve => server.close(resolve));
  }
});

test('auto-closes login server after idle timeout without login', async () => {
  const server = createServer({
    publicPorts: [58081],
    autoCloseTimeoutMs: 60,
    statusPollIntervalMs: 25,
    closeDelayMs: 20,
    getLoginStatus: () => 'logout',
    readDingTalk: async () => ({ image: null, frames: [], sources: [] }),
    fetchCaptcha: async () => { throw new Error('unused'); },
    submitPassword: async () => { throw new Error('unused'); },
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const closed = new Promise(resolve => server.once('close', resolve));
  try {
    await closed;
    assert.equal(server.listening, false);
  } finally {
    if (server.listening) await new Promise(resolve => server.close(resolve));
  }
});

test('atrust_qr.html hides hidden containers, omits token gate, displays SOCKS5 port after login, and handles auto-close', () => {
  const html = fs.readFileSync(path.join(__dirname, 'atrust_qr.html'), 'utf8');
  assert.match(html, /\[hidden\]\{display:none !important\}/);
  assert.doesNotMatch(html, /id="tokenGate"/);
  assert.doesNotMatch(html, /id="tokenInput"/);
  assert.doesNotMatch(html, /Authorization/);
  assert.match(html, /id="socksInfo"[^>]*hidden/);
  assert.match(html, /id="socksAddress"/);
  assert.match(html, /id="socksPort"/);
  assert.match(html, /无账号密码/);
  assert.match(html, /仅允许本地连接/);
  assert.match(html, /自动关闭/);
  const scriptMatch = html.match(/<script>([\s\S]*?)<\/script>/);
  assert.ok(scriptMatch, 'expected inline script block');
  assert.doesNotThrow(() => new Function(scriptMatch[1]));
});

test('parseSocksPort and buildSocks5Info enforce local-only no-auth metadata', () => {
  assert.equal(parseSocksPort(undefined), 1080);
  assert.equal(parseSocksPort('1080'), 1080);
  assert.equal(parseSocksPort('11080'), 11080);
  for (const invalid of ['', '0', '-1', '70000', 'abc', '1080.5']) {
    assert.equal(parseSocksPort(invalid), 1080);
  }
  assert.deepEqual(buildSocks5Info(11080), {
    host: '127.0.0.1',
    port: 11080,
    address: '127.0.0.1:11080',
    auth: false,
    localOnly: true,
  });
});

test('GET /status returns configured local-only no-auth SOCKS5 port only after login', async () => {
  let statusValue = 'logout';
  const server = createServer({
    publicPorts: [58081],
    socksPort: 11080,
    autoCloseTimeoutMs: 60000,
    statusPollIntervalMs: 0,
    closeDelayMs: 50,
    getLoginStatus: () => statusValue,
    readDingTalk: async () => ({ image: ONE_PIXEL_PNG, frames: [], sources: [] }),
    fetchCaptcha: async () => { throw new Error('unused'); },
    submitPassword: async () => { throw new Error('unused'); },
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address();
  const headers = { Host: '203.0.113.10:58081', Origin: 'http://203.0.113.10:58081' };
  const closed = new Promise(resolve => server.once('close', resolve));
  try {
    const before = await httpRequest(port, 'GET', '/status?mode=dingtalk', headers);
    assert.equal(before.status, 200);
    assert.equal(JSON.parse(before.body).socks5, null);

    statusValue = 'online';
    const after = await httpRequest(port, 'GET', '/status?mode=dingtalk', headers);
    assert.equal(after.status, 200);
    const body = JSON.parse(after.body);
    assert.equal(body.status, 'online');
    assert.equal(body.closing, true);
    assert.deepEqual(body.socks5, {
      host: '127.0.0.1',
      port: 11080,
      address: '127.0.0.1:11080',
      auth: false,
      localOnly: true,
    });
    await closed;
  } finally {
    if (server.listening) await new Promise(resolve => server.close(resolve));
  }
});

test('fetchCaptchaWithReload reuses valid form without reloading window', async () => {
  let reloadCalls = 0;
  const form = { url: 'https://vpn.hziee.edu.cn/passport/v1/public/checkCode?rnd=1', master: 'master.js', contents: { session: 's1' } };
  const result = await fetchCaptchaWithReload({
    findForm: async () => form,
    reloadForm: async () => {
      reloadCalls += 1;
      return form;
    },
    readImage: async () => Buffer.from('valid-image'),
    decodeImage: () => ({
      isEmpty: () => false,
      getSize: () => ({ width: 272, height: 192 }),
      toPNG: () => Buffer.from([1, 2, 3]),
    }),
    wait: async () => {},
  });
  assert.equal(reloadCalls, 0);
  assert.equal(result.width, 272);
  assert.equal(result.height, 192);
  assert.equal(result.image, 'data:image/png;base64,' + Buffer.from([1, 2, 3]).toString('base64'));
});

test('fetchCaptchaWithReload reloads login window when stale session returns non-image JSON', async () => {
  let reloadCalls = 0;
  let readCalls = 0;
  const staleForm = { url: 'https://vpn.hziee.edu.cn/passport/v1/public/checkCode?rnd=1', master: 'master.js', contents: { session: 'stale' } };
  const freshForm = { url: 'https://vpn.hziee.edu.cn/passport/v1/public/checkCode?rnd=2', master: 'master.js', contents: { session: 'fresh' } };
  const result = await fetchCaptchaWithReload({
    findForm: async () => staleForm,
    reloadForm: async () => {
      reloadCalls += 1;
      return freshForm;
    },
    readImage: async (_url, session) => {
      readCalls += 1;
      if (session === 'stale') {
        return Buffer.from(JSON.stringify({ code: 75500002, message: '会话无效' }));
      }
      return Buffer.from('fresh-image');
    },
    decodeImage: bytes => {
      if (bytes.toString('utf8').startsWith('{')) {
        return { isEmpty: () => true };
      }
      return {
        isEmpty: () => false,
        getSize: () => ({ width: 272, height: 192 }),
        toPNG: () => Buffer.from([4, 5, 6]),
      };
    },
    wait: async () => {},
  });
  assert.equal(reloadCalls, 1);
  assert.equal(readCalls, 2);
  assert.equal(result.contents, freshForm.contents);
  assert.equal(result.width, 272);
});

test('fetchCaptchaWithReload retries briefly after reload if session initializes asynchronously', async () => {
  let reloadCalls = 0;
  let readCalls = 0;
  const freshForm = { url: 'https://vpn.hziee.edu.cn/passport/v1/public/checkCode?rnd=2', master: 'master.js', contents: { session: 'fresh' } };
  const result = await fetchCaptchaWithReload({
    findForm: async () => null,
    reloadForm: async () => {
      reloadCalls += 1;
      return freshForm;
    },
    readImage: async () => {
      readCalls += 1;
      if (readCalls === 1) {
        return Buffer.from(JSON.stringify({ code: 75500002, message: '会话无效' }));
      }
      return Buffer.from('ready-image');
    },
    decodeImage: bytes => (bytes.toString('utf8').startsWith('{')
      ? { isEmpty: () => true }
      : { isEmpty: () => false, getSize: () => ({ width: 272, height: 192 }), toPNG: () => Buffer.from([7, 8]) }),
    wait: async () => {},
  });
  assert.equal(reloadCalls, 1);
  assert.equal(readCalls, 2);
  assert.equal(result.width, 272);
});

test('fetchCaptchaWithReload fails with sanitized hint if captcha stays invalid after reload', async () => {
  let reloadCalls = 0;
  const form = { url: 'https://vpn.hziee.edu.cn/passport/v1/public/checkCode?rnd=1', master: 'master.js', contents: { session: 's1' } };
  await assert.rejects(
    () => fetchCaptchaWithReload({
      findForm: async () => form,
      reloadForm: async () => {
        reloadCalls += 1;
        return form;
      },
      readImage: async () => Buffer.from(JSON.stringify({ code: 75500002, message: '会话无效' })),
      decodeImage: () => ({ isEmpty: () => true }),
      wait: async () => {},
    }),
    /官方验证码返回内容不是有效图片.*75500002.*会话无效/,
  );
  assert.equal(reloadCalls, 1);
});
