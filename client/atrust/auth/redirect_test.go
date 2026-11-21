package auth

import "testing"

func TestPortalTicketRedirectNormalizesHTTPSOrigin(t *testing.T) {
	const data = `?data=%7B%22ticket%22%3A%22opaque-ticket%22%7D`
	for _, test := range []struct {
		location string
		host     string
		valid    bool
	}{
		{"https://vpn.example.com:443/portal/shortcut.html" + data, "vpn.example.com", true},
		{"https://vpn.example.com/portal/shortcut.html" + data, "vpn.example.com:443", true},
		{"https://VPN.example.com/portal/shortcut.html" + data, "vpn.example.com", true},
		{"https://vpn.example.com:8443/portal/shortcut.html" + data, "vpn.example.com:8443", true},
		{"https://vpn.example.com:8443/portal/shortcut.html" + data, "vpn.example.com", false},
		{"https://other.example.com/portal/shortcut.html" + data, "vpn.example.com", false},
		{"http://vpn.example.com/portal/shortcut.html" + data, "vpn.example.com", false},
		{"https://user@vpn.example.com/portal/shortcut.html" + data, "vpn.example.com", false},
		{"https://vpn.example.com/other" + data, "vpn.example.com", false},
	} {
		ticket, err := parsePortalTicketFromRedirect(test.location, test.host)
		if test.valid && (err != nil || ticket != "opaque-ticket") {
			t.Fatalf("valid origin %s / %s rejected: %v", test.location, test.host, err)
		}
		if !test.valid && err == nil {
			t.Fatalf("unsafe redirect accepted: %s", test.location)
		}
	}
}
