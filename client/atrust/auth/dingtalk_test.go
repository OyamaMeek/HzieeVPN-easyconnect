package auth

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"net/url"
	"strings"
	"testing"
	"time"
)

const dingTalkConfigFixture = `{"code":0,"data":{"authServerInfoList":[{"authType":"auth/dingtalk","loginDomain":"dingtalk","thirdAuthQrcodeTimeout":60,"dingTalkQrcodeConf":{"supportNewAPI":1,"appKey":"app-key","corpId":"corp-id","appid":"app-id","scope":"snsapi_login","require_url":"https://oapi.dingtalk.com/connect/oauth2/sns_authorize","state":"login-state","response_type":"code","redirect_uri":"https://vpn.example.com:443/passport/v1/auth/dingtalk?sfDomain=dingtalk"}}]}}`

func TestDingTalkConfigUsesSelectedDomain(t *testing.T) {
	config, timeout, err := readDingTalkConfig([]byte(dingTalkConfigFixture), "dingtalk", "vpn.example.com:443")
	if err != nil {
		t.Fatal(err)
	}
	if timeout != time.Minute {
		t.Fatalf("QR expiry = %s", timeout)
	}
	frame, err := url.Parse(config.frameURL())
	if err != nil || frame.Host != "login.dingtalk.com" || frame.Path != "/login/qrcode.htm" {
		t.Fatalf("invalid DingTalk frame URL: %v, %v", frame, err)
	}
	authorize, err := url.Parse(frame.Query().Get("goto"))
	if err != nil || authorize.Host != "oapi.dingtalk.com" || authorize.Query().Get("appid") != "app-id" || authorize.Query().Get("state") != "login-state" {
		t.Fatalf("invalid DingTalk authorization URL: %v, %v", authorize, err)
	}
	exchange, err := url.Parse(config.authorizationURL("temporary+code/="))
	if err != nil || exchange.Query().Get("loginTmpCode") != "temporary+code/=" || exchange.Query().Get("redirect_uri") != "https://vpn.example.com:443/passport/v1/auth/dingtalk?sfDomain=dingtalk" {
		t.Fatalf("temporary code or callback was not encoded correctly: %v", err)
	}
	for _, body := range []string{
		strings.ReplaceAll(dingTalkConfigFixture, `"code":0,`, ""),
		strings.ReplaceAll(dingTalkConfigFixture, "vpn.example.com:443", "other.example.com"),
		strings.ReplaceAll(dingTalkConfigFixture, `"appid":"app-id"`, `"appid":""`),
		strings.ReplaceAll(dingTalkConfigFixture, "https://oapi.dingtalk.com/", "https://other.example.com/"),
		strings.ReplaceAll(dingTalkConfigFixture, `"state":"login-state"`, `"state":""`),
		strings.ReplaceAll(dingTalkConfigFixture, `"thirdAuthQrcodeTimeout":60`, `"thirdAuthQrcodeTimeout":0`),
		`{"code":1,"message":"not ready"}`,
	} {
		if _, _, err := readDingTalkConfig([]byte(body), "dingtalk", "vpn.example.com:443"); err == nil {
			t.Fatal("accepted invalid QR configuration")
		}
	}
	if _, _, err := readDingTalkConfig([]byte(dingTalkConfigFixture), "other", "vpn.example.com:443"); err == nil {
		t.Fatal("accepted a different login domain")
	}
}

