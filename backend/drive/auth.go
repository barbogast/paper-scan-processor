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

// cachedClient is the authenticated HTTP client built by the most recent
// call to clientWithConfig, reused by service() across calls so Drive
// operations don't re-read and re-parse drive_token.json from disk on every
// call. Safe to share indefinitely because it self-refreshes (see
// persistingTokenSource) rather than holding a fixed access token.
var cachedClient *http.Client

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

	if cachedClient == nil {
		cfg, err := oauthConfig()
		if err != nil {
			return nil, err
		}

		dir, err := configDir()
		if err != nil {
			return nil, err
		}
		// cachedClient's token source outlives this call (that's the point
		// of caching it), so it must not be built against ctx: callers like
		// UploadFile pass a per-call context that gets canceled once that
		// call returns, which would permanently break token refreshes for
		// the rest of the cached client's life. context.Background() here
		// only affects auth/refresh machinery, not the Drive API request
		// below, which still runs under the caller's ctx.
		client, err := clientWithConfig(context.Background(), cfg, filepath.Join(dir, "drive_token.json"), runOAuthFlow)
		if err != nil {
			return nil, err
		}
		cachedClient = client
	}
	return drive.NewService(ctx, option.WithHTTPClient(cachedClient))
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
			return oauth2.NewClient(ctx, newPersistingTokenSource(src, tokenPath, refreshedToken.AccessToken)), nil
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
	src := cfg.TokenSource(ctx, newToken)
	return oauth2.NewClient(ctx, newPersistingTokenSource(src, tokenPath, newToken.AccessToken)), nil
}

// persistingTokenSource wraps an oauth2.TokenSource that refreshes access
// tokens in memory (via its own internal caching) and persists each newly
// issued access/refresh token pair to tokenPath, so a client built once and
// reused across a long-running session (see cachedClient) keeps
// drive_token.json in sync without every caller needing to save it.
type persistingTokenSource struct {
	src  oauth2.TokenSource
	path string

	mu         sync.Mutex
	lastAccess string
}

func newPersistingTokenSource(src oauth2.TokenSource, path, currentAccessToken string) *persistingTokenSource {
	return &persistingTokenSource{src: src, path: path, lastAccess: currentAccessToken}
}

func (p *persistingTokenSource) Token() (*oauth2.Token, error) {
	tok, err := p.src.Token()
	if err != nil {
		return nil, err
	}

	p.mu.Lock()
	defer p.mu.Unlock()
	if tok.AccessToken != p.lastAccess {
		if err := saveToken(p.path, tok); err != nil {
			return nil, fmt.Errorf("save refreshed token: %w", err)
		}
		p.lastAccess = tok.AccessToken
	}
	return tok, nil
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
