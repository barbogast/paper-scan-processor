package drive

import (
	"context"
	"fmt"
	"os"

	"google.golang.org/api/drive/v3"
)

// UploadFile uploads the local file at localPath to the Drive folder with
// the given ID, naming it name on Drive. Returns the ID of the created
// Drive file.
func UploadFile(ctx context.Context, localPath, folderID, name string) (string, error) {
	if name == "" {
		return "", fmt.Errorf("upload %s: name is required", localPath)
	}

	f, err := os.Open(localPath)
	if err != nil {
		return "", fmt.Errorf("open %s: %w", localPath, err)
	}
	defer f.Close()

	svc, err := service(ctx)
	if err != nil {
		return "", err
	}

	meta := &drive.File{
		Name:    name,
		Parents: []string{folderID},
	}
	created, err := svc.Files.Create(meta).Media(f).Fields("id, name, size").Do()
	if err != nil {
		return "", fmt.Errorf("upload %s: %w", localPath, err)
	}
	return created.Id, nil
}
