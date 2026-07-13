package drive

// Run: go test -v -run TestListFolders -timeout 120s

import (
	"context"
	"testing"
)

const rootFolderName = "scan"

func TestListFolders(t *testing.T) {
	skipUnlessEnabled(t)
	ctx := context.Background()

	// Find "scan" at the Drive root.
	scanID, err := FindFolder(ctx, "root", rootFolderName)
	if err != nil {
		t.Fatalf("FindFolder: %v", err)
	}
	t.Logf("Found %q (id=%s)", rootFolderName, scanID)

	// List contents of "scan".
	items, err := ListFolder(ctx, scanID)
	if err != nil {
		t.Fatalf("ListFolder(%q): %v", rootFolderName, err)
	}
	logItems(t, rootFolderName, items)

	// List the first subfolder found inside "scan".
	for _, item := range items {
		if !item.IsFolder {
			continue
		}
		subItems, err := ListFolder(ctx, item.ID)
		if err != nil {
			t.Fatalf("ListFolder(%q): %v", item.Name, err)
		}
		logItems(t, rootFolderName+"/"+item.Name, subItems)
		break
	}
}

func logItems(t *testing.T, label string, items []Item) {
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
