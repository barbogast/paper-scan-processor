package main

import (
	"bytes"
	"fmt"
	"os"
	"path/filepath"
	"slices"
	"strings"
	"testing"

	"github.com/pdfcpu/pdfcpu/pkg/api"
)

// minimalPDF returns the bytes of a valid minimal PDF where each page has an
// uncompressed content stream containing a comment with the given label.
// Labels appear literally in the raw bytes and survive pdfcpu merge/split.
func minimalPDF(labels []string) []byte {
	pageCount := len(labels)
	var buf bytes.Buffer
	// Objects: 1=Catalog, 2=Pages, then per page: (page obj, content obj)
	numObjs := 2 + 2*pageCount
	offsets := make([]int, numObjs)

	w := func(s string) { buf.WriteString(s) }
	wf := func(format string, args ...any) { fmt.Fprintf(&buf, format, args...) }
	startObj := func(n int) {
		offsets[n-1] = buf.Len()
		wf("%d 0 obj\n", n)
	}
	endObj := func() { w("endobj\n") }

	w("%PDF-1.4\n")

	startObj(1)
	w("<< /Type /Catalog /Pages 2 0 R >>\n")
	endObj()

	// Page objects are at 3, 5, 7, ... (odd); content streams at 4, 6, 8, ... (even)
	var kids strings.Builder
	for i := range pageCount {
		if i > 0 {
			kids.WriteByte(' ')
		}
		fmt.Fprintf(&kids, "%d 0 R", 3+i*2)
	}
	startObj(2)
	wf("<< /Type /Pages /Kids [%s] /Count %d >>\n", kids.String(), pageCount)
	endObj()

	for i, label := range labels {
		pageObjN := 3 + i*2
		contObjN := 4 + i*2
		stream := fmt.Sprintf("%% %s\n", label) // PDF comment; appears literally in raw bytes

		startObj(pageObjN)
		wf("<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents %d 0 R >>\n", contObjN)
		endObj()

		startObj(contObjN)
		wf("<< /Length %d >>\n", len(stream))
		w("stream\n")
		w(stream)
		w("endstream\n")
		endObj()
	}

	xrefOff := buf.Len()
	xrefCount := numObjs + 1 // +1 for free object 0
	wf("xref\n0 %d\n", xrefCount)
	wf("0000000000 65535 f\r\n")
	for _, off := range offsets {
		wf("%010d 00000 n\r\n", off)
	}
	wf("trailer\n<< /Size %d /Root 1 0 R >>\n", xrefCount)
	wf("startxref\n%d\n", xrefOff)
	w("%%EOF\n")

	return buf.Bytes()
}

func writePDF(t *testing.T, path string, labels []string) {
	t.Helper()
	if err := os.WriteFile(path, minimalPDF(labels), 0o644); err != nil {
		t.Fatal(err)
	}
}

// labelPositions returns the byte offset of each label in data, or -1 if absent.
func labelPositions(data []byte, labels []string) []int {
	pos := make([]int, len(labels))
	for i, l := range labels {
		pos[i] = bytes.Index(data, []byte(l))
	}
	return pos
}

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

// assertOrder checks that the given labels appear in data in the given order.
func assertOrder(t *testing.T, data []byte, ordered []string) {
	t.Helper()
	pos := labelPositions(data, ordered)
	for i, p := range pos {
		if p == -1 {
			t.Errorf("label %q not found in output", ordered[i])
		}
	}
	for i := 1; i < len(pos); i++ {
		if pos[i-1] >= pos[i] {
			t.Errorf("label %q (pos %d) should appear before %q (pos %d)",
				ordered[i-1], pos[i-1], ordered[i], pos[i])
		}
	}
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

	writePDF(t, fileA, []string{"A1", "A2", "A3"})
	writePDF(t, fileB, []string{"B1", "B2", "B3"})

	if err := mergePDFs(fileA, fileB, out, true, false, nil, nil, nil, nil); err != nil {
		t.Fatal(err)
	}

	if count, err := pdfPageCount(out); err != nil {
		t.Fatal(err)
	} else if count != 6 {
		t.Errorf("got %d pages, want 6", count)
	}

	data, err := os.ReadFile(out)
	if err != nil {
		t.Fatal(err)
	}
	assertOrder(t, data, []string{"A1", "B1", "A2", "B2", "A3", "B3"})
}

