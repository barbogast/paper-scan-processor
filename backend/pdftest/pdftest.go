// Package pdftest provides shared PDF test fixtures used across the backend
// packages' test files.
package pdftest

import (
	"bytes"
	"fmt"
	"os"
	"strings"
	"testing"
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

// WritePDF writes a minimal PDF with one page per label to path.
func WritePDF(t *testing.T, path string, labels []string) {
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

// AssertOrder checks that the given labels appear in data in the given order.
func AssertOrder(t *testing.T, data []byte, ordered []string) {
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
