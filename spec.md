# Paper Scan Processor

A desktop application for post-processing PDF files containing batches of scanned documents. The app has three modes: **Merge**, **Split**, and **Drive Upload**.

See [`checklist.md`](checklist.md) for implementation progress against this spec.

## Tech stack

- **Desktop framework**: Wails
- **Backend**: Go
- **Frontend**: TypeScript + React
- **UI components**: Mantine
- **Virtualization**: TanStack Virtual
- **Drag-and-drop**: dnd-kit
- **PDF manipulation**: pdfcpu
- **PDF rendering** (thumbnails): `pdftoppm` (Poppler, system install, called as subprocess)

## Common elements

Both modes include a thumbnail panel and a page detail panel, and support the same per-page editing operations.

### Thumbnail panel

A vertically scrolling strip of page thumbnails. Width is user-adjustable via a drag handle; thumbnails scale to fill the panel width. Rendering is on-demand and virtualized — only visible thumbnails (plus a small overscan buffer) are rendered at any given time.

The Go backend exposes a per-page render method returning a base64-encoded PNG; the frontend requests thumbnails as they scroll into view (`pdftoppm` subprocess).

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

Reordering pages is Split-mode only — see below.

## Mode: Merge

For scanners that can only scan one side at a time. The user scans all front pages as one PDF and all back pages as another, then uses Merge mode to interleave them into a single PDF.

### Workflow

1. The user loads two PDF files, labelled **File A** and **File B**.
2. The user selects which file contains the first page (**First page in: File A / File B**).
3. A **Reverse File B** checkbox controls whether File B is reversed before interleaving. This should be checked when the paper stack was flipped between scans (the typical case, when scanning one side at a time), causing the second-scanned pages to be in reverse order.
4. The app interleaves the pages: A1, B1, A2, B2, etc.
5. The user saves the merged result as a new PDF file on disk. A success modal offers **"Open in Default App"** and **"Open in Split Mode"** buttons — the latter switches directly to Split mode with the merged file loaded, for further processing.

### Unequal page counts

If File A and File B have different page counts, a warning icon appears in the toolbar; hovering it shows "File A has X pages, File B has Y pages. The extra Z page(s) will be appended at the end." This is informational only — merging isn't blocked. The extra pages from the longer file are appended in order after the interleaved section.

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
3. The user defines split points by clicking in the gaps between page thumbnails. A visual divider appears at each split point; clicking again removes it. Each divider marks where a new output file begins.
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

Pages can be reordered by dragging a thumbnail to a new position, or via up/down buttons that appear on hover. Moving a page across a split point moves it into the adjacent output file.

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

For filing batches of local files (PDFs and other scans, e.g. images) to Google Drive. Intended as the step after Split mode: once PDFs are exported to a local folder, the user switches to Drive Upload to route each file (or subfolder of files) to the correct place in Drive.

### Workflow

1. The user enters Drive Upload mode. If arriving via the Split mode export success modal, the root local folder is pre-set to the Split output folder; otherwise the user picks a root folder.
2. The app scans the root folder recursively (symlinked directories are not followed) and displays all files grouped by subfolder. Files in the root folder itself appear as a top-level group. Everything starts selected for upload.
3. The user can deselect files or subfolders to exclude them from the upload. Excluded items don't need a Drive destination and are skipped by the conflict check and the upload itself.
4. The user assigns a Google Drive destination folder to each subfolder group. The assignment propagates to all files within the group. Individual files can override the group's assignment.
5. The user can select any PDF file to preview it — the thumbnail strip and detail panel update to show that file's pages. Non-PDF files (e.g. images) can still be assigned and uploaded, just without a preview.
6. The user clicks **Upload All**. Before uploading, the app checks each Drive destination for filename conflicts among the selected files. If any are found, conflicting files are flagged and the upload is aborted until resolved.
7. Once the conflict check passes, the file tree locks for the rest of the session (see Locking below): every Drive-assignment badge, in both the main tree and the upload progress modal that opens, immediately becomes an "open in Drive" link, since the destination is already fixed at that point. Files upload sequentially, one at a time, with per-file status shown in the modal. A **Cancel** control aborts whichever file is currently uploading — marking it "Cancelled" rather than leaving it in an ambiguous uploading state — while **Cancel remaining** stops any files still queued. If a file fails, it shows an inline error and a Retry button in the modal; other uploads continue unaffected. The modal blocks closing while uploads are in progress.
8. The user is prompted to delete or move to a local archive folder the source files that uploaded successfully.

