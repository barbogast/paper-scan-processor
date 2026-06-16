package main

import (
	"fmt"
	"io"
	"os"
	"path/filepath"
	"slices"
	"sort"
	"strings"

	"github.com/pdfcpu/pdfcpu/pkg/api"
)

// mergePDFs interleaves pages from frontPath and backPath into outPath.
// If reverseBack is true the back pages are reversed before interleaving,
// which is the typical case when the paper stack was flipped between scans.
// If the page counts differ, the extra pages from the longer file are
// appended in order after the interleaved section.
func mergePDFs(frontPath, backPath, outPath string, reverseBack bool, skipFront, skipBack []int) error {
	tmpDir, err := os.MkdirTemp("", "psp-merge-*")
	if err != nil {
		return err
	}
	defer os.RemoveAll(tmpDir)

	frontDir := filepath.Join(tmpDir, "front")
	backDir := filepath.Join(tmpDir, "back")
	for _, d := range []string{frontDir, backDir} {
		if err := os.MkdirAll(d, 0o755); err != nil {
			return err
		}
	}

	if err := api.SplitFile(frontPath, frontDir, 1, nil); err != nil {
		return fmt.Errorf("splitting front PDF: %w", err)
	}
	if err := api.SplitFile(backPath, backDir, 1, nil); err != nil {
		return fmt.Errorf("splitting back PDF: %w", err)
	}

	frontPages, err := sortedPDFsInDir(frontDir)
	if err != nil {
		return fmt.Errorf("listing front pages: %w", err)
	}
	backPages, err := sortedPDFsInDir(backDir)
	if err != nil {
		return fmt.Errorf("listing back pages: %w", err)
	}

	frontPages = filterSkipped(frontPages, skipFront)
	backPages = filterSkipped(backPages, skipBack)
	if reverseBack {
		slices.Reverse(backPages)
	}

	return api.MergeCreateFile(interleave(frontPages, backPages), outPath, false, nil)
}

func filterSkipped(pages []string, skip []int) []string {
	if len(skip) == 0 {
		return pages
	}
	skipSet := make(map[int]bool, len(skip))
	for _, p := range skip {
		skipSet[p] = true
	}
	out := make([]string, 0, len(pages))
	for i, p := range pages {
		if !skipSet[i+1] {
			out = append(out, p)
		}
	}
	return out
}

// splitPDF splits the PDF at inPath at the given page boundaries and writes
// each segment to outDir, returning the output file paths in order.
// splitAfter contains 1-indexed page numbers after which a new file begins.
// E.g. splitAfter=[2,4] on a 6-page PDF produces three files: pages 1-2, 3-4, 5-6.
func splitPDF(inPath string, splitAfter []int, outDir string) ([]string, error) {
	if len(splitAfter) == 0 {
		outPath := filepath.Join(outDir, filepath.Base(inPath))
		if err := copyFile(inPath, outPath); err != nil {
			return nil, err
		}
		return []string{outPath}, nil
	}

	// SplitByPageNrFile expects the first page of each new segment.
	pageNrs := make([]int, len(splitAfter))
	for i, p := range splitAfter {
		pageNrs[i] = p + 1
	}

	if err := api.SplitByPageNrFile(inPath, outDir, pageNrs, nil); err != nil {
		return nil, fmt.Errorf("splitting PDF: %w", err)
	}

	return sortedPDFsInDir(outDir)
}

// pdfPageCount returns the number of pages in the PDF at path.
func pdfPageCount(path string) (int, error) {
	return api.PageCountFile(path)
}

// sortedPDFsInDir lists PDF files in dir sorted numerically by the first page
// number encoded in pdfcpu's output filenames (e.g. "doc_3-5.pdf" → 3).
func sortedPDFsInDir(dir string) ([]string, error) {
	entries, err := os.ReadDir(dir)
	if err != nil {
		return nil, err
	}
	type item struct {
		path     string
		fromPage int
	}
	var files []item
	for _, e := range entries {
		if e.IsDir() || !strings.HasSuffix(strings.ToLower(e.Name()), ".pdf") {
			continue
		}
		files = append(files, item{
			path:     filepath.Join(dir, e.Name()),
			fromPage: pdfFromPage(e.Name()),
		})
	}
	sort.Slice(files, func(i, j int) bool { return files[i].fromPage < files[j].fromPage })
	result := make([]string, len(files))
	for i, f := range files {
		result[i] = f.path
	}
	return result, nil
}

// interleave merges two slices by alternating elements: a[0], b[0], a[1], b[1], ...
// If the slices have different lengths, the remaining elements of the longer
// slice are appended in order after the interleaved section.
func interleave[T any](a, b []T) []T {
	n := min(len(a), len(b))
	out := make([]T, 0, len(a)+len(b))
	for i := range n {
		out = append(out, a[i], b[i])
	}
	out = append(out, a[n:]...)
	out = append(out, b[n:]...)
	return out
}

func copyFile(src, dst string) error {
	in, err := os.Open(src)
	if err != nil {
		return err
	}
	defer in.Close()
	out, err := os.Create(dst)
	if err != nil {
		return err
	}
	defer out.Close()
	_, err = io.Copy(out, in)
	return err
}

// pdfFromPage extracts the first page number from a pdfcpu split filename
// such as "doc_1.pdf" or "doc_3-5.pdf".
func pdfFromPage(name string) int {
	name = strings.TrimSuffix(name, ".pdf")
	parts := strings.Split(name, "_")
	if len(parts) == 0 {
		return 0
	}
	rangeStr := parts[len(parts)-1]
	n := 0
	fmt.Sscanf(strings.SplitN(rangeStr, "-", 2)[0], "%d", &n)
	return n
}
