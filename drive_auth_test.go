package main

// Prerequisites for TestDriveAuthenticate:
//
//  1. Go to https://console.cloud.google.com, create a project, enable the Drive API.
//  2. Under APIs & Services > Credentials, create an OAuth 2.0 Client ID (type: Desktop app).
//     Add http://localhost as an authorized redirect URI.
//  3. Download the JSON and save it to:
//     ~/Library/Application Support/paper-scan-processor/drive_credentials.json
//
// Run: go test -v -run TestDriveAuthenticate -timeout 120s

import (
	"context"
	"errors"
	"fmt"
	"net"
	"net/http"
	"net/http/httptest"
	"path/filepath"
	"strings"
	"sync/atomic"
	"testing"
	"time"

	"golang.org/x/oauth2"
)

func TestDriveAuthenticate(t *testing.T) {
	skipUnlessDriveEnabled(t)
	ctx := context.Background()

	svc, err := driveService(ctx)
	if err != nil {
		t.Fatalf("driveService: %v", err)
	}

	about, err := svc.About.Get().Fields("user").Do()
	if err != nil {
		t.Fatalf("About.Get: %v", err)
	}
	fmt.Printf("Authenticated as: %s <%s>\n", about.User.DisplayName, about.User.EmailAddress)
}

// Below: fully automated unit tests for driveClientWithConfig and
// driveRunOAuthFlow. These hit a local httptest.Server standing in for
// Google's token endpoint, and simulate the browser consent step by
// requesting driveRunOAuthFlow's callback URL directly — no network access,
// no browser, and no DRIVE_TESTS gating needed.

func fakeOAuthConfig(tokenURL string) *oauth2.Config {
	return &oauth2.Config{
		ClientID:     "test-client-id",
		ClientSecret: "test-client-secret",
		Endpoint: oauth2.Endpoint{
			AuthURL:  "http://example.invalid/auth",
			TokenURL: tokenURL,
		},
		RedirectURL: "http://localhost:" + driveOAuthPort + driveOAuthCallbackPath,
	}
}

func writeTokenJSON(w http.ResponseWriter, accessToken string) {
	w.Header().Set("Content-Type", "application/json")
	fmt.Fprintf(w, `{"access_token":%q,"token_type":"Bearer","expires_in":3600}`, accessToken)
}

func writeOAuthError(w http.ResponseWriter, code string) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusBadRequest)
	fmt.Fprintf(w, `{"error":%q,"error_description":"boom"}`, code)
}

func TestDriveClientWithConfigNoStoredToken(t *testing.T) {
	tokenPath := filepath.Join(t.TempDir(), "drive_token.json")
	cfg := fakeOAuthConfig("http://example.invalid/token") // never dialed: no stored token to refresh

	var reauthCalled bool
	wantToken := &oauth2.Token{AccessToken: "new-access", RefreshToken: "new-refresh", Expiry: time.Now().Add(time.Hour)}
	reauth := func(ctx context.Context, cfg *oauth2.Config) (*oauth2.Token, error) {
		reauthCalled = true
		return wantToken, nil
	}

	client, err := driveClientWithConfig(context.Background(), cfg, tokenPath, reauth)
	if err != nil {
		t.Fatalf("driveClientWithConfig: %v", err)
	}
	if client == nil {
		t.Fatal("client = nil, want non-nil")
	}
	if !reauthCalled {
		t.Error("reauth was not called for a missing token file")
	}

	got, err := driveLoadToken(tokenPath)
	if err != nil {
		t.Fatalf("driveLoadToken: %v", err)
	}
	if got.AccessToken != wantToken.AccessToken {
		t.Errorf("persisted AccessToken = %q, want %q", got.AccessToken, wantToken.AccessToken)
	}
}

