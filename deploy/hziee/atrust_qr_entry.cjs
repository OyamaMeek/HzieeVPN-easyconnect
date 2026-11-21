const clientRoot = '/usr/share/sangfor/aTrust/resources/app';
require(clientRoot + '/src/main.before-qr.js');
require('/root/.atrust-qr/atrust_qr.cjs').start(require('electron'), require(clientRoot + '/src/model/app_config.js'), require(clientRoot + '/src/controller/mainwin_controller.js'));