### Layout

Drive Upload mode uses a three-column layout:

- **Left panel** (fixed width) — the file tree: root folder → subfolders (nested to match the local folder structure) → files. Each subfolder header is collapsible (starting expanded), shows a selection checkbox, an editable name, and its Drive destination folder. Each file shows a selection checkbox, an editable filename, inherits the parent subfolder's Drive destination (with an option to override), and — space permitting — displays file size and page count as secondary metadata (non-PDF files show size only, since page count doesn't apply). A file whose page count can't be read — a corrupt PDF — is still shown, flagged with a warning icon, rather than dropped from the tree. Edited names are the names used on Drive; the local files are not renamed on disk.
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

A subfolder's chevron is a dedicated expand/collapse control: it always toggles the subfolder open/closed and never changes the selection, regardless of modifier keys. Clicking a row's name/label selects it, replacing any existing selection. Cmd/Ctrl-click instead adds or removes that row from the current selection, building a multi-selection of files and/or subfolders for batch Drive folder assignment (see below). As a convenience, a plain (non-modifier) click on a subfolder's name also toggles its expand/collapse, but only when the selection held zero or one item just before the click; once two or more items are selected, clicking a subfolder's name only replaces the selection, leaving expand/collapse to the chevron, so building or adjusting a multi-selection doesn't pop folders open or closed as a side effect.

The thumbnail strip and detail panel track the last previewable file *touched* by a click, independent of the selection itself: any click on a previewable file — plain or Cmd/Ctrl, whether it adds the file to the selection or removes it — updates the preview to that file, even while multiple items remain selected. Clicking a subfolder, or a non-previewable file (corrupt/non-PDF), leaves the preview panel showing whatever was last previewed rather than clearing it. There's a single selection concept and highlight style shared by preview and batch assignment, not two — but the preview panel itself follows the last-touched previewable file, not selection size. Since the previewed file can now diverge from the current selection (e.g. after Cmd/Ctrl-removing it, or while multiple other items are selected), the previewed file's name is shown as a heading above the detail panel (the primary reading view; the thumbnail strip beside it always mirrors the same file, so one heading resolves the ambiguity for both), so it's never ambiguous which file is on screen. Added by Drive Upload's own wrapper around the shared `DetailPanel` primitive, not the primitive itself, since Merge/Split mode use `DetailPanel` too and don't have this divergence to resolve.

### Drive folder assignment

- Clicking a Drive folder field (on a subfolder header or an individual file) opens a **folder browser modal** displaying the user's Drive folder tree, fetched lazily on first open. A **recently used folders** list appears at the top for quick access. This always assigns just that one row, regardless of the current multi-selection. The modal also supports creating a new folder inside the currently browsed location and selecting it as the destination, for when the right Drive folder doesn't exist yet.
- An assigned folder can be cleared back to inherited/not-assigned via a clear (✕) control next to the badge.
- A toolbar "Assign Drive folder…" action, enabled whenever the multi-selection (Cmd/Ctrl-click, see above) is non-empty and the tree isn't locked, opens the same folder browser modal and applies the picked folder to every selected item at once — subfolders get a group assignment, files get a file-level override, via the same setters and propagation/override rules as a single assignment. The action is hidden/disabled once the tree is locked; the multi-selection and click-to-preview keep working.
- If the selection includes both a subfolder and one of its own descendants (a nested file or subfolder), the descendant is pruned before applying — only the topmost selected item in each selected subtree gets an assignment, and the rest inherit it normally. Applying to both isn't a conflict at the moment of the click (it's the same picked folder either way), but leaving the descendant with its own override would pin it independently, so it silently stops following the subfolder if that assignment is changed later.
- A subfolder's Drive folder assignment propagates to all files within it. A file-level assignment overrides the parent subfolder's.

### Inclusion selection