func TestDriveClientWithConfigValidTokenSkipsRefresh(t *testing.T) {
	tokenPath := filepath.Join(t.TempDir(), "drive_token.json")
	stored := &oauth2.Token{AccessToken: "still-valid", RefreshToken: "unused-refresh", Expiry: time.Now().Add(time.Hour)}
	if err := driveSaveToken(tokenPath, stored); err != nil {
		t.Fatal(err)
	}

	// atomic.Bool: net/http serves each request on its own goroutine, so this
	// flag is written from the server's goroutine and read from the test's.
	var tokenEndpointHit atomic.Bool
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		tokenEndpointHit.Store(true)
		writeTokenJSON(w, "should-not-happen")
	}))
	t.Cleanup(srv.Close)
	cfg := fakeOAuthConfig(srv.URL)

	var reauthCalled bool
	reauth := func(ctx context.Context, cfg *oauth2.Config) (*oauth2.Token, error) {
		reauthCalled = true
		return nil, errors.New("reauth should not be called")
	}

	client, err := driveClientWithConfig(context.Background(), cfg, tokenPath, reauth)
	if err != nil {
		t.Fatalf("driveClientWithConfig: %v", err)
	}
	if client == nil {
		t.Fatal("client = nil, want non-nil")
	}
	if tokenEndpointHit.Load() {
		t.Error("token endpoint was hit for a still-valid access token")
	}
	if reauthCalled {
		t.Error("reauth was called for a still-valid access token")
	}
}

func TestDriveClientWithConfigRefreshesExpiredToken(t *testing.T) {
	tokenPath := filepath.Join(t.TempDir(), "drive_token.json")
	stored := &oauth2.Token{AccessToken: "old-access", RefreshToken: "valid-refresh", Expiry: time.Now().Add(-time.Hour)}
	if err := driveSaveToken(tokenPath, stored); err != nil {
		t.Fatal(err)
	}

	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		writeTokenJSON(w, "new-access")
	}))
	t.Cleanup(srv.Close)
	cfg := fakeOAuthConfig(srv.URL)

	reauth := func(ctx context.Context, cfg *oauth2.Config) (*oauth2.Token, error) {
		return nil, errors.New("reauth should not be called")
	}

	if _, err := driveClientWithConfig(context.Background(), cfg, tokenPath, reauth); err != nil {
		t.Fatalf("driveClientWithConfig: %v", err)
	}

	got, err := driveLoadToken(tokenPath)
	if err != nil {
		t.Fatalf("driveLoadToken: %v", err)
	}
	if got.AccessToken != "new-access" {
		t.Errorf("persisted AccessToken = %q, want %q", got.AccessToken, "new-access")
	}
}

func TestDriveClientWithConfigInvalidGrantFallsBackToReauth(t *testing.T) {
	tokenPath := filepath.Join(t.TempDir(), "drive_token.json")
	stored := &oauth2.Token{AccessToken: "old-access", RefreshToken: "dead-refresh", Expiry: time.Now().Add(-time.Hour)}
	if err := driveSaveToken(tokenPath, stored); err != nil {
		t.Fatal(err)
	}

	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		writeOAuthError(w, "invalid_grant")
	}))
	t.Cleanup(srv.Close)
	cfg := fakeOAuthConfig(srv.URL)

	var reauthCalled bool
	wantToken := &oauth2.Token{AccessToken: "reauth-access", RefreshToken: "reauth-refresh", Expiry: time.Now().Add(time.Hour)}
	reauth := func(ctx context.Context, cfg *oauth2.Config) (*oauth2.Token, error) {
		reauthCalled = true
		return wantToken, nil
	}

	if _, err := driveClientWithConfig(context.Background(), cfg, tokenPath, reauth); err != nil {
		t.Fatalf("driveClientWithConfig: %v", err)
	}
	if !reauthCalled {
		t.Fatal("reauth was not called after an invalid_grant refresh error")
	}

	got, err := driveLoadToken(tokenPath)
	if err != nil {
		t.Fatalf("driveLoadToken: %v", err)
	}
	if got.AccessToken != wantToken.AccessToken {
		t.Errorf("persisted AccessToken = %q, want %q", got.AccessToken, wantToken.AccessToken)
	}
}

