#!/bin/bash
echo 'SANGFOR_ROOT=/usr/share/sangfor
VPN_ROOT=$SANGFOR_ROOT/aTrust
VPN_RESOURCES=$VPN_ROOT/resources
VPN_BIN=$VPN_RESOURCES/bin
VPN_CONF=$VPN_RESOURCES/conf
VPN_UI=$VPN_ROOT/aTrustTray
VPN_TUN=utun7
FORCE_OPEN_PORTS="54631 ${ATRUST_WEB_PORT:-58081}"
VPN_PROCS=aTrustAgent
vpn_daemon() {
	FAKE_LOGIN=sangfor LD_PRELOAD=/usr/local/lib/fake-getlogin.so LD_LIBRARY_PATH="$VPN_ROOT:$VPN_BIN:${LD_LIBRARY_PATH}" \
		$VPN_BIN/aTrustAgent --plugin plugin-daemon --plugin-cmd \| >/dev/null &
}
vpn_ui() {
	$VPN_UI --no-sandbox
}'
