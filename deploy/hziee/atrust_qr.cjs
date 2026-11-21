const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

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

function localHost(host) {
  return ['127.0.0.1:28081', 'localhost:28081'].includes(host);
}

function authorized(headers, token) {
  return localHost(headers.host) && (!headers.origin || headers.origin === 'http://' + headers.host) &&
    headers.authorization === 'Bearer ' + token;
}

function qrData(value) {
  return typeof value === 'string' && value.length < 262144 && /^data:image\/png;base64,[A-Za-z0-9+/]+={0,2}$/.test(value) ? value : null;
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
  const elements = Array.from(document.querySelectorAll('button,a,[role="button"],span,div')).reverse();
  const element = elements.find(e => e.getClientRects().length && ['钉钉','钉钉登录','钉钉扫码登录'].includes(e.textContent.trim()));
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

function start(electron, appConfig, mainWindow) {
  const tokenPath = path.join(__dirname, 'token');
  const token = crypto.randomBytes(32).toString('hex');
  fs.writeFileSync(tokenPath, token, { mode: 0o600 });
  let busy = false;
  let selectUntil = 0;
  const server = http.createServer(async (request, response) => {
    const headers = {
      'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer',
      'X-Content-Type-Options': 'nosniff', 'X-Frame-Options': 'DENY',
      'Content-Security-Policy': "default-src 'none'; script-src 'self' 'unsafe-inline'; style-src 'unsafe-inline'; img-src data:; connect-src 'self'; frame-ancestors 'none'",
    };
    function send(status, data, type = 'application/json; charset=utf-8') {
      response.writeHead(status, Object.assign({}, headers, { 'Content-Type': type }));
      response.end(typeof data === 'string' ? data : JSON.stringify(data));
    }
    if (!localHost(request.headers.host)) return send(403, { error: '来源不允许' });
    if (request.url === '/' && request.method === 'GET') {
      return send(200, fs.readFileSync(path.join(__dirname, 'atrust_qr.html'), 'utf8'), 'text/html; charset=utf-8');
    }
    if (!authorized(request.headers, token)) return send(403, { error: '登录链接已失效，请重新获取' });
    const refresh = request.url === '/refresh' && request.method === 'POST';
    if (!refresh && !(request.url === '/status' && request.method === 'GET')) return send(404, { error: '接口不存在' });
    if (busy) return send(409, { error: '正在读取客户端，请稍后重试' });
    busy = true;
    try {
      const status = appConfig.getLoginStatus();
      const result = { status, image: null, frames: [], sources: [] };
      if (status === 'logout') {
        if (refresh) {
          selectUntil = Date.now() + 60000;
          mainWindow.closeMainWindow();
          mainWindow.showLoginPagePreCheck('https://vpn.hziee.edu.cn', false, false, true);
        }
        for (const contents of electron.webContents.getAllWebContents()) {
          if (contents.isDestroyed()) continue;
          const source = new URL(contents.getURL() || 'about:blank');
          result.sources.push(source.protocol === 'file:' ? source.pathname : source.origin + source.pathname);
          if (!trustedFrame(contents.getURL())) continue;
          const current = await inspectWindow(contents, Date.now() < selectUntil);
          result.image = current.image || result.image;
          result.frames.push(...current.frames);
        }
        if (result.image) selectUntil = 0;
      }
      send(200, result);
    } catch (error) {
      console.error('[aTrust QR]', error.message);
      send(502, { error: '官方 aTrust 二维码读取失败，请检查客户端日志' });
    } finally {
      busy = false;
    }
  });
  server.requestTimeout = 15000;
  server.on('error', error => console.error('[aTrust QR]', error.message));
  server.listen(28081, '127.0.0.1', () => console.log('[aTrust QR] Ready on container loopback port 28081'));
  electron.app.on('before-quit', () => server.close());
}

module.exports = { trustedFrame, authorized, qrData, start };
