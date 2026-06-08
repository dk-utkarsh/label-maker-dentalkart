# Inline Live-Preview Editing — Design

**Date:** 2026-06-06
**Status:** Approved, implementing

## Goal

Let users do all everyday label editing directly on the **Live Preview**, Excel/Google-Docs style, without repeatedly opening the **Extra Settings** panel. Click a text field on the label → a popover with all that field's formatting controls appears beside it. Double-click → edit text in place. Drag → reorder. The existing Extra Settings panel is kept as the advanced view.

## Decisions (from brainstorming)

- **Toolbar style:** floating **popover panel beside the selected field** (portaled so the scroll container never clips it).
- **Positioning model:** **drag-to-reorder + alignment/position from the toolbar**. The auto-fit layout engine is reused; print fidelity is preserved. (No free X/Y canvas.)
- **Extra Settings panel:** **kept** as the advanced panel.
- **Inline text editing:** **double-click a field to type directly** on the label (Enter = newline, select + Bold).
- **Inline scope:** **text fields only** (title / body / footer). Barcode/QR, logo, banner, and global toggles remain in the kept Extra Settings panel.

## Architecture

1. **Shared `FieldControls` component** — extract the per-field control cluster (text content + bold + apply-to-all/reset, role, font size, font family, font weight, the Upper/Label/Row/Box + border sub-toggles, alignment) out of `ConfigSidebar` into `src/components/FieldControls.tsx`. Both `ConfigSidebar`'s expanded card and the new popover render `<FieldControls column={col} />`. Single source of truth → guaranteed parity.

2. **`EditablePreview` wrapper** (`src/components/EditablePreview.tsx`) — wraps `<LabelPreview/>` and adds the interactive layer:
   - **Click delegation:** a single handler reads `data-field-column` from `event.target.closest(...)` to select a field.
   - **Selection outline:** an absolutely-positioned box drawn from the selected element's rect — a **sibling of `.label-content`, never part of the capture**.
   - **Popover:** `createPortal` to `document.body`, positioned to the right/left/below the field, holding `<FieldControls/>` + a header (field name, role, mode indicator, close).
   - **Inline text editor:** on double-click, an overlaid `<textarea>` sized to the field; commits to `setDataOverride` on blur/Esc/Enter-commit.
   - **Drag-to-reorder:** pointer-based; dragging the outline's grip handle reorders the field within the config array (reorders within its role group), reusing `setConfig`.

3. **`LabelPreview` changes** — add `data-field-column={f.column}` to each field's outer div in every render path (`renderField`, bordered-grid cells, code-row fields). No visual/layout change; attributes are ignored by html-to-image.

4. **`LabelApp` change** — render `<EditablePreview/>` in place of `<LabelPreview/>`.

## Export safety

All editing chrome (outline, handles, popover, textarea) renders **outside** `.label-content` and is gated on selection state. Selection is cleared when `previewIdx` changes (which the export loop does every iteration) and when `editingLabelIdx` changes. Exported PDFs/PNGs stay clean.

## Global vs per-label

Inline edits flow through the existing `updateField` / `setDataOverride`, which already branch on `editingLabelIdx`. The popover header shows whether you're editing **All labels** or **This label**.

## Phasing

1. `FieldControls` extraction + selection + popover (delivers the core "no more opening Extra Settings").
2. Double-click inline text editing.
3. Drag-to-reorder on the preview.
4. Polish (quick toolbar row, keyboard Esc/arrows).

## Round 2 — expanded scope (approved 2026-06-06)

User asked to (a) make barcode/QR, logo, and banner clickable too, and (b) "move anything with the mouse". For (b) they chose **Guided move (print-safe)** over a free X/Y canvas.

- **Clickable elements:** `data-element="logo|code|banner"` hooks added in `LabelPreview`. `EditablePreview` selection generalized to a key — `f:<column>` for fields, `e:logo|code|banner` for elements. Popover body branches: field → `FieldControls`, logo → `LogoControls` (new), code → `CodeControls` (new, also now used by `ConfigSidebar`), banner → inline text input. Banner also supports double-click in-place editing.
- **Guided move (drag):**
  - Fields: dragging now finds the nearest field across **all** sections. Vertical drop adopts the target's **role** (so a body field dropped among titles becomes a title → moves "upper to lower" across sections). Dropping in a field's right zone sets **same-row** (side-by-side, left/right). One `setConfig` writes the reordered array with the updated role/sameRow.
  - Logo: dragging the logo's grip moves it **top ↔ bottom** (new `logoPlacement` store field, threaded through snapshot + saved variations; `LabelPreview` renders the logo block at top or bottom).
- **Still print-safe:** auto-fit/auto-align preserved; export remains a clean snapshot of `.label-content` with all editing chrome outside it.

## Out of scope (for now)

- Free X/Y canvas placement and resize handles (explicitly declined in favor of guided move).
- Touch drag (tap-to-select + popover work on touch; drag-reorder is desktop-first).
