const assert = require('node:assert/strict');
const { execFileSync, spawn, spawnSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');

const REPO_ROOT = path.resolve(__dirname, '..', '..');
const SCRIPTS_DIR = path.join(__dirname, 'atrust-scripts');
const KEEPALIVE_SCRIPT = path.join(SCRIPTS_DIR, 'keepalive-ping.sh');
const VPN_CONFIG_SCRIPT = path.join(SCRIPTS_DIR, 'vpn-config.sh');
const START_SCRIPT = path.join(SCRIPTS_DIR, 'start.sh');
const START_SANGFOR_SCRIPT = path.join(SCRIPTS_DIR, 'start-sangfor.sh');
const COMPOSE_ATRUST = path.join(__dirname, 'compose.atrust.yaml');
const DOCKERFILE_ATRUST = path.join(REPO_ROOT, 'Dockerfile.atrust');

function makeStubBinDir(t) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'atrust-runtime-test-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const logFile = path.join(dir, 'calls.log');
  const writeStub = (name, body) => {
    const filePath = path.join(dir, name);
    fs.writeFileSync(filePath, '#!/bin/sh\n' + body, { mode: 0o755 });
    return filePath;
  };
  writeStub('fake-ping', `printf 'ping:%s\\n' "$*" >> "${logFile}"\nexit "\${STUB_PING_EXIT:-0}"\n`);
  writeStub('fake-wget', `printf 'wget:%s\\n' "$*" >> "${logFile}"\nexit "\${STUB_WGET_EXIT:-0}"\n`);
  writeStub('fake-timeout', 'shift\nexec "$@"\n');
  return { dir, logFile };
}

test('all atrust container runtime scripts exist and pass bash -n', () => {
  for (const scriptPath of [KEEPALIVE_SCRIPT, VPN_CONFIG_SCRIPT, START_SCRIPT, START_SANGFOR_SCRIPT]) {
    assert.equal(fs.existsSync(scriptPath), true, `missing script: ${scriptPath}`);
    const check = spawnSync('bash', ['-n', scriptPath], { encoding: 'utf8' });
    assert.equal(check.status, 0, `bash -n failed for ${scriptPath}: ${check.stderr}`);
  }
});

test('keepalive-ping.sh probes 10.130.10.75 via ICMP and HTTP by default', t => {
  const { dir, logFile } = makeStubBinDir(t);
  const result = spawnSync('bash', [KEEPALIVE_SCRIPT], {
    encoding: 'utf8',
    env: {
      ...process.env,
      PING_ONCE: '1',
      PING_CMD: path.join(dir, 'fake-ping'),
      WGET_CMD: path.join(dir, 'fake-wget'),
      TIMEOUT_CMD: path.join(dir, 'fake-timeout'),
    },
  });
  assert.equal(result.status, 0, result.stderr);
  const lines = fs.readFileSync(logFile, 'utf8').trim().split('\n');
  assert.deepEqual(lines, [
    'ping:-c 1 -W 2 -w 2 10.130.10.75',
    'wget:-q -O /dev/null http://10.130.10.75/',
  ]);
});

test('keepalive-ping.sh still runs HTTP probe when ICMP ping fails and respects disabled URL', t => {
  const { dir, logFile } = makeStubBinDir(t);
  const first = spawnSync('bash', [KEEPALIVE_SCRIPT], {
    encoding: 'utf8',
    env: {
      ...process.env,
      PING_ONCE: '1',
      STUB_PING_EXIT: '1',
      PING_CMD: path.join(dir, 'fake-ping'),
      WGET_CMD: path.join(dir, 'fake-wget'),
      TIMEOUT_CMD: path.join(dir, 'fake-timeout'),
    },
  });
  assert.equal(first.status, 0, first.stderr);
  assert.deepEqual(fs.readFileSync(logFile, 'utf8').trim().split('\n'), [
    'ping:-c 1 -W 2 -w 2 10.130.10.75',
    'wget:-q -O /dev/null http://10.130.10.75/',
  ]);

  fs.writeFileSync(logFile, '');
  const second = spawnSync('bash', [KEEPALIVE_SCRIPT], {
    encoding: 'utf8',
    env: {
      ...process.env,
      PING_ONCE: '1',
      PING_ADDR: '10.130.10.75',
      PING_ADDR_URL: '',
      PING_CMD: path.join(dir, 'fake-ping'),
      WGET_CMD: path.join(dir, 'fake-wget'),
      TIMEOUT_CMD: path.join(dir, 'fake-timeout'),
    },
  });
  assert.equal(second.status, 0, second.stderr);
  assert.deepEqual(fs.readFileSync(logFile, 'utf8').trim().split('\n'), [
    'ping:-c 1 -W 2 -w 2 10.130.10.75',
  ]);
});

