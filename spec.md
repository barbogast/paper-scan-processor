# Paper Scan Processor

A desktop application for post-processing PDF files containing batches of scanned documents. The app has two modes: **Merge** and **Split**.

## Tech stack

- **Desktop framework**: Wails
- **Backend**: Go
- **Frontend**: TypeScript + React
- **UI components**: Mantine + `@mantine/dropzone`
- **Virtualization**: TanStack Virtual
- **Drag-and-drop**: dnd-kit
- **State**: Zustand
- **PDF manipulation**: pdfcpu
- **PDF rendering** (thumbnails): `mutool` (system install, called as subprocess)

## Common elements

Both modes include a thumbnail panel and a page detail panel, and support the same per-page editing operations.

### Thumbnail panel

A vertically scrolling strip of page thumbnails. Width is user-adjustable via a drag handle; thumbnails scale to fill the panel width. Rendering is on-demand and virtualized — only visible thumbnails (plus a small overscan buffer) are rendered at any given time.

The Go backend exposes a per-page render method returning a base64-encoded PNG; the frontend requests thumbnails as they scroll into view (`mutool draw` subprocess).

#### Keyboard shortcuts

| Key                    | Action                                     |
| ---------------------- | ------------------------------------------ |
| `R`                    | Rotate selected page clockwise 90°         |
| `Shift+R`              | Rotate selected page counter-clockwise 90° |
| `Delete` / `Backspace` | Toggle skip on the selected page           |
| `←` / `→`              | Select previous / next page                |

### Page detail panel

Shows the currently selected page at reading resolution. Selecting a thumbnail updates it.

Supports:

- **Pan**: drag to pan.
- **Zoom**: scroll wheel or trackpad pinch to zoom in/out.
- **Navigate**: `←` / `→` to move to the previous/next page.

Implemented with `react-zoom-pan-pinch`.

### Page editing

Individual pages can be edited in both modes before export or merge:

- **Rotation**: pages can be rotated in 90° increments (clockwise or counter-clockwise).
- **Skip**: pages can be marked as skipped — excluded from the output but remaining visible in the thumbnail view (greyed out). A page is skipped by clicking a skip icon that appears on hover, or via keyboard shortcut.
- **Reorder**: pages can be reordered by dragging thumbnails to a new position.

## Mode: Merge

For scanners that can only scan one side at a time. The user scans all front pages as one PDF and all back pages as another, then uses Merge mode to interleave them into a single PDF.

### Workflow

1. The user loads two PDF files, labelled **File A** and **File B**.
2. The user selects which file contains the first page (**First page in: File A / File B**).
3. A **Reverse File B** checkbox controls whether File B is reversed before interleaving. This should be checked when the paper stack was flipped between scans (the typical case, when scanning one side at a time), causing the second-scanned pages to be in reverse order.
4. The app interleaves the pages: A1, B1, A2, B2, etc.
5. The user saves the merged result as a new PDF file on disk.

The merged PDF can then be opened in Split mode for further processing.

### Unequal page counts

If File A and File B have different page counts, the app shows a warning before proceeding: "File A has X pages, File B has Y pages. The extra Z page(s) will be appended at the end." The user can cancel or continue. The extra pages from the longer file are appended in order after the interleaved section.

### Layout

Merge mode uses a two-column layout:

- **Left panel** — two side-by-side thumbnail strips, one per input file.
- **Right panel** (fills remaining space) — the page detail view, showing whichever page was most recently selected in either thumbnail strip.

The thumbnail strip for the file containing the second output page is offset downward by half a thumbnail height. This makes the interleaving order visually apparent: the two files' pages appear to slot between each other.

```
  A               B
  ┌──────────┐
  │   A1     │
  └──────────┘  ┌──────────┐
                │   B1     │
  ┌──────────┐  └──────────┘
  │   A2     │
  └──────────┘  ┌──────────┐
                │   B2     │
  ┌──────────┐  └──────────┘
  │   A3     │
  └──────────┘
```

The offset makes the interleaving order visually apparent without needing labels.

### Error handling

TBD.

## Mode: Split

