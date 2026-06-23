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

// splitPDF splits the PDF at inPath at the given page boundaries and writes
// each segment to outDir, returning the output file paths in order.
// splitAfter contains 1-indexed page numbers after which a new file begins.
// E.g. splitAfter=[2,4] on a 6-page PDF produces three files: pages 1-2, 3-4, 5-6.
// rotations maps 1-indexed original page numbers to clockwise degrees (90, 180, 270).
func splitPDF(inPath string, splitAfter []int, rotations map[int]int, outDir string) ([]string, error) {
	src := inPath
	if len(rotations) > 0 {
		// Rotate before splitting so SplitByPageNrFile operates on the final pages.
		// Use a subdirectory so sortedPDFsInDir(outDir) doesn't pick up this file.
		preDir := filepath.Join(outDir, "pre")
		if err := os.MkdirAll(preDir, 0o755); err != nil {
			return nil, err
		}
		rotated := filepath.Join(preDir, "rotated.pdf")
		if err := applyRotationsToFile(inPath, rotated, rotations); err != nil {
			return nil, err
		}
		src = rotated
	}

	if len(splitAfter) == 0 {
		outPath := filepath.Join(outDir, "output.pdf")
		if err := copyFile(src, outPath); err != nil {
			return nil, err
		}
		return []string{outPath}, nil
	}

	// SplitByPageNrFile expects the first page of each new segment.
	pageNrs := make([]int, len(splitAfter))
	for i, p := range splitAfter {
		pageNrs[i] = p + 1
	}
	if err := api.SplitByPageNrFile(src, outDir, pageNrs, nil); err != nil {
		return nil, fmt.Errorf("splitting PDF: %w", err)
	}
	return sortedPDFsInDir(outDir)
}

// applyRotationsToFile writes a copy of inPath to outPath with the specified
// page rotations applied. It chains one api.RotateFile call per distinct degree.
func applyRotationsToFile(inPath, outPath string, rotations map[int]int) error {
	byDeg := make(map[int][]string)
	for page, deg := range rotations {
		byDeg[deg] = append(byDeg[deg], fmt.Sprintf("%d", page))
	}

	src := inPath
	i := 0
	for deg, pages := range byDeg {
		dst := outPath
		if i < len(byDeg)-1 {
			dst = fmt.Sprintf("%s.%d.tmp", outPath, i)
		}
		if err := api.RotateFile(src, dst, deg, pages, nil); err != nil {
			return fmt.Errorf("rotate %d°: %w", deg, err)
		}
		if src != inPath {
			os.Remove(src)
		}
		src = dst
		i++
	}
	return nil
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
