package pdf

import (
	"bytes"
	"os"
	"path/filepath"
	"slices"
	"testing"

	"github.com/pdfcpu/pdfcpu/pkg/api"
	"paper-scan-processor/backend/pdftest"
)

// pdfPageRotation returns the rotation (in degrees) of the given 1-indexed page.
func pdfPageRotation(t *testing.T, path string, pageNum int) int {
	t.Helper()
	ctx, err := api.ReadContextFile(path)
	if err != nil {
		t.Fatalf("reading context of %s: %v", path, err)
	}
	_, _, inhAttrs, err := ctx.XRefTable.PageDict(pageNum, false)
	if err != nil {
		t.Fatalf("reading page dict %d of %s: %v", pageNum, path, err)
	}
	return inhAttrs.Rotate
}

// --- interleave unit tests ---

func TestInterleaveEqual(t *testing.T) {
	got := interleave([]string{"A", "B", "C"}, []string{"X", "Y", "Z"})
	want := []string{"A", "X", "B", "Y", "C", "Z"}
	if !slices.Equal(got, want) {
		t.Errorf("got %v, want %v", got, want)
	}
}

func TestInterleaveFirstLonger(t *testing.T) {
	got := interleave([]string{"A", "B", "C", "D"}, []string{"X", "Y"})
	want := []string{"A", "X", "B", "Y", "C", "D"}
	if !slices.Equal(got, want) {
		t.Errorf("got %v, want %v", got, want)
	}
}

func TestInterleaveSecondLonger(t *testing.T) {
	got := interleave([]string{"A"}, []string{"X", "Y", "Z"})
	want := []string{"A", "X", "Y", "Z"}
	if !slices.Equal(got, want) {
		t.Errorf("got %v, want %v", got, want)
	}
}

func TestInterleaveFirstEmpty(t *testing.T) {
	got := interleave([]string{}, []string{"X", "Y"})
	want := []string{"X", "Y"}
	if !slices.Equal(got, want) {
		t.Errorf("got %v, want %v", got, want)
	}
}

func TestInterleaveBothEmpty(t *testing.T) {
	got := interleave([]string{}, []string{})
	if len(got) != 0 {
		t.Errorf("got %v, want empty slice", got)
	}
}

// --- Merge tests ---

func TestMergePDFs(t *testing.T) {
	tmp := t.TempDir()
	fileA := filepath.Join(tmp, "a.pdf")
	fileB := filepath.Join(tmp, "b.pdf")
	out := filepath.Join(tmp, "merged.pdf")

	pdftest.WritePDF(t, fileA, []string{"A1", "A2", "A3"})
	pdftest.WritePDF(t, fileB, []string{"B1", "B2", "B3"})

	if err := MergePDFs(fileA, fileB, out, true, false, nil, nil, nil, nil); err != nil {
		t.Fatal(err)
	}

	if count, err := PageCount(out); err != nil {
		t.Fatal(err)
	} else if count != 6 {
		t.Errorf("got %d pages, want 6", count)
	}

	data, err := os.ReadFile(out)
	if err != nil {
		t.Fatal(err)
	}
	pdftest.AssertOrder(t, data, []string{"A1", "B1", "A2", "B2", "A3", "B3"})
}

func TestMergePDFsFirstPageInB(t *testing.T) {
	tmp := t.TempDir()
	fileA := filepath.Join(tmp, "a.pdf")
	fileB := filepath.Join(tmp, "b.pdf")
	out := filepath.Join(tmp, "merged.pdf")

	pdftest.WritePDF(t, fileA, []string{"A1", "A2", "A3"})
	pdftest.WritePDF(t, fileB, []string{"B1", "B2", "B3"})

	if err := MergePDFs(fileA, fileB, out, false, false, nil, nil, nil, nil); err != nil {
		t.Fatal(err)
	}

	data, err := os.ReadFile(out)
	if err != nil {
		t.Fatal(err)
	}
	pdftest.AssertOrder(t, data, []string{"B1", "A1", "B2", "A2", "B3", "A3"})
}

func TestMergePDFsReverseB(t *testing.T) {
	tmp := t.TempDir()
	fileA := filepath.Join(tmp, "a.pdf")
	fileB := filepath.Join(tmp, "b.pdf")
	out := filepath.Join(tmp, "merged.pdf")

	pdftest.WritePDF(t, fileA, []string{"A1", "A2", "A3"})
	pdftest.WritePDF(t, fileB, []string{"B1", "B2", "B3"})

	if err := MergePDFs(fileA, fileB, out, true, true, nil, nil, nil, nil); err != nil {
		t.Fatal(err)
	}

	if count, err := PageCount(out); err != nil {
		t.Fatal(err)
	} else if count != 6 {
		t.Errorf("got %d pages, want 6", count)
	}

	// reverseB reverses file B: B3, B2, B1 → output: A1,B3, A2,B2, A3,B1
	data, err := os.ReadFile(out)
	if err != nil {
		t.Fatal(err)
	}
	pdftest.AssertOrder(t, data, []string{"A1", "B3", "A2", "B2", "A3", "B1"})
}

