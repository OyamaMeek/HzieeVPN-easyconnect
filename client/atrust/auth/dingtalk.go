package auth

import (
	"context"
	"crypto/rand"
	"crypto/subtle"
	_ "embed"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"net"
	"net/http"
	"net/url"
	"strings"
	"sync"
	"time"

	"github.com/mythologyli/zju-connect/log"
)

//go:embed dingtalk.html
var dingTalkPage string

type DingTalkLogin struct {
	Domain string
	Bind   string
}

func (m DingTalkLogin) AuthType() string    { return "auth/dingtalk" }
func (m DingTalkLogin) LoginDomain() string { return m.Domain }

func (m DingTalkLogin) login(s *Session, _ AuthInfo) error {
	web, err := newDingTalkWeb(s, m.Domain)
	if err != nil {
		return err
	}
	bind := m.Bind
	if bind == "" {
		bind = "127.0.0.1:28081"
	}
	listener, err := net.Listen("tcp", bind)
	if err != nil {
		return fmt.Errorf("start DingTalk web login: %w", err)
	}
	_, web.port, _ = net.SplitHostPort(listener.Addr().String())
	server := &http.Server{Handler: web, ReadHeaderTimeout: 5 * time.Second,
		ReadTimeout: 10 * time.Second, WriteTimeout: 30 * time.Second,
		IdleTimeout: 30 * time.Second, MaxHeaderBytes: 8192}
	defer server.Close()
	defer func() {
		ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()
		server.Shutdown(ctx)
	}()
	serveError := make(chan error, 1)
	go func() { serveError <- server.Serve(listener) }()
	log.Printf("DingTalk login page: http://127.0.0.1:%s/#%s", web.port, web.token)
	log.Println("Scan with DingTalk. For a remote server, forward this port over SSH. Login expires in 10 minutes.")
	select {
	case <-web.done:
		_, _, err = s.authConfig(true, false)
		return err
	case err := <-serveError:
		return fmt.Errorf("DingTalk web login stopped: %w", err)
	case <-time.After(10 * time.Minute):
		return fmt.Errorf("DingTalk web login timed out after 10 minutes")
	}
}

type dingTalkConfig struct {
	SupportNewAPI int    `json:"supportNewAPI"`
	AppKey        string `json:"appKey"`
	CorpID        string `json:"corpId"`
	State         string `json:"state"`
	RedirectURI   string `json:"redirect_uri"`
}

func readDingTalkConfig(body []byte, domain, baseHost string) (dingTalkConfig, time.Duration, error) {
	var response struct {
		Code *int `json:"code"`
		Data struct {
			AuthServerInfoList []struct {
				AuthInfo
				Config  dingTalkConfig `json:"dingTalkQrcodeConf"`
				Timeout int            `json:"thirdAuthQrcodeTimeout"`
			} `json:"authServerInfoList"`
		} `json:"data"`
	}
	if err := json.Unmarshal(body, &response); err != nil {
		return dingTalkConfig{}, 0, fmt.Errorf("decode DingTalk configuration: %w", err)
	}
	if response.Code == nil || *response.Code != 0 {
		return dingTalkConfig{}, 0, fmt.Errorf("DingTalk configuration did not report success")
	}
	for _, item := range response.Data.AuthServerInfoList {
		if item.AuthType != "auth/dingtalk" || item.LoginDomain != domain {
			continue
		}
		config := item.Config
		callback, err := url.Parse(config.RedirectURI)
		base, baseErr := url.Parse("https://" + baseHost)
		if err != nil || baseErr != nil || !sameDingTalkEndpoint(callback, base) || callback.Path != "/passport/v1/auth/dingtalk" || callback.Query().Get("sfDomain") != domain {
			return dingTalkConfig{}, 0, fmt.Errorf("invalid DingTalk callback endpoint")
		}
		if config.SupportNewAPI != 1 || config.AppKey == "" || config.CorpID == "" || config.State == "" || item.Timeout < 1 || item.Timeout > 600 {
			return dingTalkConfig{}, 0, fmt.Errorf("DingTalk QR configuration is incomplete or does not support the current login API")
		}
		return config, time.Duration(item.Timeout) * time.Second, nil
	}
	return dingTalkConfig{}, 0, fmt.Errorf("DingTalk login domain not found")
}

