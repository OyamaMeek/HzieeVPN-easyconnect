#!/bin/bash

PING_ADDR="${PING_ADDR-10.130.10.75}"
PING_ADDR_URL="${PING_ADDR_URL-http://10.130.10.75/}"
PING_INTERVAL="${PING_INTERVAL:-60}"
PING_TIMEOUT="${PING_TIMEOUT:-2}"
PING_URL_TIMEOUT="${PING_URL_TIMEOUT:-10}"
PING_CMD="${PING_CMD:-busybox ping}"
WGET_CMD="${WGET_CMD:-busybox wget}"
TIMEOUT_CMD="${TIMEOUT_CMD-timeout}"
PING_ONCE="${PING_ONCE:-0}"

case "$PING_INTERVAL" in
	''|*[!0-9]*|0) PING_INTERVAL=60 ;;
esac

sleep_pid=""
cleanup() {
	if [ -n "$sleep_pid" ]; then
		kill "$sleep_pid" 2>/dev/null || true
	fi
	exit 0
}
trap cleanup INT TERM

probe_once() {
	if [ -n "$PING_ADDR" ]; then
		$PING_CMD -c 1 -W "$PING_TIMEOUT" -w "$PING_TIMEOUT" "$PING_ADDR" >/dev/null 2>&1 || true
	fi
	if [ -n "$PING_ADDR_URL" ]; then
		if [ -n "$TIMEOUT_CMD" ]; then
			"$TIMEOUT_CMD" "$PING_URL_TIMEOUT" $WGET_CMD -q -O /dev/null "$PING_ADDR_URL" >/dev/null 2>&1 || true
		else
			$WGET_CMD -q -O /dev/null "$PING_ADDR_URL" >/dev/null 2>&1 || true
		fi
	fi
}

if [ "$PING_ONCE" = "1" ]; then
	probe_once
	exit 0
fi

if [ -z "$PING_ADDR" ] && [ -z "$PING_ADDR_URL" ]; then
	exit 0
fi

while true; do
	sleep "$PING_INTERVAL" &
	sleep_pid=$!
	wait "$sleep_pid" 2>/dev/null || true
	sleep_pid=""
	probe_once
done
