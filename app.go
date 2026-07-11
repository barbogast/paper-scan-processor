package main

import (
	"context"
	"encoding/base64"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"strconv"
	"strings"

	"github.com/wailsapp/wails/v2/pkg/runtime"

	"paper-scan-processor/backend/pdf"
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
	return pdf.PageCount(path)
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

// SavePDF shows a save-file dialog filtered to PDFs and returns the chosen path.
// Returns an empty string if the user cancels.
func (a *App) SavePDF() (string, error) {
	path, err := runtime.SaveFileDialog(a.ctx, runtime.SaveDialogOptions{
		Title:           "Save Merged PDF",
		DefaultFilename: "merged.pdf",
		Filters: []runtime.FileFilter{
			{DisplayName: "PDF Files (*.pdf)", Pattern: "*.pdf"},
		},
	})
	if err != nil || path == "" {
		return path, err
	}
	if !strings.HasSuffix(strings.ToLower(path), ".pdf") {
		path += ".pdf"
	}
	return path, nil
}

// OpenFile opens the file at path with the system default application.
func (a *App) OpenFile(path string) error {
	return exec.Command("open", path).Run()
}

// DeleteFile removes the file at path.
func (a *App) DeleteFile(path string) error {
	return os.Remove(path)
}

// MergePDFs interleaves pages from pathA and pathB and writes the result to outPath.
func (a *App) MergePDFs(pathA, pathB, outPath string, firstPageInA, reverseB bool, skipA, skipB []int, rotationsA, rotationsB map[int]int) error {
	return pdf.MergePDFs(pathA, pathB, outPath, firstPageInA, reverseB, skipA, skipB, rotationsA, rotationsB)
}

// PickFolder shows a folder-select dialog with the given title and returns
// the chosen path. Returns an empty string if the user cancels.
func (a *App) PickFolder(title string) (string, error) {
	return runtime.OpenDirectoryDialog(a.ctx, runtime.OpenDialogOptions{
		Title: title,
	})
}

// ScanLocalRoot recursively scans root and returns it as a LocalFileGroup
// tree (nested to match the folder structure), with size and page count
// metadata for each file.
func (a *App) ScanLocalRoot(root string) (LocalFileGroup, error) {
	return scanLocalRoot(root)
}

// ListDriveFolder returns the direct children of the Drive folder with the
// given ID ("root" for the top level of My Drive), folders first then
// files. Triggers the OAuth flow on first use if no token is cached yet.
func (a *App) ListDriveFolder(folderID string) ([]DriveItem, error) {
	return DriveListFolder(a.ctx, folderID)
}

// outputFileDest returns the destination path for the i-th pdf.OutputFileSpec.
func outputFileDest(files []pdf.OutputFileSpec, i int) string {
	name := strings.TrimSpace(files[i].Name)
	if name == "" {
		name = fmt.Sprintf("output-%d", i+1)
	}
	if !strings.HasSuffix(strings.ToLower(name), ".pdf") {
		name += ".pdf"
	}
	return filepath.Join(files[i].OutDir, name)
}

// CheckConflicts returns the destination paths that already exist on disk.
func (a *App) CheckConflicts(files []pdf.OutputFileSpec) ([]string, error) {
	conflicts := []string{}
	for i := range files {
		dest := outputFileDest(files, i)
		if _, err := os.Stat(dest); err == nil {
			conflicts = append(conflicts, dest)
		}
	}
	return conflicts, nil
}

// ExportSplit splits the PDF at inPath according to files and writes each
// segment to its OutDir using its Name.
// Each file's Pages lists the original (1-indexed) page numbers in display
// order; skip filtering and reordering have already been applied by the caller.
// rotations maps 1-indexed page numbers to clockwise degrees (90, 180, 270).
func (a *App) ExportSplit(inPath string, files []pdf.OutputFileSpec, rotations map[int]int) error {
	tmpDir, err := os.MkdirTemp("", "psp-split-*")
	if err != nil {
		return err
	}
	defer os.RemoveAll(tmpDir)

	paths, err := pdf.SplitPDF(inPath, files, rotations, tmpDir)
	if err != nil {
		return err
	}

	for i, src := range paths {
		if err := pdf.CopyFile(src, outputFileDest(files, i)); err != nil {
			return err
		}
	}
	return nil
}
