const fs = require('fs');
const clientRoot = '/usr/share/sangfor/aTrust/resources/app';
const webModule = fs.existsSync('/opt/atrust-web/atrust_qr.cjs')
  ? '/opt/atrust-web/atrust_qr.cjs'
  : '/root/.atrust-qr/atrust_qr.cjs';
require(clientRoot + '/src/main.before-qr.js');
require(webModule).start(require('electron'), require(clientRoot + '/src/model/app_config.js'), require(clientRoot + '/src/controller/mainwin_controller.js'));