test('keepalive-ping.sh runs on interval and exits promptly on SIGTERM', async t => {
  const { dir, logFile } = makeStubBinDir(t);
  const child = spawn('bash', [KEEPALIVE_SCRIPT], {
    env: {
      ...process.env,
      PING_INTERVAL: '1',
      PING_CMD: path.join(dir, 'fake-ping'),
      WGET_CMD: path.join(dir, 'fake-wget'),
      TIMEOUT_CMD: path.join(dir, 'fake-timeout'),
    },
    stdio: 'ignore',
  });
  t.after(() => {
    if (child.exitCode === null) child.kill('SIGKILL');
  });

  const deadline = Date.now() + 4000;
  while (Date.now() < deadline) {
    if (fs.existsSync(logFile) && fs.readFileSync(logFile, 'utf8').includes('wget:')) break;
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  assert.equal(fs.existsSync(logFile), true, 'expected keepalive probe to run within interval');
  const output = fs.readFileSync(logFile, 'utf8');
  assert.match(output, /ping:-c 1 -W 2 -w 2 10\.130\.10\.75/);
  assert.match(output, /wget:-q -O \/dev\/null http:\/\/10\.130\.10\.75\//);

  const termSentAt = Date.now();
  child.kill('SIGTERM');
  const exitCode = await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('keepalive-ping.sh did not exit on SIGTERM')), 2000);
    child.once('exit', code => {
      clearTimeout(timer);
      resolve(code);
    });
  });
  assert.equal(exitCode, 0);
  assert.ok(Date.now() - termSentAt < 1500, 'SIGTERM shutdown should not wait for full interval');
});

test('vpn-config.sh emits aTrust-only configuration and honors ATRUST_WEB_PORT', () => {
  const defaultOut = execFileSync(
    'bash',
    ['-c', `eval "$("${VPN_CONFIG_SCRIPT}")"; printf '%s|%s|%s\\n' "$VPN_TUN" "$VPN_PROCS" "$FORCE_OPEN_PORTS"`],
    { encoding: 'utf8', env: { ...process.env, ATRUST_WEB_PORT: '' } },
  ).trim();
  assert.equal(defaultOut, 'utun7|aTrustAgent|54631 58081');

  const customOut = execFileSync(
    'bash',
    ['-c', `eval "$("${VPN_CONFIG_SCRIPT}")"; printf '%s\\n' "$FORCE_OPEN_PORTS"`],
    { encoding: 'utf8', env: { ...process.env, ATRUST_WEB_PORT: '59001' } },
  ).trim();
  assert.equal(customOut, '54631 59001');

  const raw = fs.readFileSync(VPN_CONFIG_SCRIPT, 'utf8');
  for (const forbidden of ['EC_CLI', 'EC_GUI', 'EasyConnect', 'fake-hwaddr']) {
    assert.equal(raw.includes(forbidden), false, `vpn-config.sh should not contain ${forbidden}`);
  }
});

test('start.sh and start-sangfor.sh keep only login web, proxies, headless Xvfb, and keepalive', () => {
  const startRaw = fs.readFileSync(START_SCRIPT, 'utf8');
  const sangforRaw = fs.readFileSync(START_SANGFOR_SCRIPT, 'utf8');

  for (const required of ['start_danted', 'start_tinyproxy', 'start_xvfb', 'Xvfb', 'keepalive-ping.sh', 'start-sangfor.sh', 'force_open_ports']) {
    assert.equal(startRaw.includes(required), true, `start.sh must contain ${required}`);
  }
  for (const forbidden of [
    'tigervnc',
    'novnc',
    'USE_NOVNC',
    'flwm',
    'stalonetray',
    'xclip',
    'CHROMIUM',
    'FORWARD',
    'EC_CLI',
    'EC_GUI',
    'ECPASSWORD',
    'CLIP_TEXT',
    'VNC_SIZE',
    'sync_ec2volume',
    'SOCKS_USER',
    'SOCKS_PASSWD',
    'chpasswd',
    'useradd',
    'socksmethod: username',
  ]) {
    assert.equal(startRaw.includes(forbidden), false, `start.sh should not contain ${forbidden}`);
  }
  for (const forbidden of ['FAKE_HWADDR', 'fake-hwaddr', 'EXIT_LOCK']) {
    assert.equal(sangforRaw.includes(forbidden), false, `start-sangfor.sh should not contain ${forbidden}`);
  }
});

