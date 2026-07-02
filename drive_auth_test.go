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
	"fmt"
	"testing"

	"google.golang.org/api/drive/v3"
	"google.golang.org/api/option"
)

func TestDriveAuthenticate(t *testing.T) {
	skipIfNoDriveCredentials(t)
	ctx := context.Background()

	client, err := DriveClient(ctx)
	if err != nil {
		t.Fatalf("DriveClient: %v", err)
	}

	svc, err := drive.NewService(ctx, option.WithHTTPClient(client))
	if err != nil {
		t.Fatalf("drive.NewService: %v", err)
	}

	about, err := svc.About.Get().Fields("user").Do()
	if err != nil {
		t.Fatalf("About.Get: %v", err)
	}
	fmt.Printf("Authenticated as: %s <%s>\n", about.User.DisplayName, about.User.EmailAddress)
}