func TestDingTalkCallbackRejectsOtherSessions(t *testing.T) {
	config, _, err := readDingTalkConfig([]byte(dingTalkConfigFixture), "dingtalk", "vpn.example.com:443")
	if err != nil {
		t.Fatal(err)
	}
	callback := "https://vpn.example.com/passport/v1/auth/dingtalk?sfDomain=dingtalk&code=one-use-code&state=login-state"
	result, err := config.callbackURL(callback)
	if err != nil {
		t.Fatal(err)
	}
	parsed, _ := url.Parse(result)
	if parsed.Query().Get("code") != "one-use-code" || parsed.Query().Get("supportNewAPI") != "" {
		t.Fatalf("invalid callback parameters: %s", parsed.RawQuery)
	}
	for _, invalid := range []string{
		strings.ReplaceAll(callback, "https:", "http:"),
		strings.ReplaceAll(callback, "vpn.example.com", "other.example.com"),
		strings.ReplaceAll(callback, "auth/dingtalk", "auth/psw"),
		strings.ReplaceAll(callback, "sfDomain=dingtalk", "sfDomain=other"),
		strings.ReplaceAll(callback, "state=login-state", "state=another-session"),
		strings.ReplaceAll(callback, "code=one-use-code", "code="),
		callback + "&state=another-session",
	} {
		if _, err := config.callbackURL(invalid); err == nil {
			t.Fatalf("accepted callback: %s", invalid)
		}
	}
}

func TestDingTalkWebAccessAndExpiry(t *testing.T) {
	session := NewSession("vpn.example.com:443", nil)
	session.response["authConfig"] = json.RawMessage(dingTalkConfigFixture)
	web, err := newDingTalkWeb(session, "dingtalk")
	if err != nil {
		t.Fatal(err)
	}
	for _, tc := range []struct {
		path, token, origin, host string
		want                      int
	}{
		{"/", "", "", "127.0.0.1:28081", 200},
		{"/dingtalk_message.mjs", "", "", "127.0.0.1:28081", 200},
		{"/api/config", "", "", "127.0.0.1:28081", 403},
		{"/api/config", "wrong-token", "", "127.0.0.1:28081", 403},
		{"/api/config", web.token, "http://other.example.com", "127.0.0.1:28081", 403},
		{"/api/config", web.token, "", "other.example.com:28081", 403},
		{"/api/config", web.token, "", "127.0.0.1:28081", 200},
	} {
		request := httptest.NewRequest(http.MethodGet, tc.path, nil)
		request.Host = tc.host
		request.Header.Set("Authorization", "Bearer "+tc.token)
		if tc.origin != "" {
			request.Header.Set("Origin", tc.origin)
		}
		response := httptest.NewRecorder()
		web.ServeHTTP(response, request)
		if response.Code != tc.want {
			t.Fatalf("%s: status %d, want %d", tc.path, response.Code, tc.want)
		}
		if tc.path == "/" && strings.Contains(response.Body.String(), web.token) {
			t.Fatal("public HTML disclosed the access token")
		}
	}
	for _, payload := range []string{
		`not-json`,
		`{"loginTmpCode":""}`,
		`{"loginTmpCode":"code\n"}`,
		`{"loginTmpCode":"one-use-code","unknown":true}`,
		`{"loginTmpCode":"one-use-code"} {}`,
	} {
		request := httptest.NewRequest(http.MethodPost, "/api/submit", strings.NewReader(payload))
		request.Host = "127.0.0.1:28081"
		request.Header.Set("Authorization", "Bearer "+web.token)
		request.Header.Set("Content-Type", "application/json")
		response := httptest.NewRecorder()
		web.ServeHTTP(response, request)
		if response.Code != http.StatusBadRequest {
			t.Fatalf("invalid submission status = %d", response.Code)
		}
	}
	web.expires = time.Now().Add(-time.Second)
	request := httptest.NewRequest(http.MethodPost, "/api/submit", strings.NewReader(`{"redirectUrl":"https://vpn.example.com/"}`))
	request.Host = "127.0.0.1:28081"
	request.Header.Set("Authorization", "Bearer "+web.token)
	request.Header.Set("Content-Type", "application/json")
	response := httptest.NewRecorder()
	web.ServeHTTP(response, request)
	if response.Code != http.StatusConflict {
		t.Fatalf("expired QR submission status = %d", response.Code)
	}
}
