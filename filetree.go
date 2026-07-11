package main

import (
	"os"
	"path/filepath"
	"strings"

	"paper-scan-processor/backend/pdf"
)

// LocalFile describes one local file discovered by scanLocalRoot. Not every
// file is a PDF — non-PDF files (e.g. image scans) are included too, with
// IsPDF false and PageCount 0.
type LocalFile struct {
	Path      string `json:"path"`
	Name      string `json:"name"` // filename including extension
	SizeBytes int64  `json:"sizeBytes"`
	IsPDF     bool   `json:"isPdf"`
	PageCount int    `json:"pageCount"` // only meaningful when IsPDF is true
	Corrupt   bool   `json:"corrupt"`   // IsPDF true but its page count could not be read
}

// LocalFileGroup is one folder's worth of files, plus its nested
// subfolders. Name is "" only for the root LocalFileGroup returned by
// scanLocalRoot; every subgroup has a real folder name.
type LocalFileGroup struct {
	Name      string           `json:"name"`
	Files     []LocalFile      `json:"files"`
	Subgroups []LocalFileGroup `json:"subgroups"`
}

// scanLocalRoot scans root recursively and returns it as a LocalFileGroup:
// its own direct files in Files, and every subdirectory (at any depth) as a
// nested Subgroups entry. Unlike a subfolder, the root is always returned
// even if it's entirely empty, so the UI has something to render a "no
// files" state from.
func scanLocalRoot(root string) (LocalFileGroup, error) {
	return scanDirectory(root, "")
}

// scanDirectory scans dir's direct entries in a single pass: each file
// becomes a LocalFile, each non-hidden subdirectory is scanned recursively
// (skipping symlinks) and — if its subtree contains no files at all — is
// omitted from Subgroups. name is used as the returned group's Name (pass ""
// for the scan root). PDFs whose page count can't be read are still
// included, flagged via LocalFile.Corrupt, rather than dropped from the
// scan; non-PDF files are never considered corrupt.
//
// Both slice fields are always initialized to non-nil (even when empty),
// since a nil Go slice marshals to JSON `null` rather than `[]`, which
// crashes the frontend (e.g. `group.subgroups.length` throws on null).
func scanDirectory(dir, name string) (LocalFileGroup, error) {
	entries, err := os.ReadDir(dir)
	if err != nil {
		return LocalFileGroup{}, err
	}

	files := []LocalFile{}
	subgroups := []LocalFileGroup{}

	for _, e := range entries {
		entryName := e.Name()
		if strings.HasPrefix(entryName, ".") {
			continue
		}

		if e.IsDir() {
			// os.DirEntry.IsDir() reflects the directory entry itself rather
			// than a resolved symlink target, so a symlinked directory
			// (including one that would otherwise form a loop) never enters
			// this branch — it's simply skipped.
			sub, err := scanDirectory(filepath.Join(dir, entryName), entryName)
			if err != nil {
				return LocalFileGroup{}, err
			}
			if len(sub.Files) > 0 || len(sub.Subgroups) > 0 {
				subgroups = append(subgroups, sub)
			}
			continue
		}

		path := filepath.Join(dir, entryName)
		info, err := os.Stat(path)
		if err != nil {
			continue
		}

		isPDF := strings.HasSuffix(strings.ToLower(entryName), ".pdf")
		var count int
		var corrupt bool
		if isPDF {
			count, err = pdf.PageCount(path)
			corrupt = err != nil
		}
		files = append(files, LocalFile{
			Path:      path,
			Name:      entryName,
			SizeBytes: info.Size(),
			IsPDF:     isPDF,
			PageCount: count,
			Corrupt:   corrupt,
		})
	}

	return LocalFileGroup{Name: name, Files: files, Subgroups: subgroups}, nil
}
