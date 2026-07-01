# Paper Scan Processor

A desktop application for post-processing PDF files containing batches of scanned documents. The app has two modes: **Merge** and **Split**.

## Tech stack

- **Desktop framework**: Wails
- **Backend**: Go
- **Frontend**: TypeScript + React
- **UI components**: Mantine
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
5. The user sets a global output folder (an existing folder on the local filesystem). For each output file, the user can adjust:
   - The prefilled filename (editable)
   - The destination folder (overridable per file)
6. The user clicks Export. Before splitting, the app checks for filename conflicts at each destination. If any conflict is found, the export is aborted and an error message identifies the conflicting files. Once resolved, the app splits the input PDF and writes each output file. Afterwards, the app prompts the user to keep, move, or delete the input file. The success modal includes an **"Open in Drive Upload"** button that switches to Drive Upload mode with the output folder pre-set as the root.

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

### Local subfolder (optional)

Each output file can be assigned a subfolder name. The file is then saved to `[output folder] / [subfolder] / filename.pdf` rather than directly into the output folder. The user enters the subfolder name manually in the section header. No automatic disambiguation is applied — the user is responsible for avoiding conflicts.

### Persisted settings

The following settings are saved across sessions:

- Last-used output folder
- Filename template

### Error handling

TBD.

## Mode: Drive Upload

For filing batches of local PDF files to Google Drive. Intended as the step after Split mode: once PDFs are exported to a local folder, the user switches to Drive Upload to route each file (or subfolder of files) to the correct place in Drive.

### Workflow

1. The user enters Drive Upload mode. If arriving via the Split mode export success modal, the root local folder is pre-set to the Split output folder; otherwise the user picks a root folder.
2. The app scans the root folder recursively and displays all files grouped by subfolder. Files in the root folder itself appear as a top-level group.
3. The user assigns a Google Drive destination folder to each subfolder group. The assignment propagates to all files within the group. Individual files can override the group's assignment.
4. The user can select any file to preview it — the thumbnail strip and detail panel update to show that file's pages.
5. The user clicks Upload. Before uploading, the app checks each Drive destination for filename conflicts. If any are found, conflicting files are flagged and the upload is aborted until resolved.
6. Uploads proceed with per-file progress. If a file fails, it shows an inline error and a Retry button; other uploads continue unaffected.
7. After all uploads complete, each subfolder group shows an "Open in Drive" link to its destination folder.
8. The user is prompted to delete or move to a local archive folder the source files that uploaded successfully.

### Layout

Drive Upload mode uses a three-column layout:

- **Left panel** (fixed width) — the file tree: root folder → subfolders → files. Each subfolder header shows an editable name and its Drive destination folder. Each file shows an editable filename, inherits the parent subfolder's Drive destination (with an option to override), and — space permitting — displays file size and page count as secondary metadata. Edited names are the names used on Drive; the local files are not renamed on disk.
- **Middle panel** (adjustable width, drag handle on right edge) — thumbnail strip of the currently selected PDF.
- **Right panel** (fills remaining space) — the page detail view.

```
┌──────────────────────────────┐  ┌────────────┐  ┌───────────────────┐
│ Root: /output/batch  [Change] │  │            │  │                   │
│                               │  │  [page 1]  │  │                   │
│ 📁 invoices/                  │  │  [page 2]  │  │   Detail view     │
│    Drive: Finance/Invoices ▼  │  │  [page 3]  │  │   (selected page) │
│    📄 2026-07-01 invoice.pdf  │  │            │  │                   │
│       3 pages · 1.2 MB        │  │            │  │                   │
│    📄 2026-07-02 invoice.pdf  │  │            │  │                   │
│       2 pages · 0.8 MB        │  │            │  │                   │
│                               │  │            │  │                   │
│ 📁 receipts/                  │  │            │  │                   │
│    Drive: [not assigned] ▼    │  │            │  │                   │
│    📄 2026-07-01 receipt.pdf  │  │            │  │                   │
│       1 page · 0.4 MB         │  │            │  │                   │
│                               │  │            │  │                   │
│ 📄 misc.pdf                   │  │            │  │                   │
│    Drive: [not assigned] ▼    │  │            │  │                   │
│    4 pages · 2.1 MB           │  │            │  │                   │
│                               │  │            │  │                   │
│ [Upload All]                  │  │            │  │                   │
└──────────────────────────────┘  └────────────┘  └───────────────────┘
```

Clicking a subfolder header selects all files in that group. Clicking a file selects it and loads its pages into the thumbnail strip and detail panel.

### Drive folder assignment

- Clicking a Drive folder field (on a subfolder header or an individual file) opens a **folder browser modal** displaying the user's Drive folder tree, fetched lazily on first open. A **recently used folders** list appears at the top for quick access.
- Selecting multiple items (files and/or subfolders) and assigning a Drive folder applies it to all selected items at once.
- A subfolder's Drive folder assignment propagates to all files within it. A file-level assignment overrides the parent subfolder's.

### Remembered folder mappings

The app remembers Drive folder assignments keyed on local subfolder name. When a subfolder with a previously seen name is loaded, the app auto-fills its Drive destination. The user can change it before uploading. Mappings persist across sessions.

