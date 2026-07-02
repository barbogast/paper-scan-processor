package main

// Run: go test -v -run TestDriveUploadFile -timeout 120s

import (
	"context"
	"testing"
)

const driveUploadLocalPath = "example-pdfs-merge/backs.pdf"
const driveUploadFolderName = "scan"

func TestDriveUploadFile(t *testing.T) {
	skipUnlessDriveEnabled(t)
	ctx := context.Background()

	folderID, err := DriveFindFolder(ctx, "root", driveUploadFolderName)
	if err != nil {
		t.Fatalf("DriveFindFolder: %v", err)
	}

	fileID, err := DriveUploadFile(ctx, driveUploadLocalPath, folderID)
	if err != nil {
		t.Fatalf("DriveUploadFile: %v", err)
	}
	t.Logf("Uploaded %q to %q (Drive file id=%s)", driveUploadLocalPath, driveUploadFolderName, fileID)
}
