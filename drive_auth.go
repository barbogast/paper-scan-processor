package main

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"

	"golang.org/x/oauth2"
	"golang.org/x/oauth2/google"
	"google.golang.org/api/drive/v3"
)

const driveOAuthPort = "8765"
const driveOAuthCallbackPath = "/oauth/callback"

// driveConfigDir returns (and creates) ~/Library/Application Support/paper-scan-processor.
func driveConfigDir() (string, error) {
	base, err := os.UserConfigDir()
	if err != nil {
		return "", err
	}
	dir := filepath.Join(base, "paper-scan-processor")
	return dir, os.MkdirAll(dir, 0o700)
}

func driveOAuthConfig() (*oauth2.Config, error) {
	dir, err := driveConfigDir()
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
	cfg.RedirectURL = "http://localhost:" + driveOAuthPort + driveOAuthCallbackPath
	return cfg, nil
}

// driveClient returns an authenticated HTTP client for the Google Drive API.
// On first call, or whenever the stored refresh token has expired or been
// revoked, it opens the system default browser to perform the OAuth flow and
// saves the resulting token for reuse in future sessions.
func driveClient(ctx context.Context) (*http.Client, error) {
	cfg, err := driveOAuthConfig()
	if err != nil {
		return nil, err
	}

	dir, err := driveConfigDir()
	if err != nil {
		return nil, err
	}
	tokenPath := filepath.Join(dir, "drive_token.json")

	// storedToken bundles both the short-lived access token and the
	// long-lived refresh token last persisted to disk.
	if storedToken, err := driveLoadToken(tokenPath); err == nil {
		src := cfg.TokenSource(ctx, storedToken)
		refreshedToken, err := src.Token()
		if err == nil {
			if refreshedToken.AccessToken != storedToken.AccessToken {
				// storedToken.AccessToken had expired, so Token() used
				// storedToken.RefreshToken to obtain a new access token from
				// Google. Persist the pair so future calls reuse it instead
				// of refreshing again.
				if err := driveSaveToken(tokenPath, refreshedToken); err != nil {
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
	newToken, err := driveRunOAuthFlow(ctx, cfg)
	if err != nil {
		return nil, err
	}
	if err := driveSaveToken(tokenPath, newToken); err != nil {
		return nil, fmt.Errorf("save token: %w", err)
	}
	return cfg.Client(ctx, newToken), nil
}

func driveRunOAuthFlow(ctx context.Context, cfg *oauth2.Config) (*oauth2.Token, error) {
	codeCh := make(chan string, 1)
	errCh := make(chan error, 1)

	mux := http.NewServeMux()
	srv := &http.Server{Addr: ":" + driveOAuthPort, Handler: mux}

	mux.HandleFunc(driveOAuthCallbackPath, func(w http.ResponseWriter, r *http.Request) {
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
	if err := exec.Command("open", authURL).Run(); err != nil {
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

func driveLoadToken(path string) (*oauth2.Token, error) {
	f, err := os.Open(path)
	if err != nil {
		return nil, err
	}
	defer f.Close()
	var t oauth2.Token
	return &t, json.NewDecoder(f).Decode(&t)
}

func driveSaveToken(path string, token *oauth2.Token) error {
	f, err := os.Create(path)
	if err != nil {
		return err
	}
	defer f.Close()
	return json.NewEncoder(f).Encode(token)
}
