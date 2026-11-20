package configs

import "testing"

func TestDefault(t *testing.T) {
	cfg := Default()
	if cfg.Protocol != "atrust" {
		t.Fatalf("Protocol = %q, want atrust", cfg.Protocol)
	}
	if cfg.ServerAddress != "vpn.hziee.edu.cn" {
		t.Fatalf("ServerAddress = %q, want vpn.hziee.edu.cn", cfg.ServerAddress)
	}
	if cfg.ServerPort != 443 {
		t.Fatalf("ServerPort = %d, want 443", cfg.ServerPort)
	}
	if cfg.SocksBind != ":1080" || cfg.HTTPBind != ":8888" {
		t.Fatalf("proxy defaults = %q, %q", cfg.SocksBind, cfg.HTTPBind)
	}
	if cfg.AuthType != "auth/psw" || cfg.LoginDomain != "ShenLan" {
		t.Fatalf("login defaults = %q, %q", cfg.AuthType, cfg.LoginDomain)
	}
	if cfg.KeepAliveURL != "http://10.130.10.75/" {
		t.Fatalf("KeepAliveURL = %q, want school keep-alive URL", cfg.KeepAliveURL)
	}
}