func TestDriveClientWithConfigOtherRefreshErrorNotSwallowed(t *testing.T) {
	tokenPath := filepath.Join(t.TempDir(), "drive_token.json")
	stored := &oauth2.Token{AccessToken: "old-access", RefreshToken: "some-refresh", Expiry: time.Now().Add(-time.Hour)}
	if err := driveSaveToken(tokenPath, stored); err != nil {
		t.Fatal(err)
	}

	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		writeOAuthError(w, "invalid_client")
	}))
	t.Cleanup(srv.Close)
	cfg := fakeOAuthConfig(srv.URL)

	var reauthCalled bool
	reauth := func(ctx context.Context, cfg *oauth2.Config) (*oauth2.Token, error) {
		reauthCalled = true
		return nil, errors.New("reauth should not be called")
	}

	_, err := driveClientWithConfig(context.Background(), cfg, tokenPath, reauth)
	if err == nil {
		t.Fatal("driveClientWithConfig: got nil error, want a refresh error")
	}
	if reauthCalled {
		t.Error("reauth was called for a non-invalid_grant refresh error")
	}
}

// hitCallback simulates a browser completing the OAuth consent flow by
// requesting driveRunOAuthFlow's local callback URL directly. It retries
// briefly since the callback server's listener may not be bound yet by the
// time openBrowser is invoked (the same race that exists against a real
// browser, which takes far longer than this loop's window to respond).
func hitCallback(t *testing.T, query string) error {
	t.Helper()
	url := "http://localhost:" + driveOAuthPort + driveOAuthCallbackPath + query
	deadline := time.Now().Add(2 * time.Second)
	var lastErr error
	for time.Now().Before(deadline) {
		resp, err := http.Get(url)
		if err == nil {
			resp.Body.Close()
			return nil
		}
		lastErr = err
		time.Sleep(5 * time.Millisecond)
	}
	return lastErr
}

func withStubOpenBrowser(t *testing.T, stub func(url string) error) {
	t.Helper()
	orig := openBrowser
	openBrowser = stub
	t.Cleanup(func() { openBrowser = orig })
}

func TestDriveRunOAuthFlowSuccess(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		writeTokenJSON(w, "exchanged-access")
	}))
	t.Cleanup(srv.Close)
	cfg := fakeOAuthConfig(srv.URL)

	withStubOpenBrowser(t, func(string) error { return hitCallback(t, "?code=test-code") })

	token, err := driveRunOAuthFlow(context.Background(), cfg)
	if err != nil {
		t.Fatalf("driveRunOAuthFlow: %v", err)
	}
	if token.AccessToken != "exchanged-access" {
		t.Errorf("AccessToken = %q, want %q", token.AccessToken, "exchanged-access")
	}
}

func TestDriveRunOAuthFlowMissingCode(t *testing.T) {
	cfg := fakeOAuthConfig("http://example.invalid/token") // never dialed: code exchange never happens

	withStubOpenBrowser(t, func(string) error { return hitCallback(t, "") })

	_, err := driveRunOAuthFlow(context.Background(), cfg)
	if err == nil || !strings.Contains(err.Error(), "missing code parameter") {
		t.Fatalf("driveRunOAuthFlow error = %v, want it to mention a missing code parameter", err)
	}
}

func TestDriveRunOAuthFlowContextCanceled(t *testing.T) {
	cfg := fakeOAuthConfig("http://example.invalid/token") // never dialed

	withStubOpenBrowser(t, func(string) error { return nil }) // never completes the callback

	ctx, cancel := context.WithTimeout(context.Background(), 20*time.Millisecond)
	defer cancel()

	_, err := driveRunOAuthFlow(ctx, cfg)
	if !errors.Is(err, context.DeadlineExceeded) {
		t.Fatalf("driveRunOAuthFlow error = %v, want context.DeadlineExceeded", err)
	}
}

func TestDriveRunOAuthFlowPortInUse(t *testing.T) {
	ln, err := net.Listen("tcp", ":"+driveOAuthPort)
	if err != nil {
		t.Skipf("port %s unavailable for this test: %v", driveOAuthPort, err)
	}
	defer ln.Close()

	cfg := fakeOAuthConfig("http://example.invalid/token") // never dialed: bind fails first

	withStubOpenBrowser(t, func(string) error { return nil }) // nothing listening for HTTP on this port anyway

	_, err = driveRunOAuthFlow(context.Background(), cfg)
	if err == nil || !strings.Contains(err.Error(), "address already in use") {
		t.Fatalf("driveRunOAuthFlow error = %v, want it to mention the port already being in use", err)
	}
}
