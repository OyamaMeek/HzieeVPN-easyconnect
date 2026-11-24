#!/bin/bash
eval "$(detect-iptables.sh)"
eval "$(detect-route.sh)"
eval "$(vpn-config.sh)"

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
trap cleanup INT TERM

start_danted() {
	cp /etc/danted.conf.sample /run/danted.conf

	if [[ -n "$SOCKS_PASSWD" && -n "$SOCKS_USER" ]]; then
		if ! id "$SOCKS_USER" >/dev/null 2>&1; then
			useradd "$SOCKS_USER"
		fi
		echo "$SOCKS_USER:$SOCKS_PASSWD" | chpasswd
		sed -i 's/socksmethod: none/socksmethod: username/g' /run/danted.conf
		echo "use socks5 auth: $SOCKS_USER"
	fi

	local internals=""
	local externals=""
	local ipv6
	ipv6=$(ip -6 a)
	if [[ -n "$ipv6" ]]; then
		internals="internal: 0.0.0.0 port = 1080\\ninternal: :: port = 1080"
	else
		internals="internal: 0.0.0.0 port = 1080"
	fi
	local iface
	for iface in $(ip -o addr | sed -E 's/^[0-9]+: ([^ ]+) .*/\1/' | sort | uniq | grep -v "sit\|vir"); do
		externals="${externals}external: $iface\\n"
	done
	externals="${externals}external: $VPN_TUN\\n"
	sed "/^internal:/c$internals" -i /run/danted.conf
	sed "/^external:/c$externals" -i /run/danted.conf
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