func sameDingTalkEndpoint(a, b *url.URL) bool {
	if a.Scheme != "https" || a.User != nil || a.Fragment != "" || !strings.EqualFold(a.Hostname(), b.Hostname()) {
		return false
	}
	port := func(u *url.URL) string {
		if u.Port() == "" {
			return "443"
		}
		return u.Port()
	}
	return port(a) == port(b)
}

func (c dingTalkConfig) frameURL() string {
	query := url.Values{"iframe": {"true"}, "redirect_uri": {c.RedirectURI},
		"response_type": {"code"}, "client_id": {c.AppKey}, "scope": {"openid corpid"},
		"state": {c.State}, "corpId": {c.CorpID}, "prompt": {"consent"}}
	return "https://login.dingtalk.com/oauth2/auth?" + query.Encode()
}

func (c dingTalkConfig) callbackURL(raw string) (string, error) {
	callback, err := url.Parse(raw)
	expected, _ := url.Parse(c.RedirectURI)
	if err != nil || len(raw) > 8192 || !sameDingTalkEndpoint(callback, expected) || callback.Path != expected.Path {
		return "", fmt.Errorf("扫码回调地址无效，请刷新二维码重试。")
	}
	query := callback.Query()
	for _, key := range []string{"authCode", "state", "sfDomain"} {
		if len(query[key]) != 1 || query.Get(key) == "" {
			return "", fmt.Errorf("扫码回调缺少有效参数，请刷新二维码重试。")
		}
	}
	if subtle.ConstantTimeCompare([]byte(query.Get("state")), []byte(c.State)) != 1 || query.Get("sfDomain") != expected.Query().Get("sfDomain") {
		return "", fmt.Errorf("二维码已更新，请使用当前二维码扫码。")
	}
	values := expected.Query()
	values.Set("authCode", query.Get("authCode"))
	values.Set("state", c.State)
	values.Set("supportNewAPI", "1")
	for key, value := range WithSharedParams(nil) {
		values[key] = value
	}
	expected.RawQuery = values.Encode()
	return expected.String(), nil
}

type dingTalkWeb struct {
	session *Session
	domain  string
	config  dingTalkConfig
	expires time.Time
	token   string
	port    string
	done    chan struct{}
	mu      sync.Mutex
	used    bool
}

func newDingTalkWeb(session *Session, domain string) (*dingTalkWeb, error) {
	config, timeout, err := readDingTalkConfig(session.response["authConfig"], domain, session.baseHost)
	if err != nil {
		return nil, err
	}
	var token [32]byte
	if _, err := rand.Read(token[:]); err != nil {
		return nil, err
	}
	return &dingTalkWeb{session: session, domain: domain, config: config,
		expires: time.Now().Add(timeout), token: hex.EncodeToString(token[:]),
		port: "28081", done: make(chan struct{})}, nil
}