func TestMergePDFsFirstPageInB(t *testing.T) {
	tmp := t.TempDir()
	fileA := filepath.Join(tmp, "a.pdf")
	fileB := filepath.Join(tmp, "b.pdf")
	out := filepath.Join(tmp, "merged.pdf")

	writePDF(t, fileA, []string{"A1", "A2", "A3"})
	writePDF(t, fileB, []string{"B1", "B2", "B3"})

	if err := mergePDFs(fileA, fileB, out, false, false, nil, nil, nil, nil); err != nil {
		t.Fatal(err)
	}

	data, err := os.ReadFile(out)
	if err != nil {
		t.Fatal(err)
	}
	assertOrder(t, data, []string{"B1", "A1", "B2", "A2", "B3", "A3"})
}

func TestMergePDFsReverseB(t *testing.T) {
	tmp := t.TempDir()
	fileA := filepath.Join(tmp, "a.pdf")
	fileB := filepath.Join(tmp, "b.pdf")
	out := filepath.Join(tmp, "merged.pdf")

	writePDF(t, fileA, []string{"A1", "A2", "A3"})
	writePDF(t, fileB, []string{"B1", "B2", "B3"})

	if err := mergePDFs(fileA, fileB, out, true, true, nil, nil, nil, nil); err != nil {
		t.Fatal(err)
	}

	if count, err := pdfPageCount(out); err != nil {
		t.Fatal(err)
	} else if count != 6 {
		t.Errorf("got %d pages, want 6", count)
	}

	// reverseB reverses file B: B3, B2, B1 → output: A1,B3, A2,B2, A3,B1
	data, err := os.ReadFile(out)
	if err != nil {
		t.Fatal(err)
	}
	assertOrder(t, data, []string{"A1", "B3", "A2", "B2", "A3", "B1"})
}

func TestMergePDFsUnequalCounts(t *testing.T) {
	tmp := t.TempDir()
	fileA := filepath.Join(tmp, "a.pdf")
	fileB := filepath.Join(tmp, "b.pdf")
	out := filepath.Join(tmp, "merged.pdf")

	writePDF(t, fileA, []string{"A1", "A2", "A3", "A4"})
	writePDF(t, fileB, []string{"B1", "B2", "B3"})

	if err := mergePDFs(fileA, fileB, out, true, false, nil, nil, nil, nil); err != nil {
		t.Fatal(err)
	}

	// 3 interleaved pairs + 1 extra A page = 7
	if count, err := pdfPageCount(out); err != nil {
		t.Fatal(err)
	} else if count != 7 {
		t.Errorf("got %d pages, want 7", count)
	}

	data, err := os.ReadFile(out)
	if err != nil {
		t.Fatal(err)
	}
	assertOrder(t, data, []string{"A1", "B1", "A2", "B2", "A3", "B3", "A4"})
}

