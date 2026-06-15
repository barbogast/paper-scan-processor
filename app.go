package main

import (
	"context"
	"encoding/base64"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"strconv"

	"github.com/wailsapp/wails/v2/pkg/runtime"
)

// App struct
type App struct {
	ctx context.Context
}

// NewApp creates a new App application struct
func NewApp() *App {
	return &App{}
}

// startup is called when the app starts. The context is saved
// so we can call the runtime methods
func (a *App) startup(ctx context.Context) {
	a.ctx = ctx
}

// OpenPDF shows a file-open dialog filtered to PDFs and returns the selected path.
// Returns an empty string if the user cancels.
func (a *App) OpenPDF() (string, error) {
	path, err := runtime.OpenFileDialog(a.ctx, runtime.OpenDialogOptions{
		Title: "Open PDF",
		Filters: []runtime.FileFilter{
			{DisplayName: "PDF Files (*.pdf)", Pattern: "*.pdf"},
		},
	})
	return path, err
}

// PageCount returns the number of pages in the PDF at path.
func (a *App) PageCount(path string) (int, error) {
	return pdfPageCount(path)
}

// RenderPage renders a single page of the PDF at path as a PNG and returns it
// base64-encoded. widthPx controls the output width; height is scaled proportionally.
func (a *App) RenderPage(path string, pageNum int, widthPx int) (string, error) {
	tmpDir, err := os.MkdirTemp("", "psp-render-*")
	if err != nil {
		return "", err
	}
	defer os.RemoveAll(tmpDir)

	outPrefix := filepath.Join(tmpDir, "page")
	page := strconv.Itoa(pageNum)

	out, err := exec.Command(
		"pdftoppm",
		"-f", page,
		"-l", page,
		"-singlefile",
		"-png",
		"-scale-to-x", strconv.Itoa(widthPx),
		"-scale-to-y", "-1",
		path,
		outPrefix,
	).CombinedOutput()
	if err != nil {
		return "", fmt.Errorf("pdftoppm: %w\n%s", err, out)
	}

	data, err := os.ReadFile(outPrefix + ".png")
	if err != nil {
		return "", err
	}
	return base64.StdEncoding.EncodeToString(data), nil
}
