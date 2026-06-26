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

// MergePDFs interleaves pages from pathA and pathB and writes the result to outPath.
func (a *App) MergePDFs(pathA, pathB, outPath string, firstPageInA, reverseB bool, skipA, skipB []int, rotationsA, rotationsB map[int]int) error {
	return mergePDFs(pathA, pathB, outPath, firstPageInA, reverseB, skipA, skipB, rotationsA, rotationsB)
}

// PickFolder shows a folder-select dialog and returns the chosen path.
// Returns an empty string if the user cancels.
func (a *App) PickFolder() (string, error) {
	return runtime.OpenDirectoryDialog(a.ctx, runtime.OpenDialogOptions{
		Title: "Choose Output Folder",
	})
}

// OutputFileSpec describes one output file for ExportSplit.
type OutputFileSpec struct {
	Pages  []int  `json:"pages"`  // ordered 1-indexed original page numbers (skipped/reordered by caller)
	Name   string `json:"name"`   // filename without extension; falls back to "output-N" if empty
	OutDir string `json:"outDir"` // destination directory
}

// ExportSplit writes one output PDF per entry in files, assembling pages in the
// order given by each entry's Pages list.
// rotations maps 1-indexed original page numbers to clockwise degrees (90, 180, 270).
func (a *App) ExportSplit(inPath string, files []OutputFileSpec, rotations map[int]int) error {
	tmpDir, err := os.MkdirTemp("", "psp-split-*")
	if err != nil {
		return err
	}
	defer os.RemoveAll(tmpDir)

	segments := make([][]int, len(files))
	for i, f := range files {
		segments[i] = f.Pages
	}

	paths, err := splitPDF(inPath, segments, rotations, tmpDir)
	if err != nil {
		return err
	}

	for i, src := range paths {
		name := strings.TrimSpace(files[i].Name)
		if name == "" {
			name = fmt.Sprintf("output-%d", i+1)
		}
		if !strings.HasSuffix(strings.ToLower(name), ".pdf") {
			name += ".pdf"
		}
		if err := copyFile(src, filepath.Join(files[i].OutDir, name)); err != nil {
			return err
		}
	}
	return nil
}