func TestMergePDFsSkip(t *testing.T) {
	tmp := t.TempDir()
	fileA := filepath.Join(tmp, "a.pdf")
	fileB := filepath.Join(tmp, "b.pdf")
	out := filepath.Join(tmp, "merged.pdf")

	writePDF(t, fileA, []string{"A1", "A2", "A3"})
	writePDF(t, fileB, []string{"B1", "B2", "B3"})

	// Skip A page 2 and B page 1 → A=[A1,A3], B=[B2,B3] → interleaved: A1,B2, A3,B3
	if err := mergePDFs(fileA, fileB, out, true, false, []int{2}, []int{1}, nil, nil); err != nil {
		t.Fatal(err)
	}

	if count, err := pdfPageCount(out); err != nil {
		t.Fatal(err)
	} else if count != 4 {
		t.Errorf("got %d pages, want 4", count)
	}

	data, err := os.ReadFile(out)
	if err != nil {
		t.Fatal(err)
	}
	assertOrder(t, data, []string{"A1", "B2", "A3", "B3"})
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

	writePDF(t, fileA, []string{"A1", "A2", "A3"})
	writePDF(t, fileB, []string{"B1", "B2", "B3"})

	// Rotate A page 2 by 90° and B page 1 by 180°
	rotA := map[int]int{2: 90}
	rotB := map[int]int{1: 180}

	if err := mergePDFs(fileA, fileB, out, true, false, nil, nil, rotA, rotB); err != nil {
		t.Fatal(err)
	}

	if count, err := pdfPageCount(out); err != nil {
		t.Fatal(err)
	} else if count != 6 {
		t.Errorf("got %d pages, want 6", count)
	}

	// Page order is still correct: A1,B1,A2,B2,A3,B3
	data, err := os.ReadFile(out)
	if err != nil {
		t.Fatal(err)
	}
	assertOrder(t, data, []string{"A1", "B1", "A2", "B2", "A3", "B3"})

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

	writePDF(t, in, []string{"P1", "P2", "P3", "P4", "P5", "P6"})

	// Split after pages 2 and 4 → three files: 1-2, 3-4, 5-6
	parts, err := splitPDF(in, [][]int{{1, 2}, {3, 4}, {5, 6}}, nil, outDir)
	if err != nil {
		t.Fatal(err)
	}

	if len(parts) != 3 {
		t.Fatalf("got %d parts, want 3", len(parts))
	}

	for i, want := range []int{2, 2, 2} {
		if got, err := pdfPageCount(parts[i]); err != nil {
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
		assertOrder(t, data, labels)
	}
}

func TestSplitPDFSingleOutput(t *testing.T) {
	tmp := t.TempDir()
	in := filepath.Join(tmp, "input.pdf")
	outDir := filepath.Join(tmp, "out")
	if err := os.MkdirAll(outDir, 0o755); err != nil {
		t.Fatal(err)
	}

	writePDF(t, in, []string{"P1", "P2", "P3", "P4"})

	parts, err := splitPDF(in, [][]int{{1, 2, 3, 4}}, nil, outDir)
	if err != nil {
		t.Fatal(err)
	}

	if len(parts) != 1 {
		t.Fatalf("got %d parts, want 1", len(parts))
	}

	if got, err := pdfPageCount(parts[0]); err != nil {
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

	writePDF(t, in, []string{"P1", "P2", "P3", "P4", "P5", "P6"})

	// Split after 2 and 4, skip page 3.
	// Segment 1: pages 1-2 → [P1, P2]
	// Segment 2: pages 3-4 → [P4] (P3 skipped by caller)
	// Segment 3: pages 5-6 → [P5, P6]
	parts, err := splitPDF(in, [][]int{{1, 2}, {4}, {5, 6}}, nil, outDir)
	if err != nil {
		t.Fatal(err)
	}

	if len(parts) != 3 {
		t.Fatalf("got %d parts, want 3", len(parts))
	}

	wantCounts := []int{2, 1, 2}
	for i, want := range wantCounts {
		if got, err := pdfPageCount(parts[i]); err != nil {
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
	assertOrder(t, data1, []string{"P4"})
}

func TestSplitPDFReorder(t *testing.T) {
	tmp := t.TempDir()
	in := filepath.Join(tmp, "input.pdf")
	outDir := filepath.Join(tmp, "out")
	if err := os.MkdirAll(outDir, 0o755); err != nil {
		t.Fatal(err)
	}

	writePDF(t, in, []string{"P1", "P2", "P3", "P4"})

	// Reverse the page order within a single segment.
	parts, err := splitPDF(in, [][]int{{4, 3, 2, 1}}, nil, outDir)
	if err != nil {
		t.Fatal(err)
	}
	if len(parts) != 1 {
		t.Fatalf("got %d parts, want 1", len(parts))
	}
	data, err := os.ReadFile(parts[0])
	if err != nil {
		t.Fatal(err)
	}
	assertOrder(t, data, []string{"P4", "P3", "P2", "P1"})
}
