#!/bin/bash
eval "$(vpn-config.sh)"

while true; do
	vpn_daemon
	vpn_ui

	if [ -n "$MAX_RETRY" ]; then
		((MAX_RETRY--))
		((MAX_RETRY < 0)) && exit 0
	fi

	killall "$VPN_PROCS" 2>/dev/null
	sleep 4
	killall -9 "$VPN_PROCS" 2>/dev/null
done
