package main

import (
	"os"
	"path/filepath"
	"testing"
)

// skipIfNoDriveCredentials skips the test if drive_credentials.json is not in place.
func skipIfNoDriveCredentials(t *testing.T) {
	t.Helper()
	dir, err := driveConfigDir()
	if err != nil {
		t.Skipf("cannot determine config dir: %v", err)
	}
	if _, err := os.Stat(filepath.Join(dir, "drive_credentials.json")); err != nil {
		t.Skipf("Drive credentials not configured; place drive_credentials.json in %s", dir)
	}
}