- Every subfolder and file has a checkbox controlling whether it's included in the upload. Everything starts selected on a fresh scan; this always resets to fully selected (it is not remembered across scans, unlike Drive folder mappings).
- Checking or unchecking a subfolder recursively sets all of its descendants (nested subfolders and files) to the same state.
- Unchecking a single file or subfolder underneath an otherwise fully-selected subfolder puts that subfolder into an indeterminate state; this propagates upward through ancestors as needed. Unchecking the last remaining selected descendant of a subfolder leaves it fully unselected rather than indeterminate — and that resolution is itself recursive: if that was also the last selected descendant of its own parent, the parent becomes fully unselected too, and so on up to the root. The same recursive collapse applies symmetrically in the other direction: checking the last remaining unselected descendant leaves a subfolder fully selected rather than indeterminate, propagating upward the same way.
- Clicking an indeterminate subfolder's checkbox selects all of its descendants (an indeterminate checkbox click always selects, never clears).
- A toolbar-level "Select All" / "Select None" shortcut applies to the whole tree.
- Excluded files and subfolders don't need a Drive destination assignment and are skipped by the pre-upload conflict check and the upload itself. They remain visible, and PDFs can still be selected for preview.
- Selection checkboxes are disabled once the tree is locked (same `locked` state that freezes Drive folder assignment and renaming after "Upload All" is clicked).

### Locking

Clicking **Upload All** locks the entire tree for the rest of that root's session: selection checkboxes, Drive folder assignment, and renaming all become read-only, and every Drive-assignment badge — including its clear (✕) control — is replaced by an "open in Drive" link, since the destination is fixed at that point regardless of whether the upload has actually completed yet. Picking a new root folder is the only way back to an editable tree. Retrying a failed upload happens from within the upload progress modal, not via a control in the main tree.

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

Google OAuth via a browser window, triggered the first time Drive Upload mode is used. Credentials are stored locally and reused in future sessions. If the stored credentials are no longer valid (e.g. an expired or revoked refresh token), the user is re-prompted to authenticate.

### Error handling

If a file upload fails, the error is shown inline next to that file in the upload progress modal. Other uploads in the batch continue unaffected. The user can retry failed uploads individually, from within the modal, without restarting the batch.

## Global error handling

The mode-specific "Error handling" sections above cover *expected* error conditions the app already knows how to name and react to (unequal page counts, filename conflicts, a failed upload). This section covers the remaining case: *unexpected* errors — bugs, panics, a call site that forgot to catch a rejected promise. Today those can fail silently (a swallowed exception, a stuck spinner) with no signal that anything went wrong. The goal is a fallback net that guarantees the user is notified, without trying to name or recover from the specific failure.

- **Frontend uncaught errors**: a top-level React error boundary around the app catches render-time exceptions, replacing the crashed subtree with a generic notice instead of a blank/frozen screen.
- **Frontend unhandled rejections**: a single `window.addEventListener('unhandledrejection', ...)` (plus `'error'` for non-promise exceptions) installed at startup shows a Mantine notification whenever an error reaches the top without having been caught by feature-specific handling. This is the backstop for the async call sites tracked in checklist.md's "Various" section — as those are migrated to explicit per-action error handling, this listener increasingly only fires for genuine bugs.
- **Backend panics**: each Wails-exposed RPC method recovers from panics and converts them into a returned error, so a bug in one RPC surfaces as a rejected JS promise (and thus hits the frontend backstop above) rather than crashing the whole process.
- **Presentation**: unexpected errors show a persistent (not auto-dismissing) notification — "An unexpected error occurred" plus the underlying error text. No retry/recovery is attempted automatically, since the cause is by definition unhandled and unclassified.

See [`checklist.md`](checklist.md) for implementation progress against this spec, including the "Various" TODOs and code review findings.

## Future / out of scope for v1

- **Insert pages from another PDF**: allow the user to pull pages from a second PDF into the current document before splitting. Planned for v2.
- **Scanning integration**: trigger a scan from within the app using OS or device APIs. Not currently planned but under consideration.
- **Pre-upload duplicate-scan review**: a review screen before upload, grouping queued files by Drive destination folder and showing them alongside files already present there, so the user could visually catch the same document scanned twice under different names/bytes. Descoped — accidental duplicate uploads are expected to be rare enough that the UI isn't worth building. If revisited, the design work landed on: gate the upload action until every file has an effective (own-or-inherited) Drive destination assignment; present the review as a modal, consistent with the existing Drive folder picker; group by *resolved* Drive destination folder id (merging local subfolders that resolve to the same Drive folder); and, since a destination folder can hold hundreds of existing files, avoid a full side-by-side dump by merging queued (highlighted) and existing files into one alphabetically-sorted list, showing only existing entries within ±1 position of a queued entry (likely-duplicate names sort near each other) and collapsing the rest into an expandable "⋯ N more files ⋯".
