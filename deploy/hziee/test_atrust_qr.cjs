const assert = require('node:assert/strict');
const test = require('node:test');
const { trustedFrame, authorized, qrData } = require('./atrust_qr.cjs');

test('only reads official client and DingTalk login frames', () => {
  assert.equal(trustedFrame('https://login.dingtalk.com/oauth2/auth'), true);
  assert.equal(trustedFrame('https://vpn.hziee.edu.cn/portal/index.html'), true);
  assert.equal(trustedFrame('file:///usr/share/sangfor/aTrust/resources/app/web/index.html'), true);
  for (const url of ['https://login.dingtalk.com.evil.test/', 'http://login.dingtalk.com/', 'https://evil.test/', 'file:///etc/passwd']) {
    assert.equal(trustedFrame(url), false);
  }
});

test('requires local Host, exact Origin and current bearer token', () => {
  const headers = { host: '127.0.0.1:28081', authorization: 'Bearer secret' };
  assert.equal(authorized(headers, 'secret'), true);
  assert.equal(authorized({ ...headers, origin: 'http://127.0.0.1:28081' }, 'secret'), true);
  for (const extra of [{ host: 'evil.test' }, { origin: 'http://evil.test' }, { authorization: 'Bearer old' }]) {
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
