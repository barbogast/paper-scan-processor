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

// mergePDFs interleaves pages from pathA and pathB into outPath.
// If firstPageInA is true, file A contributes the odd-numbered output pages (1, 3, 5, …);
// otherwise file B does. If reverseB is true, file B's pages are reversed before interleaving,
// which is the typical case when the paper stack was flipped between scans.
// If the page counts differ, the extra pages from the longer file are
// appended in order after the interleaved section.
func mergePDFs(pathA, pathB, outPath string, firstPageInA, reverseB bool, skipA, skipB []int, rotationsA, rotationsB map[int]int) error {
	tmpDir, err := os.MkdirTemp("", "psp-merge-*")
	if err != nil {
		return err
	}
	defer os.RemoveAll(tmpDir)

	dirA := filepath.Join(tmpDir, "a")
	dirB := filepath.Join(tmpDir, "b")
	for _, d := range []string{dirA, dirB} {
		if err := os.MkdirAll(d, 0o755); err != nil {
			return err
		}
	}

	if err := api.SplitFile(pathA, dirA, 1, nil); err != nil {
		return fmt.Errorf("splitting file A: %w", err)
	}
	if err := api.SplitFile(pathB, dirB, 1, nil); err != nil {
		return fmt.Errorf("splitting file B: %w", err)
	}

	pagesA, err := sortedPDFsInDir(dirA)
	if err != nil {
		return fmt.Errorf("listing file A pages: %w", err)
	}
	pagesB, err := sortedPDFsInDir(dirB)
	if err != nil {
		return fmt.Errorf("listing file B pages: %w", err)
	}

	pagesA = filterSkipped(pagesA, skipA)
	pagesB = filterSkipped(pagesB, skipB)
	if reverseB {
		slices.Reverse(pagesB)
	}

	if err := applyRotations(pagesA, rotationsA); err != nil {
		return fmt.Errorf("rotating file A pages: %w", err)
	}
	if err := applyRotations(pagesB, rotationsB); err != nil {
		return fmt.Errorf("rotating file B pages: %w", err)
	}

	if firstPageInA {
		return api.MergeCreateFile(interleave(pagesA, pagesB), outPath, false, nil)
	}
	return api.MergeCreateFile(interleave(pagesB, pagesA), outPath, false, nil)
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

// applyRotations rotates individual single-page PDF files in-place according to
// the rotations map (1-indexed page number → clockwise degrees: 90, 180, 270).
// The page number is derived from the pdfcpu split filename.
func applyRotations(pages []string, rotations map[int]int) error {
	for _, p := range pages {
		origPage := pdfFromPage(filepath.Base(p))
		rot, ok := rotations[origPage]
		if !ok || rot == 0 {
			continue
		}
		tmp := p + ".rot.pdf"
		if err := api.RotateFile(p, tmp, rot, nil, nil); err != nil {
			return fmt.Errorf("page %d: %w", origPage, err)
		}
		if err := os.Rename(tmp, p); err != nil {
			return err
		}
	}
	return nil
}

// splitPDF writes one output PDF per segment to outDir, returning paths in order.
// segments[i] is the ordered list of 1-indexed original page numbers for segment i;
// skipped pages are simply absent and reordered pages appear in caller-specified order.
// rotations keys are 1-indexed original page numbers (same numbering as segments values),
// not positions within a segment.
func splitPDF(inPath string, segments [][]int, rotations map[int]int, outDir string) ([]string, error) {
	tmpDir, err := os.MkdirTemp("", "psp-split-pages-*")
	if err != nil {
		return nil, err
	}
	defer os.RemoveAll(tmpDir)

	if err := api.SplitFile(inPath, tmpDir, 1, nil); err != nil {
		return nil, fmt.Errorf("splitting to single pages: %w", err)
	}
	allPages, err := sortedPDFsInDir(tmpDir)
	if err != nil {
		return nil, fmt.Errorf("listing single pages: %w", err)
	}

	if len(rotations) > 0 {
		if err := applyRotations(allPages, rotations); err != nil {
			return nil, fmt.Errorf("rotating pages: %w", err)
		}
	}

	var outPaths []string
	for i, pages := range segments {
		if len(pages) == 0 {
			return nil, fmt.Errorf("output file %d has no pages", i+1)
		}
		segFiles := make([]string, len(pages))
		for j, page := range pages {
			segFiles[j] = allPages[page-1]
		}
		outPath := filepath.Join(outDir, fmt.Sprintf("segment-%d.pdf", i+1))
		if err := api.MergeCreateFile(segFiles, outPath, false, nil); err != nil {
			return nil, fmt.Errorf("building segment %d: %w", i+1, err)
		}
		outPaths = append(outPaths, outPath)
	}
	return outPaths, nil
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
