package main

import (
	"context"
	"fmt"

	"google.golang.org/api/drive/v3"
	"google.golang.org/api/option"
)

// DriveItem represents a file or folder in Google Drive.
type DriveItem struct {
	ID       string
	Name     string
	IsFolder bool
	Size     int64 // bytes; 0 for folders
}

func driveService(ctx context.Context) (*drive.Service, error) {
	client, err := driveClient(ctx)
	if err != nil {
		return nil, err
	}
	return drive.NewService(ctx, option.WithHTTPClient(client))
}

// DriveFindFolder returns the ID of the first folder named name within parentID.
// Use "root" for the Drive root. Folder names with single quotes are not supported.
func DriveFindFolder(ctx context.Context, parentID, name string) (string, error) {
	svc, err := driveService(ctx)
	if err != nil {
		return "", err
	}
	q := fmt.Sprintf(
		"name = '%s' and mimeType = 'application/vnd.google-apps.folder' and '%s' in parents and trashed = false",
		name, parentID,
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

// DriveListFolder returns the direct children of the folder with the given ID,
// folders first then files, both sorted by name.
// Note: results are capped at 100 items (Drive API default page size).
func DriveListFolder(ctx context.Context, folderID string) ([]DriveItem, error) {
	svc, err := driveService(ctx)
	if err != nil {
		return nil, err
	}
	q := fmt.Sprintf("'%s' in parents and trashed = false", folderID)
	result, err := svc.Files.List().
		Q(q).
		Fields("files(id, name, mimeType, size)").
		OrderBy("folder,name").
		Do()
	if err != nil {
		return nil, fmt.Errorf("list folder %q: %w", folderID, err)
	}
	items := make([]DriveItem, len(result.Files))
	for i, f := range result.Files {
		items[i] = DriveItem{
			ID:       f.Id,
			Name:     f.Name,
			IsFolder: f.MimeType == "application/vnd.google-apps.folder",
			Size:     f.Size,
		}
	}
	return items, nil
}
