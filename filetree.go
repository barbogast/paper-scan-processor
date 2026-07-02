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

// LocalFileGroup is one subfolder's worth of files. Name is "" for files
// found directly in the scanned root.
type LocalFileGroup struct {
	Name  string      `json:"name"`
	Files []LocalFile `json:"files"`
}

// scanLocalRoot scans root one level deep: PDFs directly in root form a
// single group with Name "", and each immediate subdirectory of root forms
// its own group containing only its direct PDF children. Files whose page
// count can't be read (corrupt or non-PDF despite the extension) are still
// included, flagged via LocalFile.Corrupt, rather than dropped from the scan.
func scanLocalRoot(root string) ([]LocalFileGroup, error) {
	entries, err := os.ReadDir(root)
	if err != nil {
		return nil, err
	}

	var groups []LocalFileGroup

	rootFiles, err := scanDir(root, entries)
	if err != nil {
		return nil, err
	}
	if len(rootFiles) > 0 {
		groups = append(groups, LocalFileGroup{Name: "", Files: rootFiles})
	}

	for _, e := range entries {
		if !e.IsDir() || strings.HasPrefix(e.Name(), ".") {
			continue
		}
		name := e.Name()
		dir := filepath.Join(root, name)
		subEntries, err := os.ReadDir(dir)
		if err != nil {
			return nil, err
		}
		files, err := scanDir(dir, subEntries)
		if err != nil {
			return nil, err
		}
		if len(files) > 0 {
			groups = append(groups, LocalFileGroup{Name: name, Files: files})
		}
	}

	return groups, nil
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
