package main

import (
	"encoding/json"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func TestScanLocalRootFilesInRootAndSubfolder(t *testing.T) {
	root := t.TempDir()
	writePDF(t, filepath.Join(root, "misc.pdf"), []string{"p1", "p2"})
	if err := os.Mkdir(filepath.Join(root, "invoices"), 0o755); err != nil {
		t.Fatal(err)
	}
	writePDF(t, filepath.Join(root, "invoices", "b.pdf"), []string{"p1"})
	writePDF(t, filepath.Join(root, "invoices", "a.pdf"), []string{"p1", "p2", "p3"})

	groups, err := scanLocalRoot(root)
	if err != nil {
		t.Fatal(err)
	}
	if len(groups) != 2 {
		t.Fatalf("got %d groups, want 2: %+v", len(groups), groups)
	}

	rootGroup := groups[0]
	if rootGroup.Name != "" {
		t.Errorf("root group name = %q, want \"\"", rootGroup.Name)
	}
	if len(rootGroup.Files) != 1 || rootGroup.Files[0].Name != "misc" || rootGroup.Files[0].PageCount != 2 {
		t.Errorf("root group files = %+v", rootGroup.Files)
	}
	if rootGroup.Files[0].SizeBytes <= 0 {
		t.Errorf("root file size = %d, want > 0", rootGroup.Files[0].SizeBytes)
	}

	sub := groups[1]
	if sub.Name != "invoices" {
		t.Errorf("subgroup name = %q, want invoices", sub.Name)
	}
	if len(sub.Files) != 2 {
		t.Fatalf("got %d files in invoices, want 2: %+v", len(sub.Files), sub.Files)
	}
	// alphabetical by filename
	if sub.Files[0].Name != "a" || sub.Files[1].Name != "b" {
		t.Errorf("invoices files not sorted: %+v", sub.Files)
	}
	if sub.Files[0].PageCount != 3 || sub.Files[1].PageCount != 1 {
		t.Errorf("unexpected page counts: %+v", sub.Files)
	}
}

func TestScanLocalRootEmptySubfolderOmitted(t *testing.T) {
	root := t.TempDir()
	if err := os.Mkdir(filepath.Join(root, "empty"), 0o755); err != nil {
		t.Fatal(err)
	}
	writePDF(t, filepath.Join(root, "top.pdf"), []string{"p1"})

	groups, err := scanLocalRoot(root)
	if err != nil {
		t.Fatal(err)
	}
	if len(groups) != 1 {
		t.Fatalf("got %d groups, want 1 (empty subfolder should be omitted): %+v", len(groups), groups)
	}
	if groups[0].Name != "" {
		t.Errorf("group name = %q, want \"\"", groups[0].Name)
	}
}

func TestScanLocalRootFlagsCorruptPDF(t *testing.T) {
	root := t.TempDir()
	writePDF(t, filepath.Join(root, "good.pdf"), []string{"p1"})
	if err := os.WriteFile(filepath.Join(root, "bad.pdf"), []byte("not a pdf"), 0o644); err != nil {
		t.Fatal(err)
	}

	groups, err := scanLocalRoot(root)
	if err != nil {
		t.Fatal(err)
	}
	if len(groups) != 1 || len(groups[0].Files) != 2 {
		t.Fatalf("expected both files to appear in the scan, got %+v", groups)
	}

	files := groups[0].Files
	if files[0].Name != "bad" || !files[0].Corrupt || files[0].PageCount != 0 {
		t.Errorf("bad.pdf = %+v, want Corrupt=true, PageCount=0", files[0])
	}
	if files[0].SizeBytes <= 0 {
		t.Errorf("bad.pdf size = %d, want > 0", files[0].SizeBytes)
	}
	if files[1].Name != "good" || files[1].Corrupt || files[1].PageCount != 1 {
		t.Errorf("good.pdf = %+v, want Corrupt=false, PageCount=1", files[1])
	}
}

func TestScanLocalRootIgnoresNonPDFAndDotfiles(t *testing.T) {
	root := t.TempDir()
	writePDF(t, filepath.Join(root, "doc.pdf"), []string{"p1"})
	if err := os.WriteFile(filepath.Join(root, "readme.txt"), []byte("hi"), 0o644); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(root, ".DS_Store"), []byte("hi"), 0o644); err != nil {
		t.Fatal(err)
	}
	if err := os.Mkdir(filepath.Join(root, ".hidden"), 0o755); err != nil {
		t.Fatal(err)
	}
	writePDF(t, filepath.Join(root, ".hidden", "sneaky.pdf"), []string{"p1"})

	groups, err := scanLocalRoot(root)
	if err != nil {
		t.Fatal(err)
	}
	if len(groups) != 1 || len(groups[0].Files) != 1 || groups[0].Files[0].Name != "doc" {
		t.Fatalf("expected only doc.pdf, got %+v", groups)
	}
}