### Workflow

1. The user loads an input PDF via a file picker dialog or by dragging and dropping a file onto the app window.
2. The app displays all pages as thumbnails in the left panel. Clicking a thumbnail selects it and updates the detail panel on the right.
3. The user defines split points by clicking in the gaps between page thumbnails. A visual divider appears at each split point; clicking again removes it. Dividers can also be repositioned by dragging them to a different gap. Each divider marks where a new output file begins.
4. The user sets a global filename template using `{date}` (today's date as `YYYY-MM-DD`) and `{name}` (a per-file label). Example: `{date} {name}` → `2026-06-12 invoice.pdf`. The app prefills the filename for each output file using this template. The user can then edit any individual file's name before exporting.
5. The user sets a global output folder (an existing folder on the local filesystem, or a Google Drive folder if Drive integration is enabled). For each output file, the user can adjust:
   - The prefilled filename (editable)
   - The destination folder (overridable per file)
6. The user clicks Export. Before splitting, the app checks for filename conflicts at each destination. If any conflict is found, the export is aborted and an error message identifies the conflicting files. Once resolved, the app splits the input PDF and writes (or uploads) each output file. Afterwards, the app prompts the user to keep, move, or delete the input file.

### Layout

Split mode uses a two-column layout:

- **Left panel** (adjustable width, drag handle on right edge) — a single vertically scrolling area that combines the thumbnail strip and output file controls.
- **Right panel** (fills remaining space) — the page detail view.

#### Left panel structure

The left panel is a continuous scroll area. Pages are grouped by output file. Each group is preceded by a compact **output file header** containing the editable filename field and (when applicable) destination folder. Split-point dividers between groups are the visual boundary between one output file and the next.

```
┌─ invoice.pdf ──────────────────────┐
│ folder: /Documents                 │
└────────────────────────────────────┘
  [page 1 thumbnail]
  [page 2 thumbnail]
  [page 3 thumbnail]
  ──────── [gap / split point] ───────
┌─ receipt.pdf ──────────────────────┐
│ folder: /Documents                 │
└────────────────────────────────────┘
  [page 4 thumbnail]
  [page 5 thumbnail]
```

Clicking a gap toggles a split point there and creates a new output file section. The filename and folder fields for each section appear immediately above its pages.

### Keyboard shortcuts

| Key     | Action                                                  |
| ------- | ------------------------------------------------------- |
| `Space` | Toggle a split point after the selected page            |
| `Tab`   | Move focus to the next filename input in the left panel |

### Google Drive integration (optional)

- Authentication uses Google OAuth via a browser window, triggered the first time Drive is enabled. Credentials are stored locally and reused in future sessions.
- When Drive is enabled, each output file header in the left panel shows a Drive folder field. Clicking it opens a folder browser modal that displays the user's Drive folder tree. The user navigates the tree and selects a destination folder. The selected path is shown in the header (e.g. `My Drive / Clients / Smith / 2026`).
- The folder tree is fetched lazily — the first time the user opens the folder browser in a session.
- The folder browser shows a **recently used folders** list at the top for quick access. This list persists across sessions.
- The global output folder setting can be set to a Drive folder, which prefills all output file headers. Individual headers can be overridden.
- After export, each output file is uploaded to its designated Drive folder. If an upload fails, the affected header shows an inline error message and a Retry button; other uploads are unaffected.
- When Drive is enabled, the local subfolder name for each output file is derived automatically from the Drive folder path (see Local folder sorting below).

### Local folder sorting

Each output file can be assigned a subfolder name. The file is then saved to `[output folder] / [subfolder] / filename.pdf` rather than directly into the output folder.

When Drive is enabled, the subfolder name is derived automatically from the innermost component of the Drive folder path (e.g. `My Drive / Clients / Smith / 2026` → subfolder `2026`). When Drive is disabled, the user enters the subfolder name manually in the left panel header.

If two or more output files in the same batch share the same subfolder name, the app prefixes the parent folder name to disambiguate. If the parent name is also shared, it walks further up the hierarchy until uniqueness is achieved. Examples:

- `Clients / Smith / 2026` and `Clients / Jones / 2026` → `Smith - 2026` and `Jones - 2026`
- `Clients / Smith / 2026` and `Archive / Smith / 2026` → `Clients - Smith - 2026` and `Archive - Smith - 2026`

(When Drive is disabled and names are entered manually, the user is responsible for avoiding conflicts — no automatic disambiguation applies.)

To ensure disambiguation is fully deterministic, **the output folder must be empty when the input PDF is opened**. The app enforces this and shows an error if the folder is not empty.

### Persisted settings

The following settings are saved across sessions:

- Last-used output folder
- Filename template

### Error handling

TBD.

## Implementation checklist

### Primitives

- [x] **Go: PDF merge/split** — interleave and split PDFs with pdfcpu; hardcoded paths; `_test.go` harness, no UI
- [x] **Frontend: Thumbnail panel** — virtualized vertical scroll, on-demand per-page render via Go/mutool, resizable width with drag handle
- [x] **Frontend: Detail panel** — pan and zoom with `react-zoom-pan-pinch`, driven by selected page

### Merge mode

- [x] **Step 1: End-to-end merge pipeline** — Go `OpenFileDialog` / `SaveFileDialog` RPCs; `MergePDFs` Wails RPC; minimal UI with two file-picker buttons and a Merge & Save button; no thumbnails
- [x] **Step 2: Thumbnail strips** — two-column layout using existing `ThumbnailPanel` primitive, one per file, side by side; Merge & Save moves to toolbar
- [x] **Step 3: A/B selector + visual offset** — "First page in" toggle (File A / File B); second strip offset down by half a thumbnail height
- [x] **Step 4: Reverse checkbox + page-count warning** — "Reverse File B" checkbox wired into merge call; detect unequal counts and show info in toolbar
- [x] **Step 5: Detail panel** — existing `DetailPanel` primitive on the right; selection in either strip updates it; `←` / `→` keyboard navigation
- [x] **Step 6: Page editing** — rotate and skip within the merge view, applied before the merge call

### Split mode

- [x] **Step 1: Split points UI** — resizable left panel + detail panel; clickable gaps between thumbnails toggle a visual divider; no drag-and-drop yet
- [x] **Step 2: Export pipeline** — Go split/export backend; Export button wired up; no filename control yet
- [x] **Step 3: Filename inputs** — per-output-file editable filename field in each section header
- [x] **Step 4: Filename prefill** — global filename template with `{date}` / `{name}` tokens; prefills each section header on creation
- [x] **Step 5: Output folder** — global output folder picker; per-file folder override in section header
- [ ] **Step 6: Divider drag-and-drop** — reposition or delete dividers by dragging
- [ ] **Step 7: Rotate pages**
- [ ] **Step 8: Skip pages**
- [ ] **Step 9: Reorder pages**
- [ ] **Step 10: Export polish** — filename conflict check before export; keep/move/delete prompt for input file after export; enforce empty output folder on open
- [ ] **Step 11: Keyboard shortcuts** — `Space` to toggle split point, `Tab` to move between filename inputs
- [ ] **Step 12: Persisted settings** — last-used output folder, filename template

### Google Drive integration

- [ ] **OAuth authentication** — browser-based sign-in, credentials stored locally and reused across sessions
- [ ] **Folder browser modal** — lazy-loaded Drive folder tree, opens when clicking a folder field
- [ ] **Recently used folders** — shown at the top of the folder browser, persisted across sessions
- [ ] **Upload on export** — per-file upload to designated Drive folder, inline error + Retry on failure
- [ ] **Local subfolder derivation** — subfolder name derived automatically from the innermost Drive path component; disambiguation when multiple files share the same leaf name

## Future / out of scope for v1

- **Insert pages from another PDF**: allow the user to pull pages from a second PDF into the current document before splitting. Planned for v2.
- **Scanning integration**: trigger a scan from within the app using OS or device APIs. Not currently planned but under consideration.
- **Page reordering**: drag thumbnails to reorder pages before export or merge. No clear use case identified for the current workflow; omitted from v1.