test('render_danted_conf enforces no-auth and local-only client rules', t => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'atrust-danted-test-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const fakeIp = path.join(dir, 'fake-ip');
  fs.writeFileSync(
    fakeIp,
    [
      '#!/bin/sh',
      'if [ "$1" = "-6" ] && [ "$2" = "a" ]; then',
      '  printf "%s" "${STUB_IPV6:-}"',
      '  exit 0',
      'fi',
      'if [ "$1" = "-4" ] && [ "$2" = "route" ]; then',
      '  printf "%s\\n" "${STUB_DEFAULT_ROUTE-default via 172.18.0.1 dev eth0}"',
      '  exit 0',
      'fi',
      'if [ "$1" = "-o" ] && [ "$2" = "addr" ]; then',
      '  printf "1: lo    inet 127.0.0.1/8 scope host lo\\n2: eth0  inet 172.18.0.2/16 brd 172.18.255.255 scope global eth0\\n3: sit0@NONE inet6 ::/0\\n"',
      '  exit 0',
      'fi',
      'exit 0',
    ].join('\n') + '\n',
    { mode: 0o755 },
  );

  const ipv4Conf = path.join(dir, 'danted-ipv4.conf');
  const res1 = spawnSync(
    'bash',
    ['-c', `source "${START_SCRIPT}"; render_danted_conf "${ipv4Conf}"`],
    {
      encoding: 'utf8',
      env: {
        ...process.env,
        IP_CMD: fakeIp,
        VPN_TUN: 'utun7',
        SOCKS_USER: 'ignored-user',
        SOCKS_PASSWD: 'ignored-pass',
        STUB_IPV6: '',
        STUB_DEFAULT_ROUTE: 'default via 172.18.0.1 dev eth0',
      },
    },
  );
  assert.equal(res1.status, 0, res1.stderr);
  const conf1 = fs.readFileSync(ipv4Conf, 'utf8');
  assert.match(conf1, /^internal: 0\.0\.0\.0 port = 1080$/m);
  assert.doesNotMatch(conf1, /^internal: :: port = 1080$/m);
  assert.match(conf1, /^external: eth0$/m);
  assert.match(conf1, /^external: lo$/m);
  assert.match(conf1, /^external: utun7$/m);
  assert.doesNotMatch(conf1, /^external: sit0$/m);
  assert.match(conf1, /^clientmethod: none$/m);
  assert.match(conf1, /^socksmethod: none$/m);
  assert.doesNotMatch(conf1, /socksmethod:\s*username/);
  assert.doesNotMatch(conf1, /ignored-user|ignored-pass/);
  assert.match(conf1, /client pass \{\s*from: 127\.0\.0\.0\/8 to: 0\.0\.0\.0\/0/);
  assert.match(conf1, /client pass \{\s*from: 172\.18\.0\.1\/32 to: 0\.0\.0\.0\/0/);
  assert.doesNotMatch(conf1, /client pass \{\s*from: 0\/0/);
  assert.match(conf1, /client block \{\s*from: 0\/0 to: 0\/0/);

  const ipv6Conf = path.join(dir, 'danted-ipv6.conf');
  const res2 = spawnSync(
    'bash',
    ['-c', `source "${START_SCRIPT}"; render_danted_conf "${ipv6Conf}"`],
    {
      encoding: 'utf8',
      env: {
        ...process.env,
        IP_CMD: fakeIp,
        VPN_TUN: 'utun7',
        STUB_IPV6: '1: lo: <LOOPBACK,UP>\n    inet6 ::1/128 scope host\n',
        STUB_DEFAULT_ROUTE: '',
      },
    },
  );
  assert.equal(res2.status, 0, res2.stderr);
  const conf2 = fs.readFileSync(ipv6Conf, 'utf8');
  assert.match(conf2, /^internal: :: port = 1080$/m);
  assert.match(conf2, /client pass \{\s*from: ::1\/128 to: ::\/0/);
  assert.doesNotMatch(conf2, /172\.18\.0\.1/);
  assert.match(conf2, /client block \{\s*from: 0\/0 to: 0\/0/);
});

test('compose.atrust.yaml binds SOCKS5 to loopback only and exposes ATRUST_SOCKS_PORT', () => {
  const compose = fs.readFileSync(COMPOSE_ATRUST, 'utf8');
  assert.match(compose, /127\.0\.0\.1:\$\{ATRUST_SOCKS_PORT:-1080\}:1080/);
  assert.match(compose, /ATRUST_SOCKS_PORT=\$\{ATRUST_SOCKS_PORT:-1080\}/);
  assert.doesNotMatch(compose, /SOCKS_USER|SOCKS_PASSWD/);
});

test('Dockerfile.atrust configures minute keepalive to 10.130.10.75 and removes unrelated components', () => {
  const dockerfile = fs.readFileSync(DOCKERFILE_ATRUST, 'utf8');

  for (const required of [
    'ATRUST_SOCKS_PORT=1080',
    'PING_ADDR=10.130.10.75',
    'PING_ADDR_URL=http://10.130.10.75/',
    'PING_INTERVAL=60',
    'xvfb',
    'tigervnc-standalone-server',
    'tigervnc-tools',
    'flwm',
    'stalonetray',
    'xclip',
    'x11-utils',
    '/usr/local/share/novnc',
    '/etc/tinyproxy-novnc.conf',
    '/usr/share/sangfor/EasyConnect',
    '/usr/local/lib/fake-hwaddr.so',
    'deploy/hziee/atrust-scripts/',
    'EXPOSE 1080 8888 58081',
    'CMD ["start.sh"]',
  ]) {
    assert.equal(dockerfile.includes(required), true, `Dockerfile.atrust must include ${required}`);
  }
  assert.equal(dockerfile.includes('FROM scratch'), false, 'Dockerfile.atrust should preserve base layers for incremental pulls');
  assert.equal(/EXPOSE\b.*\b(5901|8080)\b/.test(dockerfile), false, 'Dockerfile.atrust must not expose VNC/noVNC ports');
});