func TestScanLocalRootRecursesMultipleLevels(t *testing.T) {
	root := t.TempDir()
	nested := filepath.Join(root, "a", "b")
	if err := os.MkdirAll(nested, 0o755); err != nil {
		t.Fatal(err)
	}
	writePDF(t, filepath.Join(nested, "deep.pdf"), []string{"p1"})
	writePDF(t, filepath.Join(root, "a", "shallow.pdf"), []string{"p1"})

	groups, err := scanLocalRoot(root)
	if err != nil {
		t.Fatal(err)
	}
	if len(groups) != 1 || groups[0].Name != "a" {
		t.Fatalf("expected a single top-level group \"a\", got %+v", groups)
	}

	a := groups[0]
	if len(a.Files) != 1 || a.Files[0].Name != "shallow" {
		t.Errorf("a's direct files = %+v, want just shallow.pdf", a.Files)
	}
	if len(a.Subgroups) != 1 || a.Subgroups[0].Name != "b" {
		t.Fatalf("a's subgroups = %+v, want a single subgroup \"b\"", a.Subgroups)
	}

	b := a.Subgroups[0]
	if len(b.Files) != 1 || b.Files[0].Name != "deep" {
		t.Errorf("b's files = %+v, want just deep.pdf", b.Files)
	}
	if len(b.Subgroups) != 0 {
		t.Errorf("b's subgroups = %+v, want none", b.Subgroups)
	}
}

func TestScanLocalRootOmitsSubtreeWithNoPDFsAtAnyDepth(t *testing.T) {
	root := t.TempDir()
	emptyNested := filepath.Join(root, "empty", "also-empty")
	if err := os.MkdirAll(emptyNested, 0o755); err != nil {
		t.Fatal(err)
	}
	writePDF(t, filepath.Join(root, "top.pdf"), []string{"p1"})

	groups, err := scanLocalRoot(root)
	if err != nil {
		t.Fatal(err)
	}
	if len(groups) != 1 || groups[0].Name != "" {
		t.Fatalf("expected only the root group (empty subtree omitted), got %+v", groups)
	}
}

func TestScanLocalRootDoesNotFollowSymlinkedDirectories(t *testing.T) {
	root := t.TempDir()
	real := filepath.Join(root, "real")
	if err := os.Mkdir(real, 0o755); err != nil {
		t.Fatal(err)
	}
	writePDF(t, filepath.Join(real, "doc.pdf"), []string{"p1"})

	// A symlink back to an ancestor would form an infinite loop if followed.
	if err := os.Symlink(root, filepath.Join(real, "loop")); err != nil {
		t.Fatal(err)
	}

	groups, err := scanLocalRoot(root)
	if err != nil {
		t.Fatal(err)
	}
	if len(groups) != 1 || groups[0].Name != "real" || len(groups[0].Subgroups) != 0 {
		t.Fatalf("expected only the real directory with no subgroups (symlink not followed), got %+v", groups)
	}
}

func TestScanLocalRootSubfoldersSortedAlphabetically(t *testing.T) {
	root := t.TempDir()
	for _, name := range []string{"zeta", "alpha", "mid"} {
		dir := filepath.Join(root, name)
		if err := os.Mkdir(dir, 0o755); err != nil {
			t.Fatal(err)
		}
		writePDF(t, filepath.Join(dir, "f.pdf"), []string{"p1"})
	}

	groups, err := scanLocalRoot(root)
	if err != nil {
		t.Fatal(err)
	}
	if len(groups) != 3 {
		t.Fatalf("got %d groups, want 3: %+v", len(groups), groups)
	}
	got := []string{groups[0].Name, groups[1].Name, groups[2].Name}
	want := []string{"alpha", "mid", "zeta"}
	for i := range want {
		if got[i] != want[i] {
			t.Errorf("group order = %v, want %v", got, want)
			break
		}
	}
}

// TestScanLocalRootJSONNeverUsesNullForSlices guards against Go's nil-slice
// marshaling to JSON `null` instead of `[]`, which crashes the frontend
// (e.g. `group.subgroups.length` throws on null). A leaf group (no
// subfolders) is exactly the case that previously produced a nil Subgroups
// slice.
func TestScanLocalRootJSONNeverUsesNullForSlices(t *testing.T) {
	root := t.TempDir()
	writePDF(t, filepath.Join(root, "leaf.pdf"), []string{"p1"})
	if err := os.Mkdir(filepath.Join(root, "childless"), 0o755); err != nil {
		t.Fatal(err)
	}
	writePDF(t, filepath.Join(root, "childless", "doc.pdf"), []string{"p1"})

	groups, err := scanLocalRoot(root)
	if err != nil {
		t.Fatal(err)
	}

	data, err := json.Marshal(groups)
	if err != nil {
		t.Fatal(err)
	}
	if strings.Contains(string(data), "null") {
		t.Errorf("JSON output contains null (should be [] for empty slices): %s", data)
	}
}
