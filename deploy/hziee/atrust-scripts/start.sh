#!/bin/bash

xvfb_pid=""
keepalive_pid=""
sangfor_pid=""

cleanup() {
	for pid in "$sangfor_pid" "$keepalive_pid" "$xvfb_pid"; do
		if [ -n "$pid" ]; then
			kill "$pid" 2>/dev/null || true
		fi
	done
	exit 0
}

detect_bridge_gateway() {
	local ip_cmd="${IP_CMD:-ip}"
	local gw=""
	gw=$("$ip_cmd" -4 route show default 2>/dev/null | awk '/^default/ {for (i=1; i<=NF; i++) if ($i=="via") {print $(i+1); exit}}')
	if [[ "$gw" =~ ^([0-9]{1,3}\.){3}[0-9]{1,3}$ ]]; then
		printf '%s\n' "$gw"
	fi
}

render_danted_conf() {
	local conf_path="${1:-/run/danted.conf}"
	local ip_cmd="${IP_CMD:-ip}"
	local vpn_tun="${VPN_TUN:-utun7}"
	local ipv6=""
	local bridge_gw=""
	local iface=""

	ipv6=$("$ip_cmd" -6 a 2>/dev/null || true)
	bridge_gw=$(detect_bridge_gateway)

	{
		printf 'errorlog: /dev/stderr\n\n'
		printf 'internal: 0.0.0.0 port = 1080\n'
		if [[ -n "$ipv6" ]]; then
			printf 'internal: :: port = 1080\n'
		fi
		for iface in $("$ip_cmd" -o addr 2>/dev/null | sed -E 's/^[0-9]+: ([^:@ ]+).*/\1/' | sort -u | grep -Ev 'sit|vir' || true); do
			if [[ -n "$iface" && "$iface" != "$vpn_tun" ]]; then
				printf 'external: %s\n' "$iface"
			fi
		done
		printf 'external: %s\n' "$vpn_tun"
		printf 'external.rotation: route\n\n'
		printf 'user.privileged: root\n'
		printf 'user.notprivileged: socks\n\n'
		printf 'clientmethod: none\n'
		printf 'socksmethod: none\n\n'
		printf 'client pass {\n\tfrom: 127.0.0.0/8 to: 0.0.0.0/0\n\tlog: error\n}\n'
		if [[ -n "$bridge_gw" ]]; then
			printf 'client pass {\n\tfrom: %s/32 to: 0.0.0.0/0\n\tlog: error\n}\n' "$bridge_gw"
		fi
		if [[ -n "$ipv6" ]]; then
			printf 'client pass {\n\tfrom: ::1/128 to: ::/0\n\tlog: error\n}\n'
		fi
		printf 'client block {\n\tfrom: 0/0 to: 0/0\n\tlog: error\n}\n\n'
		printf 'socks pass {\n\tfrom: 127.0.0.0/8 to: 0/0\n\tcommand: bind connect udpassociate\n\tlog: error\n}\n'
		if [[ -n "$bridge_gw" ]]; then
			printf 'socks pass {\n\tfrom: %s/32 to: 0/0\n\tcommand: bind connect udpassociate\n\tlog: error\n}\n' "$bridge_gw"
		fi
		if [[ -n "$ipv6" ]]; then
			printf 'socks pass {\n\tfrom: ::1/128 to: 0/0\n\tcommand: bind connect udpassociate\n\tlog: error\n}\n'
		fi
		printf 'socks pass {\n\tfrom: 0/0 to: 0/0\n\tcommand: bindreply udpreply\n\tlog: error\n}\n'
	} > "$conf_path"
}

start_danted() {
	render_danted_conf /run/danted.conf
	open_port 1080
	if ip tuntap add mode tun "$VPN_TUN"; then
		ip addr add 10.0.0.1/32 dev "$VPN_TUN"
		sleep 2
		/usr/sbin/danted -D -f /run/danted.conf
		ip tuntap del mode tun "$VPN_TUN"
	else
		echo 'Failed to create tun interface! Please check whether /dev/net/tun is available.' >&2
		exit 1
	fi
}

start_tinyproxy() {
	open_port 8888
	tinyproxy -c /etc/tinyproxy.conf
}

config_vpn_iptables() {
	iptables -t nat -A POSTROUTING -o "$VPN_TUN" -j MASQUERADE
	open_port 4440
	iptables -t nat -N SANGFOR_OUTPUT
	iptables -t nat -A PREROUTING -j SANGFOR_OUTPUT
	iptables -A INPUT -m state --state ESTABLISHED,RELATED -j ACCEPT
	iptables -A INPUT -i "$VPN_TUN" -p tcp -j DROP
}

force_open_ports() {
	local tmp_port=20000
	local port
	for port in $FORCE_OPEN_PORTS; do
		open_port "$port"
		open_port "$tmp_port"
		iptables -t nat -A PREROUTING -p tcp --dport "$port" -m addrtype --dst-type LOCAL -j REDIRECT --to-port "$tmp_port"
		socat "tcp-listen:${tmp_port},reuseaddr,fork" "tcp4:127.0.0.1:${port}" &
		tmp_port=$((tmp_port + 1))
	done
}

start_xvfb() {
	local display_num="${DISPLAY#:}"
	display_num="${display_num%%.*}"
	mkdir -p /tmp/.X11-unix
	chmod 1777 /tmp/.X11-unix
	rm -f "/tmp/.X${display_num}-lock" "/tmp/.X11-unix/X${display_num}"
	Xvfb "$DISPLAY" -screen 0 1280x800x24 -nolisten tcp >/dev/null 2>&1 &
	xvfb_pid=$!
	local attempt=0
	while [ "$attempt" -lt 50 ]; do
		if [ -S "/tmp/.X11-unix/X${display_num}" ]; then
			return 0
		fi
		if ! kill -0 "$xvfb_pid" 2>/dev/null; then
			echo "Xvfb exited unexpectedly while initializing display $DISPLAY" >&2
			exit 1
		fi
		sleep 0.1
		attempt=$((attempt + 1))
	done
	echo "Timed out waiting for Xvfb display $DISPLAY" >&2
	exit 1
}

main() {
	eval "$(detect-iptables.sh)"
	eval "$(detect-route.sh)"
	eval "$(vpn-config.sh)"
	trap cleanup INT TERM

	for f in /tmp/* /tmp/.*; do
		[ "/tmp/." = "$f" ] || [ "/tmp/.." = "$f" ] || [ "/tmp/.X11-unix" = "$f" ] && continue
		rm -rf -- "$f"
	done

	ulimit -n 1048576
	config_vpn_iptables
	force_open_ports
	start_tinyproxy
	start_danted

	if [ -z "$DISPLAY" ]; then
		export DISPLAY=:1
		start_xvfb
	fi

	/usr/local/bin/keepalive-ping.sh &
	keepalive_pid=$!

	[ -n "$EXIT" ] && export MAX_RETRY=0
	start-sangfor.sh &
	sangfor_pid=$!
	wait "$sangfor_pid"
}

if [[ "${BASH_SOURCE[0]}" == "$0" ]]; then
	main "$@"
fi