### Post-upload cleanup

After a successful upload batch, the user is prompted to either delete the source files or move them to a local archive folder. The archive folder destination can be configured and is remembered across sessions.

### Persisted settings

- Drive folder mappings (local subfolder name → Drive folder)
- Recently used Drive folders
- Last-used root local folder
- Local archive folder path

### Authentication

Google OAuth via a browser window, triggered the first time Drive Upload mode is used. Credentials are stored locally and reused in future sessions.

### Error handling

If a file upload fails, the error is shown inline next to that file in the left panel. Other uploads in the batch continue unaffected. The user can retry failed uploads individually without restarting the batch.

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
- [ ] ~~Step 6: Divider drag-and-drop — reposition or delete dividers by dragging~~
- [x] **Step 7: Rotate pages**
- [x] **Step 8: Skip pages**
- [x] **Step 9a: Reorder pages via up/down buttons**
- [x] **Step 9b: Reorder pages via drag and drop**
- [x] **Step 10: Export polish** — filename conflict check before export; keep/move/delete prompt for input file after export; "Open in Drive Upload" button in success modal
- [ ] **Step 11: Keyboard shortcuts** — `Space` to toggle split point, `Tab` to move between filename inputs
- [ ] **Step 12: Persisted settings** — last-used output folder, filename template

### Drive Upload mode

- [ ] **Step 1a: OAuth authentication** — Go backend only, no UI; OAuth via system default browser with localhost callback; credentials stored locally and reused across sessions
- [ ] **Step 1b: Folder listing** — list contents of a hardcoded root folder and a hardcoded subfolder via Drive API
- [ ] **Step 1c: File upload** — upload a hardcoded local file to a hardcoded Drive folder
- [ ] **Step 2: Filesystem scan + file tree UI** — root folder picker; recursive scan and display of files grouped by subfolder; file size and page count as secondary metadata
- [ ] **Step 3: Drive folder assignment UI + inline renaming** — folder browser modal with lazy-loaded Drive tree and recently used list; assignment at subfolder and file level; batch assignment for multi-select; inline editable name for each subfolder and file (controls the Drive upload name, not the local filename)
- [ ] **Step 4: PDF preview** — selecting a file loads it into the middle thumbnail strip and right detail panel (reuses existing primitives)
- [ ] **Step 5: Upload queue** — per-file upload with progress; inline error + Retry on failure; "Open in Drive" link per group after completion
- [ ] **Step 6: Remembered folder mappings** — auto-fill Drive destination from saved subfolder-name→Drive-folder mapping; persisted across sessions
- [ ] **Step 7: Post-upload cleanup** — prompt to delete or archive source files; archive moves files to a user-specified local archive folder
- [ ] **Step 8: Conflict detection** — check Drive for filename conflicts before uploading; flag conflicting files

### Code cleanup

- [x] **Move `pageCache.ts` to `src/lib/`** — it's a module-level singleton, not a hook; only `usePageCacheRender` is a hook
- [x] **Move `usePDFFile.ts` into `MergeMode/`** — only used by MergeMode; SplitMode re-implements `rotate`/`toggleSkip` independently, so the hook is not truly shared
- [ ] **Fix duplicate global keydown handlers** — both `SplitMode/ThumbnailPanel` and `DetailPanel` listen to `ArrowLeft`/`ArrowRight`/`Delete` on `window`; after page reordering, the panel navigates by visual order while DetailPanel navigates by numeric order — the last-registered handler wins, producing wrong navigation; remove the overlapping keys from `DetailPanel` and handle them only in the mode-level panel
- [ ] **Remove unused packages** — `@mantine/dropzone` (CSS imported in `main.tsx` but component never used) and `zustand` (in `package.json` but never imported) can both be removed
- [ ] **Wrap `toggle` in `useCallback` in `useOutputFiles.ts:25`** — the only exported function not memoized; causes `handleToggleSplitPoint` (which depends on it) to recreate every render despite its own `useCallback`
- [ ] **Memoize `getSplitPoints` in `useOutputFiles.ts:79`** — creates a new `Set` on every call; make it a `useMemo` like `duplicateFirstPages`
- [ ] **Name the magic pixel offsets in `MergeMode/index.tsx`** — `totalWidth - 22` and `colWidth + 26` are two different values for what comments describe as "scrollbar + gap"; name them as constants and reconcile
- [ ] **Add `out.Sync()` in `pdf.go:copyFile`** — without a sync before close, a crash between write completion and OS flush can silently corrupt the output PDF
- [ ] **Wrap `ThumbColumn` return in a Fragment** — currently returns a raw `JSX.Element[]` array; wrapping in `<>...</>` is more conventional and clarifies intent

## Future / out of scope for v1

- **Insert pages from another PDF**: allow the user to pull pages from a second PDF into the current document before splitting. Planned for v2.
- **Scanning integration**: trigger a scan from within the app using OS or device APIs. Not currently planned but under consideration.
- **Page reordering**: drag thumbnails to reorder pages before export or merge. No clear use case identified for the current workflow; omitted from v1.
