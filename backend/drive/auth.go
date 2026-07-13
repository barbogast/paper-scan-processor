package drive

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"sync"

	"golang.org/x/oauth2"
	"golang.org/x/oauth2/google"
	"google.golang.org/api/drive/v3"
	"google.golang.org/api/option"
)

const oauthPort = "8765"
const oauthCallbackPath = "/oauth/callback"

// clientMu serializes service calls. Without it, two concurrent
// callers needing a token refresh or a fresh OAuth flow would each try to
// bind oauthPort for the callback server, and the loser would fail with
// "address already in use" even though the winner's call succeeds.
var clientMu sync.Mutex

// openBrowser launches url in the system default browser. Overridden in
// tests to simulate the user completing the consent flow, instead of
// actually opening a browser.
var openBrowser = func(url string) error { return exec.Command("open", url).Run() }

// configDir returns (and creates) ~/Library/Application Support/paper-scan-processor.
func configDir() (string, error) {
	base, err := os.UserConfigDir()
	if err != nil {
		return "", err
	}
	dir := filepath.Join(base, "paper-scan-processor")
	return dir, os.MkdirAll(dir, 0o700)
}

func oauthConfig() (*oauth2.Config, error) {
	dir, err := configDir()
	if err != nil {
		return nil, err
	}
	credPath := filepath.Join(dir, "drive_credentials.json")
	data, err := os.ReadFile(credPath)
	if err != nil {
		return nil, fmt.Errorf("read %s: %w", credPath, err)
	}
	cfg, err := google.ConfigFromJSON(data, drive.DriveScope)
	if err != nil {
		return nil, fmt.Errorf("parse credentials: %w", err)
	}
	// Override to match our local callback server.
	// In Google Cloud Console, register http://localhost as an authorized redirect URI.
	cfg.RedirectURL = "http://localhost:" + oauthPort + oauthCallbackPath
	return cfg, nil
}

// service returns an authenticated client for the Google Drive API.
// On first call, or whenever the stored refresh token has expired or been
// revoked, it opens the system default browser to perform the OAuth flow and
// saves the resulting token for reuse in future sessions.
func service(ctx context.Context) (*drive.Service, error) {
	clientMu.Lock()
	defer clientMu.Unlock()

	cfg, err := oauthConfig()
	if err != nil {
		return nil, err
	}

	dir, err := configDir()
	if err != nil {
		return nil, err
	}
	client, err := clientWithConfig(ctx, cfg, filepath.Join(dir, "drive_token.json"), runOAuthFlow)
	if err != nil {
		return nil, err
	}
	return drive.NewService(ctx, option.WithHTTPClient(client))
}

// reauthFunc performs a full OAuth flow, returning a fresh token pair.
// runOAuthFlow is the production implementation; tests substitute a stub.
type reauthFunc func(ctx context.Context, cfg *oauth2.Config) (*oauth2.Token, error)

// clientWithConfig holds service's refresh/reauth decision logic,
// parameterized over cfg, tokenPath, and the reauth function so tests can
// supply a fake token endpoint (via cfg.Endpoint.TokenURL) and a stubbed
// reauth instead of hitting Google or opening a real browser.
func clientWithConfig(ctx context.Context, cfg *oauth2.Config, tokenPath string, reauth reauthFunc) (*http.Client, error) {
	// storedToken bundles both the short-lived access token and the
	// long-lived refresh token last persisted to disk.
	if storedToken, err := loadToken(tokenPath); err == nil {
		src := cfg.TokenSource(ctx, storedToken)
		refreshedToken, err := src.Token()
		if err == nil {
			if refreshedToken.AccessToken != storedToken.AccessToken {
				// storedToken.AccessToken had expired, so Token() used
				// storedToken.RefreshToken to obtain a new access token from
				// Google. Persist the pair so future calls reuse it instead
				// of refreshing again.
				if err := saveToken(tokenPath, refreshedToken); err != nil {
					return nil, fmt.Errorf("save refreshed token: %w", err)
				}
			}
			return oauth2.NewClient(ctx, oauth2.StaticTokenSource(refreshedToken)), nil
		}
		var retrieveErr *oauth2.RetrieveError
		if !errors.As(err, &retrieveErr) || retrieveErr.ErrorCode != "invalid_grant" {
			return nil, fmt.Errorf("refresh token: %w", err)
		}
		// storedToken.RefreshToken is dead (expired or revoked) — fall
		// through to re-authenticate from scratch.
	}

	// newToken is a freshly issued access token/refresh token pair from a
	// full browser-based OAuth exchange.
	newToken, err := reauth(ctx, cfg)
	if err != nil {
		return nil, err
	}
	if err := saveToken(tokenPath, newToken); err != nil {
		return nil, fmt.Errorf("save token: %w", err)
	}
	return cfg.Client(ctx, newToken), nil
}

var _ reauthFunc = runOAuthFlow // runOAuthFlow must match reauthFunc's signature

func runOAuthFlow(ctx context.Context, cfg *oauth2.Config) (*oauth2.Token, error) {
	codeCh := make(chan string, 1)
	errCh := make(chan error, 1)

	mux := http.NewServeMux()
	srv := &http.Server{Addr: ":" + oauthPort, Handler: mux}

	mux.HandleFunc(oauthCallbackPath, func(w http.ResponseWriter, r *http.Request) {
		code := r.URL.Query().Get("code")
		if code == "" {
			http.Error(w, "missing code", http.StatusBadRequest)
			errCh <- fmt.Errorf("OAuth callback: missing code parameter")
			return
		}
		fmt.Fprint(w, "<html><body><h1>Authenticated</h1><p>You can close this tab.</p></body></html>")
		codeCh <- code
	})

	go func() {
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			errCh <- err
		}
	}()
	defer srv.Shutdown(context.Background()) //nolint:errcheck

	authURL := cfg.AuthCodeURL("", oauth2.AccessTypeOffline)
	if err := openBrowser(authURL); err != nil {
		return nil, fmt.Errorf("open browser: %w", err)
	}

	select {
	case code := <-codeCh:
		return cfg.Exchange(ctx, code)
	case err := <-errCh:
		return nil, err
	case <-ctx.Done():
		return nil, ctx.Err()
	}
}

func loadToken(path string) (*oauth2.Token, error) {
	f, err := os.Open(path)
	if err != nil {
		return nil, err
	}
	defer f.Close()
	var t oauth2.Token
	return &t, json.NewDecoder(f).Decode(&t)
}

func saveToken(path string, token *oauth2.Token) error {
	f, err := os.Create(path)
	if err != nil {
		return err
	}
	defer f.Close()
	return json.NewEncoder(f).Encode(token)
}
