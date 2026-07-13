package drive

import (
	"os"
	"path/filepath"
	"testing"
)

// skipUnlessEnabled skips the test unless DRIVE_TESTS=1 is set and
// drive_credentials.json is in place. This prevents Drive integration tests
// from running (and modifying Drive) during normal go test invocations.
//
// To run Drive tests: DRIVE_TESTS=1 go test -v -run TestXxx -timeout 120s
func skipUnlessEnabled(t *testing.T) {
	t.Helper()
	if os.Getenv("DRIVE_TESTS") != "1" {
		t.Skip("set DRIVE_TESTS=1 to run Drive integration tests")
	}
	dir, err := configDir()
	if err != nil {
		t.Skipf("cannot determine config dir: %v", err)
	}
	if _, err := os.Stat(filepath.Join(dir, "drive_credentials.json")); err != nil {
		t.Skipf("Drive credentials not configured; place drive_credentials.json in %s", dir)
	}
}
