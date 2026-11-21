const clientRoot = '/usr/share/sangfor/aTrust/resources/app';
require(clientRoot + '/src/main.js');
require('./atrust_qr.cjs').start(require('electron'), require(clientRoot + '/src/model/app_config.js'));