func TestMergePDFsUnequalCounts(t *testing.T) {
	tmp := t.TempDir()
	fileA := filepath.Join(tmp, "a.pdf")
	fileB := filepath.Join(tmp, "b.pdf")
	out := filepath.Join(tmp, "merged.pdf")

	pdftest.WritePDF(t, fileA, []string{"A1", "A2", "A3", "A4"})
	pdftest.WritePDF(t, fileB, []string{"B1", "B2", "B3"})

	if err := MergePDFs(fileA, fileB, out, true, false, nil, nil, nil, nil); err != nil {
		t.Fatal(err)
	}

	// 3 interleaved pairs + 1 extra A page = 7
	if count, err := PageCount(out); err != nil {
		t.Fatal(err)
	} else if count != 7 {
		t.Errorf("got %d pages, want 7", count)
	}

	data, err := os.ReadFile(out)
	if err != nil {
		t.Fatal(err)
	}
	pdftest.AssertOrder(t, data, []string{"A1", "B1", "A2", "B2", "A3", "B3", "A4"})
}

func TestMergePDFsSkip(t *testing.T) {
	tmp := t.TempDir()
	fileA := filepath.Join(tmp, "a.pdf")
	fileB := filepath.Join(tmp, "b.pdf")
	out := filepath.Join(tmp, "merged.pdf")

	pdftest.WritePDF(t, fileA, []string{"A1", "A2", "A3"})
	pdftest.WritePDF(t, fileB, []string{"B1", "B2", "B3"})

	// Skip A page 2 and B page 1 → A=[A1,A3], B=[B2,B3] → interleaved: A1,B2, A3,B3
	if err := MergePDFs(fileA, fileB, out, true, false, []int{2}, []int{1}, nil, nil); err != nil {
		t.Fatal(err)
	}

	if count, err := PageCount(out); err != nil {
		t.Fatal(err)
	} else if count != 4 {
		t.Errorf("got %d pages, want 4", count)
	}

	data, err := os.ReadFile(out)
	if err != nil {
		t.Fatal(err)
	}
	pdftest.AssertOrder(t, data, []string{"A1", "B2", "A3", "B3"})
	if bytes.Contains(data, []byte("% A2")) {
		t.Error("skipped page A2 found in output")
	}
	if bytes.Contains(data, []byte("% B1")) {
		t.Error("skipped page B1 found in output")
	}
}

func TestMergePDFsRotate(t *testing.T) {
	tmp := t.TempDir()
	fileA := filepath.Join(tmp, "a.pdf")
	fileB := filepath.Join(tmp, "b.pdf")
	out := filepath.Join(tmp, "merged.pdf")

	pdftest.WritePDF(t, fileA, []string{"A1", "A2", "A3"})
	pdftest.WritePDF(t, fileB, []string{"B1", "B2", "B3"})

	// Rotate A page 2 by 90° and B page 1 by 180°
	rotA := map[int]int{2: 90}
	rotB := map[int]int{1: 180}

	if err := MergePDFs(fileA, fileB, out, true, false, nil, nil, rotA, rotB); err != nil {
		t.Fatal(err)
	}

	if count, err := PageCount(out); err != nil {
		t.Fatal(err)
	} else if count != 6 {
		t.Errorf("got %d pages, want 6", count)
	}

	// Page order is still correct: A1,B1,A2,B2,A3,B3
	data, err := os.ReadFile(out)
	if err != nil {
		t.Fatal(err)
	}
	pdftest.AssertOrder(t, data, []string{"A1", "B1", "A2", "B2", "A3", "B3"})

	// Verify rotation per output page via pdfcpu context API.
	// Interleaved order: page1=A1(0°), page2=B1(180°), page3=A2(90°), page4=B2(0°), page5=A3(0°), page6=B3(0°)
	wantRotations := []int{0, 180, 90, 0, 0, 0}
	for i, want := range wantRotations {
		if got := pdfPageRotation(t, out, i+1); got != want {
			t.Errorf("output page %d: got rotation %d°, want %d°", i+1, got, want)
		}
	}
}

// --- Split tests ---

