package main

// Run: go test -v -run TestDriveListFolders -timeout 120s

import (
	"context"
	"testing"
)

const driveRootFolderName = "scan"

func TestDriveListFolders(t *testing.T) {
	skipUnlessDriveEnabled(t)
	ctx := context.Background()

	// Find "scan" at the Drive root.
	scanID, err := DriveFindFolder(ctx, "root", driveRootFolderName)
	if err != nil {
		t.Fatalf("DriveFindFolder: %v", err)
	}
	t.Logf("Found %q (id=%s)", driveRootFolderName, scanID)

	// List contents of "scan".
	items, err := DriveListFolder(ctx, scanID)
	if err != nil {
		t.Fatalf("DriveListFolder(%q): %v", driveRootFolderName, err)
	}
	logItems(t, driveRootFolderName, items)

	// List the first subfolder found inside "scan".
	for _, item := range items {
		if !item.IsFolder {
			continue
		}
		subItems, err := DriveListFolder(ctx, item.ID)
		if err != nil {
			t.Fatalf("DriveListFolder(%q): %v", item.Name, err)
		}
		logItems(t, driveRootFolderName+"/"+item.Name, subItems)
		break
	}
}

func logItems(t *testing.T, label string, items []DriveItem) {
	t.Helper()
	t.Logf("Contents of %q (%d items):", label, len(items))
	for _, item := range items {
		kind := "file"
		if item.IsFolder {
			kind = "folder"
		}
		t.Logf("  [%s] %s", kind, item.Name)
	}
}
