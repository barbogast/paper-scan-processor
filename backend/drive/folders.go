package drive

import (
	"context"
	"fmt"
	"strings"
)

// Item represents a file or folder in Google Drive.
type Item struct {
	ID       string `json:"id"`
	Name     string `json:"name"`
	IsFolder bool   `json:"isFolder"`
	Size     int64  `json:"size"` // bytes; 0 for folders
}

// escapeQueryValue escapes a value for embedding in a single-quoted Drive
// query string literal, per Drive's query syntax rules for special characters.
var escapeQueryValue = strings.NewReplacer(`\`, `\\`, `'`, `\'`).Replace

// FindFolder returns the ID of the first folder named name within parentID.
// Use "root" for the Drive root.
func FindFolder(ctx context.Context, parentID, name string) (string, error) {
	svc, err := service(ctx)
	if err != nil {
		return "", err
	}
	q := fmt.Sprintf(
		"name = '%s' and mimeType = 'application/vnd.google-apps.folder' and '%s' in parents and trashed = false",
		escapeQueryValue(name), escapeQueryValue(parentID),
	)
	result, err := svc.Files.List().Q(q).Fields("files(id, name)").Do()
	if err != nil {
		return "", fmt.Errorf("find folder %q: %w", name, err)
	}
	if len(result.Files) == 0 {
		return "", fmt.Errorf("folder %q not found in parent %q", name, parentID)
	}
	return result.Files[0].Id, nil
}

// ListFolder returns the direct children of the folder with the given ID,
// folders first then files, both sorted by name.
// Note: capped at 1000 items (Drive's max page size). Folders sort before
// files, so this only truncates subfolders once a single folder has more
// than 1000 direct subfolders — not a realistic case for this tool.
func ListFolder(ctx context.Context, folderID string) ([]Item, error) {
	svc, err := service(ctx)
	if err != nil {
		return nil, err
	}
	q := fmt.Sprintf("'%s' in parents and trashed = false", escapeQueryValue(folderID))
	result, err := svc.Files.List().
		Q(q).
		Fields("files(id, name, mimeType, size)").
		OrderBy("folder,name").
		PageSize(1000).
		Do()
	if err != nil {
		return nil, fmt.Errorf("list folder %q: %w", folderID, err)
	}
	items := make([]Item, len(result.Files))
	for i, f := range result.Files {
		items[i] = Item{
			ID:       f.Id,
			Name:     f.Name,
			IsFolder: f.MimeType == "application/vnd.google-apps.folder",
			Size:     f.Size,
		}
	}
	return items, nil
}
