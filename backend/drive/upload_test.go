package drive

// Run: go test -v -run TestUploadFile -timeout 120s

import (
	"context"
	"testing"
)

const uploadLocalPath = "example-pdfs-merge/backs.pdf"
const uploadFolderName = "scan"

func TestUploadFile(t *testing.T) {
	skipUnlessEnabled(t)
	ctx := context.Background()

	folderID, err := FindFolder(ctx, "root", uploadFolderName)
	if err != nil {
		t.Fatalf("FindFolder: %v", err)
	}

	fileID, err := UploadFile(ctx, uploadLocalPath, folderID)
	if err != nil {
		t.Fatalf("UploadFile: %v", err)
	}
	t.Logf("Uploaded %q to %q (Drive file id=%s)", uploadLocalPath, uploadFolderName, fileID)
}