func TestSplitPDF(t *testing.T) {
	tmp := t.TempDir()
	in := filepath.Join(tmp, "input.pdf")
	outDir := filepath.Join(tmp, "out")
	if err := os.MkdirAll(outDir, 0o755); err != nil {
		t.Fatal(err)
	}

	pdftest.WritePDF(t, in, []string{"P1", "P2", "P3", "P4", "P5", "P6"})

	parts, err := SplitPDF(in, []OutputFileSpec{
		{Pages: []int{1, 2}},
		{Pages: []int{3, 4}},
		{Pages: []int{5, 6}},
	}, nil, outDir)
	if err != nil {
		t.Fatal(err)
	}

	if len(parts) != 3 {
		t.Fatalf("got %d parts, want 3", len(parts))
	}

	for i, want := range []int{2, 2, 2} {
		if got, err := PageCount(parts[i]); err != nil {
			t.Fatalf("part %d: %v", i, err)
		} else if got != want {
			t.Errorf("part %d: got %d pages, want %d", i, got, want)
		}
	}

	for i, labels := range [][]string{{"P1", "P2"}, {"P3", "P4"}, {"P5", "P6"}} {
		data, err := os.ReadFile(parts[i])
		if err != nil {
			t.Fatal(err)
		}
		pdftest.AssertOrder(t, data, labels)
	}
}

func TestSplitPDFSingleOutput(t *testing.T) {
	tmp := t.TempDir()
	in := filepath.Join(tmp, "input.pdf")
	outDir := filepath.Join(tmp, "out")
	if err := os.MkdirAll(outDir, 0o755); err != nil {
		t.Fatal(err)
	}

	pdftest.WritePDF(t, in, []string{"P1", "P2", "P3", "P4"})

	parts, err := SplitPDF(in, []OutputFileSpec{
		{Pages: []int{1, 2, 3, 4}},
	}, nil, outDir)
	if err != nil {
		t.Fatal(err)
	}

	if len(parts) != 1 {
		t.Fatalf("got %d parts, want 1", len(parts))
	}

	if got, err := PageCount(parts[0]); err != nil {
		t.Fatal(err)
	} else if got != 4 {
		t.Errorf("got %d pages, want 4", got)
	}
}

func TestSplitPDFSkip(t *testing.T) {
	tmp := t.TempDir()
	in := filepath.Join(tmp, "input.pdf")
	outDir := filepath.Join(tmp, "out")
	if err := os.MkdirAll(outDir, 0o755); err != nil {
		t.Fatal(err)
	}

	pdftest.WritePDF(t, in, []string{"P1", "P2", "P3", "P4", "P5", "P6"})

	// Page 3 already filtered by caller; segment 2 gets only page 4.
	parts, err := SplitPDF(in, []OutputFileSpec{
		{Pages: []int{1, 2}},
		{Pages: []int{4}},
		{Pages: []int{5, 6}},
	}, nil, outDir)
	if err != nil {
		t.Fatal(err)
	}

	if len(parts) != 3 {
		t.Fatalf("got %d parts, want 3", len(parts))
	}

	wantCounts := []int{2, 1, 2}
	for i, want := range wantCounts {
		if got, err := PageCount(parts[i]); err != nil {
			t.Fatalf("part %d: %v", i, err)
		} else if got != want {
			t.Errorf("part %d: got %d pages, want %d", i, got, want)
		}
	}

	data1, err := os.ReadFile(parts[1])
	if err != nil {
		t.Fatal(err)
	}
	if bytes.Contains(data1, []byte("% P3")) {
		t.Error("skipped page P3 found in segment 2")
	}
	pdftest.AssertOrder(t, data1, []string{"P4"})
}

func TestSplitPDFReorder(t *testing.T) {
	tmp := t.TempDir()
	in := filepath.Join(tmp, "input.pdf")
	outDir := filepath.Join(tmp, "out")
	if err := os.MkdirAll(outDir, 0o755); err != nil {
		t.Fatal(err)
	}

	pdftest.WritePDF(t, in, []string{"P1", "P2", "P3", "P4"})

	// Reverse order within one segment, and swap pages across segments.
	parts, err := SplitPDF(in, []OutputFileSpec{
		{Pages: []int{3, 1}},
		{Pages: []int{4, 2}},
	}, nil, outDir)
	if err != nil {
		t.Fatal(err)
	}

	if len(parts) != 2 {
		t.Fatalf("got %d parts, want 2", len(parts))
	}

	data0, err := os.ReadFile(parts[0])
	if err != nil {
		t.Fatal(err)
	}
	data1, err := os.ReadFile(parts[1])
	if err != nil {
		t.Fatal(err)
	}
	pdftest.AssertOrder(t, data0, []string{"P3", "P1"})
	pdftest.AssertOrder(t, data1, []string{"P4", "P2"})
}
