const assert = require('node:assert/strict');
const http = require('node:http');
const test = require('node:test');
const {
  trustedFrame,
  trustedCaptchaUrl,
  allowedHost,
  authorized,
  qrData,
  sanitizeMessage,
  validatePasswordLogin,
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

test('requires allowed loopback or configured high port, exact Origin and current bearer token', () => {
  const headers = { host: '127.0.0.1:28081', authorization: 'Bearer secret' };
  assert.equal(authorized(headers, 'secret'), true);
  assert.equal(authorized({ ...headers, origin: 'http://127.0.0.1:28081' }, 'secret'), true);
  assert.equal(authorized({ host: '203.0.113.10:58081', origin: 'http://203.0.113.10:58081', authorization: 'Bearer secret' }, 'secret'), true);
  assert.equal(authorized({ host: 'vpn.example.com:58081', origin: 'https://vpn.example.com:58081', authorization: 'Bearer secret' }, 'secret'), true);
  assert.equal(authorized({ host: '[::1]:58081', origin: 'http://[::1]:58081', authorization: 'Bearer secret' }, 'secret'), true);
  assert.equal(allowedHost('203.0.113.10:58081'), true);
  assert.equal(allowedHost('203.0.113.10:28081'), false);
  for (const badHost of ['evil.test', '203.0.113.10:80', '203.0.113.10:18081', 'user:pass@203.0.113.10:58081', '203.0.113.10:58081/x', '']) {
    assert.equal(allowedHost(badHost), false);
  }
  for (const extra of [
    { host: 'evil.test' },
    { host: '203.0.113.10:80' },
    { origin: 'http://evil.test' },
    { authorization: 'Bearer old' },
    { authorization: 'Bearer é' },
    { authorization: '' },
  ]) {
    assert.equal(authorized({ ...headers, ...extra }, 'secret'), false);
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

test('unified high-port web server supports password captcha flow and server-side DingTalk QR', async () => {
  let statusValue = 'logout';
  let dingTalkRefreshes = 0;
  let loginCalls = 0;
  const token = 'test-token-value';

  const server = createServer({
    token,
    publicPorts: [58081],
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
    Authorization: 'Bearer ' + token,
  };

  try {
    const page = await httpRequest(port, 'GET', '/', { Host: '203.0.113.10:58081' });
    assert.equal(page.status, 200);
    assert.equal(page.headers['cache-control'], 'no-store');
    assert.match(page.body, /密码登录/);
    assert.match(page.body, /钉钉扫码/);

    const denied = await httpRequest(port, 'GET', '/status', { Host: '203.0.113.10:58081' });
    assert.equal(denied.status, 403);

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
    assert.equal(JSON.parse(okLogin.body).ok, true);
    assert.equal(JSON.parse(okLogin.body).status, 'online');
    assert.equal(loginCalls, 2);

    const replay = await httpRequest(port, 'POST', '/password/login', { ...apiHeaders, 'Content-Type': 'application/json' }, okPayload);
    assert.equal(replay.status, 409);
  } finally {
    await new Promise(resolve => server.close(resolve));
  }
});