func (w *dingTalkWeb) ServeHTTP(writer http.ResponseWriter, request *http.Request) {
	writer.Header().Set("Cache-Control", "no-store")
	writer.Header().Set("Referrer-Policy", "no-referrer")
	writer.Header().Set("X-Content-Type-Options", "nosniff")
	writer.Header().Set("Content-Security-Policy", "default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; frame-src https://login.dingtalk.com; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'")
	if request.Host != "127.0.0.1:"+w.port && request.Host != "localhost:"+w.port ||
		(request.Header.Get("Origin") != "" && request.Header.Get("Origin") != "http://"+request.Host) {
		http.Error(writer, "请通过 SSH 转发后的本机地址访问。", http.StatusForbidden)
		return
	}
	if request.URL.Path == "/" && request.Method == http.MethodGet {
		writer.Header().Set("Content-Type", "text/html; charset=utf-8")
		io.WriteString(writer, dingTalkPage)
		return
	}
	if subtle.ConstantTimeCompare([]byte(request.Header.Get("Authorization")), []byte("Bearer "+w.token)) != 1 {
		http.Error(writer, "请使用终端输出的完整访问链接。", http.StatusForbidden)
		return
	}
	w.mu.Lock()
	defer w.mu.Unlock()
	if w.used {
		http.Error(writer, "本次扫码认证已经提交。", http.StatusConflict)
		return
	}
	if request.URL.Path == "/api/refresh" && request.Method == http.MethodPost {
		if _, _, err := w.session.authConfig(false, true); err != nil {
			http.Error(writer, "无法连接学校认证入口，请稍后刷新重试。", http.StatusBadGateway)
			return
		}
		config, timeout, err := readDingTalkConfig(w.session.response["authConfig"], w.domain, w.session.baseHost)
		if err != nil {
			http.Error(writer, err.Error(), http.StatusBadGateway)
			return
		}
		w.config, w.expires = config, time.Now().Add(timeout)
	} else if request.URL.Path != "/api/config" || request.Method != http.MethodGet {
		if request.URL.Path != "/api/submit" || request.Method != http.MethodPost {
			http.Error(writer, "页面不存在。", http.StatusNotFound)
			return
		}
		if time.Now().After(w.expires) {
			http.Error(writer, "二维码已过期，请刷新后重新扫码。", http.StatusConflict)
			return
		}
		if request.Header.Get("Content-Type") != "application/json" {
			http.Error(writer, "请提交 JSON 格式。", http.StatusBadRequest)
			return
		}
		var payload struct {
			RedirectURL string `json:"redirectUrl"`
		}
		body := http.MaxBytesReader(writer, request.Body, 16384)
		decoder := json.NewDecoder(body)
		decoder.DisallowUnknownFields()
		if err := decoder.Decode(&payload); err != nil {
			http.Error(writer, "扫码结果格式无效。", http.StatusBadRequest)
			return
		}
		if decoder.Decode(new(any)) != io.EOF {
			http.Error(writer, "扫码结果只能包含一个 JSON 对象。", http.StatusBadRequest)
			return
		}
		callback, err := w.config.callbackURL(payload.RedirectURL)
		if err != nil {
			http.Error(writer, err.Error(), http.StatusBadRequest)
			return
		}
		if err := w.session.completeDingTalk(callback); err != nil {
			http.Error(writer, err.Error(), http.StatusBadGateway)
			return
		}
		w.used = true
		writer.Header().Set("Content-Type", "application/json; charset=utf-8")
		io.WriteString(writer, `{"message":"扫码认证已通过，VPN 客户端正在继续认证和建立连接；连接结果请查看终端。"}`)
		close(w.done)
		return
	}
	writer.Header().Set("Content-Type", "application/json; charset=utf-8")
	json.NewEncoder(writer).Encode(map[string]any{"frameUrl": w.config.frameURL(), "expiresAt": w.expires.UnixMilli()})
}

func (s *Session) completeDingTalk(callback string) error {
	req, err := http.NewRequest(http.MethodGet, callback, nil)
	if err != nil {
		return fmt.Errorf("创建学校认证请求失败。")
	}
	req.Header.Set("User-Agent", UserAgent)
	req.Header.Set("x-csrf-token", s.csrfToken)
	req.Header.Set("x-sdp-env", s.env)
	req.Header.Set("x-sdp-traceid", s.randSdpId())
	client := *s.client
	client.CheckRedirect = func(*http.Request, []*http.Request) error { return http.ErrUseLastResponse }
	response, err := client.Do(req)
	if err != nil {
		return fmt.Errorf("无法连接学校认证接口，请刷新二维码后重试。")
	}
	defer response.Body.Close()
	if response.StatusCode == http.StatusFound {
		ticket, err := parsePortalTicketFromRedirect(response.Header.Get("Location"), s.baseHost)
		if err != nil {
			return fmt.Errorf("学校认证跳转无效，请查看客户端日志。")
		}
		s.ticket = ticket
		return nil
	}
	if response.StatusCode != http.StatusOK {
		return fmt.Errorf("学校认证接口返回 HTTP %d。", response.StatusCode)
	}
	var result struct {
		Code *int `json:"code"`
		Data struct {
			Ticket string `json:"ticket"`
		} `json:"data"`
	}
	if err := json.NewDecoder(io.LimitReader(response.Body, 1<<20)).Decode(&result); err != nil {
		return fmt.Errorf("学校认证响应格式无效，请刷新二维码后重试。")
	}
	if result.Code == nil {
		return fmt.Errorf("学校认证响应缺少结果代码，请刷新二维码后重试。")
	}
	if *result.Code != 0 || result.Data.Ticket == "" {
		return fmt.Errorf("学校扫码认证未完成（代码 %d），请刷新二维码后重试。", *result.Code)
	}
	s.ticket = result.Data.Ticket
	return nil
}
