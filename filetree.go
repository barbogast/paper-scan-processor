package main

import (
	"os"
	"path/filepath"
	"strings"
)

// LocalFile describes one local PDF discovered by scanLocalRoot.
type LocalFile struct {
	Path      string `json:"path"`
	Name      string `json:"name"` // filename without extension; display-only for now
	SizeBytes int64  `json:"sizeBytes"`
	PageCount int    `json:"pageCount"`
	Corrupt   bool   `json:"corrupt"` // true if the file's page count could not be read
}

// LocalFileGroup is one folder's worth of files, plus its nested
// subfolders. Name is "" for files found directly in the scanned root.
type LocalFileGroup struct {
	Name      string           `json:"name"`
	Files     []LocalFile      `json:"files"`
	Subgroups []LocalFileGroup `json:"subgroups"`
}

// newLocalFileGroup builds a LocalFileGroup, normalizing nil slices to
// empty ones. A nil Go slice marshals to JSON `null`, which crashes the
// frontend (e.g. `group.subgroups.length` throws on null), so every
// LocalFileGroup must go through here rather than a bare struct literal.
func newLocalFileGroup(name string, files []LocalFile, subgroups []LocalFileGroup) LocalFileGroup {
	if files == nil {
		files = []LocalFile{}
	}
	if subgroups == nil {
		subgroups = []LocalFileGroup{}
	}
	return LocalFileGroup{Name: name, Files: files, Subgroups: subgroups}
}

// scanLocalRoot scans root recursively: PDFs directly in root form a single
// group with Name "", and every subdirectory (at any depth) forms its own
// nested group containing its direct PDF children plus its own subgroups.
// Folders with no PDFs anywhere in their subtree are omitted entirely.
// Symlinked directories are not followed — os.DirEntry.IsDir() reflects the
// directory entry itself rather than the resolved target, so a symlink
// (including one that would otherwise form a loop) is simply skipped.
// Files whose page count can't be read (corrupt or non-PDF despite the
// extension) are still included, flagged via LocalFile.Corrupt, rather than
// dropped from the scan.
func scanLocalRoot(root string) ([]LocalFileGroup, error) {
	entries, err := os.ReadDir(root)
	if err != nil {
		return nil, err
	}

	groups := []LocalFileGroup{}

	rootFiles, err := scanDir(root, entries)
	if err != nil {
		return nil, err
	}
	if len(rootFiles) > 0 {
		groups = append(groups, newLocalFileGroup("", rootFiles, nil))
	}

	for _, e := range entries {
		if !e.IsDir() || strings.HasPrefix(e.Name(), ".") {
			continue
		}
		group, err := scanSubfolder(root, e.Name())
		if err != nil {
			return nil, err
		}
		if group != nil {
			groups = append(groups, *group)
		}
	}

	return groups, nil
}

// scanSubfolder recursively scans the subdirectory name within parent. It
// returns nil if the subtree rooted there contains no PDFs at all, so empty
// (sub)folders are omitted from the result.
func scanSubfolder(parent, name string) (*LocalFileGroup, error) {
	dir := filepath.Join(parent, name)
	entries, err := os.ReadDir(dir)
	if err != nil {
		return nil, err
	}

	files, err := scanDir(dir, entries)
	if err != nil {
		return nil, err
	}

	subgroups := []LocalFileGroup{}
	for _, e := range entries {
		if !e.IsDir() || strings.HasPrefix(e.Name(), ".") {
			continue
		}
		sub, err := scanSubfolder(dir, e.Name())
		if err != nil {
			return nil, err
		}
		if sub != nil {
			subgroups = append(subgroups, *sub)
		}
	}

	if len(files) == 0 && len(subgroups) == 0 {
		return nil, nil
	}
	group := newLocalFileGroup(name, files, subgroups)
	return &group, nil
}

// scanDir builds the LocalFile list for the PDFs directly within dir's
// entries, sorted alphabetically by filename.
func scanDir(dir string, entries []os.DirEntry) ([]LocalFile, error) {
	files := make([]LocalFile, 0, len(entries))
	for _, e := range entries {
		name := e.Name()
		if e.IsDir() || strings.HasPrefix(name, ".") || !strings.HasSuffix(strings.ToLower(name), ".pdf") {
			continue
		}
		path := filepath.Join(dir, name)
		info, err := os.Stat(path)
		if err != nil {
			continue
		}
		count, err := pdfPageCount(path)
		files = append(files, LocalFile{
			Path:      path,
			Name:      strings.TrimSuffix(name, filepath.Ext(name)),
			SizeBytes: info.Size(),
			PageCount: count,
			Corrupt:   err != nil, // corrupt or non-PDF despite the extension
		})
	}
	return files, nil
}
