package main

import (
	"context"
	"os"
	"path/filepath"
	"testing"

	"paper-scan-processor/backend/pdf"
)

func TestRecoverToErrConvertsPanicToError(t *testing.T) {
	err := func() (err error) {
		defer recoverToErr(&err)
		panic("boom")
	}()
	if err == nil {
		t.Fatal("expected an error, got nil")
	}
}

func TestCancelUploadCancelsTheRegisteredContext(t *testing.T) {
	a := NewApp()
	ctx, cancel := context.WithCancel(context.Background())
	a.uploadCancels["/tmp/foo.pdf"] = cancel

	a.CancelUpload("/tmp/foo.pdf")

	select {
	case <-ctx.Done():
	default:
		t.Fatal("expected the registered context to be cancelled")
	}
}

func TestCancelUploadIsNoopForUnknownPath(t *testing.T) {
	a := NewApp()
	a.CancelUpload("/tmp/never-uploaded.pdf") // must not panic
}

func TestExportSplitSingleFile(t *testing.T) {
	tmp := t.TempDir()
	in := filepath.Join(tmp, "input.pdf")
	outDir := filepath.Join(tmp, "out")
	if err := os.MkdirAll(outDir, 0o755); err != nil {
		t.Fatal(err)
	}

	pdf.WritePDF(t, in, []string{"P1", "P2", "P3"})

	app := &App{}
	if err := app.ExportSplit(in, []pdf.OutputFileSpec{
		{Pages: []int{1, 2, 3}, Name: "invoice", OutDir: outDir},
	}, nil); err != nil {
		t.Fatal(err)
	}

	out := filepath.Join(outDir, "invoice.pdf")
	if _, err := os.Stat(out); err != nil {
		t.Fatalf("expected output file %s: %v", out, err)
	}
	if got, err := pdf.PageCount(out); err != nil {
		t.Fatal(err)
	} else if got != 3 {
		t.Errorf("got %d pages, want 3", got)
	}
	data, err := os.ReadFile(out)
	if err != nil {
		t.Fatal(err)
	}
	pdf.AssertOrder(t, data, []string{"P1", "P2", "P3"})
}

func TestExportSplitMultipleFiles(t *testing.T) {
	tmp := t.TempDir()
	in := filepath.Join(tmp, "input.pdf")
	dirA := filepath.Join(tmp, "dirA")
	dirB := filepath.Join(tmp, "dirB")
	for _, d := range []string{dirA, dirB} {
		if err := os.MkdirAll(d, 0o755); err != nil {
			t.Fatal(err)
		}
	}

	pdf.WritePDF(t, in, []string{"P1", "P2", "P3", "P4"})

	app := &App{}
	if err := app.ExportSplit(in, []pdf.OutputFileSpec{
		{Pages: []int{1, 2}, Name: "first", OutDir: dirA},
		{Pages: []int{3, 4}, Name: "second", OutDir: dirB},
	}, nil); err != nil {
		t.Fatal(err)
	}

	outA := filepath.Join(dirA, "first.pdf")
	outB := filepath.Join(dirB, "second.pdf")

	if got, err := pdf.PageCount(outA); err != nil {
		t.Fatal(err)
	} else if got != 2 {
		t.Errorf("first.pdf: got %d pages, want 2", got)
	}
	if got, err := pdf.PageCount(outB); err != nil {
		t.Fatal(err)
	} else if got != 2 {
		t.Errorf("second.pdf: got %d pages, want 2", got)
	}

	dataA, _ := os.ReadFile(outA)
	dataB, _ := os.ReadFile(outB)
	pdf.AssertOrder(t, dataA, []string{"P1", "P2"})
	pdf.AssertOrder(t, dataB, []string{"P3", "P4"})
}

func TestExportSplitEmptyNameFallback(t *testing.T) {
	tmp := t.TempDir()
	in := filepath.Join(tmp, "input.pdf")
	outDir := filepath.Join(tmp, "out")
	if err := os.MkdirAll(outDir, 0o755); err != nil {
		t.Fatal(err)
	}

	pdf.WritePDF(t, in, []string{"P1", "P2"})

	app := &App{}
	if err := app.ExportSplit(in, []pdf.OutputFileSpec{
		{Pages: []int{1}, Name: "", OutDir: outDir},
		{Pages: []int{2}, Name: "", OutDir: outDir},
	}, nil); err != nil {
		t.Fatal(err)
	}

	for _, name := range []string{"output-1.pdf", "output-2.pdf"} {
		if _, err := os.Stat(filepath.Join(outDir, name)); err != nil {
			t.Errorf("expected %s: %v", name, err)
		}
	}
}
