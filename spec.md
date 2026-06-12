# Paper Scan Processor

A desktop application (Electron or Tauri) for post-processing PDF files containing batches of scanned documents. The app has two independent modes: **Merge** and **Split**.

## Mode: Merge

For scanners that can only scan one side at a time. The user scans all front pages as one PDF and all back pages as another, then uses Merge mode to interleave them into a single PDF.

### Merge workflow

1. The user loads two PDF files — one containing front pages, one containing back pages.
2. The user selects which file contains the first page (i.e. designates which is "fronts" and which is "backs").
3. A **Reverse back pages** checkbox controls whether the back PDF is reversed before interleaving. This should be checked when the paper stack was flipped between scans (the typical case), causing backs to be in reverse order.
4. The app interleaves the pages: front 1, back 1, front 2, back 2, etc.
5. The user saves the merged result as a new PDF file on disk.

The merged PDF can then be opened in Split mode for further processing.

## Mode: Split

### Split workflow

1. The user loads an input PDF via a file picker dialog or by dragging and dropping a file onto the app window.
2. The app displays all pages of the input PDF as thumbnails in a main panel.
3. The user defines split points by clicking in the gaps between page thumbnails. A visual divider appears at each split point; clicking again removes it. Dividers can also be repositioned by dragging them to a different gap. Each divider marks where a new output file begins.
4. The user sets a global filename template using `{date}` (today's date as `YYYY-MM-DD`) and `{name}` (a per-file label). Example: `{date} {name}` → `2026-06-12 invoice.pdf`. The app prefills the filename for each output file using this template. The user can then edit any individual file's name before exporting.
5. The user sets a global output folder (an existing folder on the local filesystem, or a Google Drive folder if Drive integration is enabled). This folder is used as the destination for all output files. A sidebar panel lists each output file as a row, aligned with its pages. For each output file, the user can adjust:
   - The prefilled filename (editable)
   - The destination folder (overridable per file)
6. The user clicks Export. Before splitting, the app checks for filename conflicts at each destination. If any conflict is found, the export is aborted and an error message identifies the conflicting files. Once resolved, the app splits the input PDF and writes (or uploads) each output file. Afterwards, the app prompts the user to keep, move, or delete the input file.

## Error handling

- Local file write errors are shown inline in the affected output file's sidebar row.

## Page editing

- **Rotation**: individual pages can be rotated in 90° increments (clockwise or counter-clockwise).
- **Skip**: individual pages can be marked as skipped — they are excluded from the export but remain visible in the thumbnail view (greyed out). A page is skipped by clicking a skip icon that appears on the thumbnail on hover, or via keyboard shortcut.
- **Reorder**: pages can be reordered by dragging thumbnails to a new position.

## Keyboard shortcuts

| Key | Action |
|-----|--------|
| `R` | Rotate selected page clockwise 90° |
| `Shift+R` | Rotate selected page counter-clockwise 90° |
| `Space` | Toggle a split point after the selected page |
| `Delete` / `Backspace` | Toggle skip on the selected page |
| `Tab` | Move focus to the next filename input field in the sidebar |

## Google Drive integration (optional)

- Authentication uses Google OAuth via a browser window, triggered the first time Drive is enabled. Credentials are stored locally and reused in future sessions.
- When Drive is enabled, each output file row in the sidebar shows a Drive folder field. Clicking it opens a folder browser modal that displays the user's Drive folder tree. The user navigates the tree and selects a destination folder. The selected path is shown in the row (e.g. `My Drive / Clients / Smith / 2026`).
- The folder tree is fetched lazily — the first time the user opens the folder browser in a session.
- The folder browser shows a **recently used folders** list at the top for quick access. This list persists across sessions.
- The global output folder setting can be set to a Drive folder, which prefills all output file rows. Individual rows can be overridden.
- After export, each output file is uploaded to its designated Drive folder. If an upload fails, the affected row shows an inline error message and a Retry button; other uploads are unaffected.
- When Drive is enabled, the local subfolder name for each output file is derived automatically from the Drive folder path (see Local folder sorting below).

## Local folder sorting

Each output file can be assigned a subfolder name. The file is then saved to `[output folder] / [subfolder] / filename.pdf` rather than directly into the output folder.

When Drive is enabled, the subfolder name is derived automatically from the innermost component of the Drive folder path (e.g. `My Drive / Clients / Smith / 2026` → subfolder `2026`). When Drive is disabled, the user enters the subfolder name manually in the sidebar.

If two or more output files in the same batch share the same subfolder name, the app prefixes the parent folder name to disambiguate. If the parent name is also shared, it walks further up the hierarchy until uniqueness is achieved. Examples:
- `Clients / Smith / 2026` and `Clients / Jones / 2026` → `Smith - 2026` and `Jones - 2026`
- `Clients / Smith / 2026` and `Archive / Smith / 2026` → `Clients - Smith - 2026` and `Archive - Smith - 2026`

(When Drive is disabled and names are entered manually, the user is responsible for avoiding conflicts — no automatic disambiguation applies.)

To ensure disambiguation is fully deterministic, **the output folder must be empty when the input PDF is opened**. The app enforces this and shows an error if the folder is not empty.

## Persisted settings

The following settings are saved across sessions:
- Last-used output folder
- Filename template

## Future / out of scope for v1

- **Insert pages from another PDF**: allow the user to pull pages from a second PDF into the current document before splitting. Planned for v2.
- **Scanning integration**: trigger a scan from within the app using OS or device APIs. Not currently planned but under consideration.
