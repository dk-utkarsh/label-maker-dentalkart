import os
import io
import zipfile
import tempfile
from pathlib import Path

from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.responses import HTMLResponse, StreamingResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from reportlab.lib.units import mm
from reportlab.lib.pagesizes import letter
from reportlab.pdfgen import canvas
from reportlab.lib.utils import ImageReader
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from openpyxl import load_workbook
from PIL import Image
import barcode
from barcode.writer import ImageWriter

app = FastAPI(title="Label Generator")

UPLOAD_DIR = Path(__file__).parent / "uploads"
UPLOAD_DIR.mkdir(exist_ok=True)

# ──────────────────────────────────────────────
# Routes
# ──────────────────────────────────────────────

@app.get("/", response_class=HTMLResponse)
async def index():
    html_path = Path(__file__).parent / "static" / "index.html"
    return html_path.read_text()


@app.post("/parse-excel")
async def parse_excel(file: UploadFile = File(...)):
    """Read Excel, return column names and first 5 rows as preview."""
    if not file.filename.endswith((".xlsx", ".xls")):
        raise HTTPException(400, "Please upload an Excel file (.xlsx or .xls)")

    content = await file.read()
    filepath = UPLOAD_DIR / "data.xlsx"
    filepath.write_bytes(content)

    columns, rows = read_excel(filepath)
    if not columns:
        raise HTTPException(400, "No data found in the Excel file")

    preview_rows = rows[:5]
    return JSONResponse({
        "columns": columns,
        "total_rows": len(rows),
        "preview": preview_rows,
    })


@app.post("/upload-logo")
async def upload_logo(file: UploadFile = File(...)):
    """Save uploaded logo and return its path."""
    ext = Path(file.filename).suffix.lower()
    if ext not in (".png", ".jpg", ".jpeg", ".svg", ".webp", ".bmp"):
        raise HTTPException(400, "Unsupported image format")

    content = await file.read()
    logo_path = UPLOAD_DIR / f"logo{ext}"
    # Remove old logos
    for old in UPLOAD_DIR.glob("logo.*"):
        old.unlink()
    logo_path.write_bytes(content)
    return {"status": "ok", "path": str(logo_path)}


@app.post("/generate")
async def generate_labels(
    width: float = Form(...),
    height: float = Form(...),
    mode: str = Form("single"),  # "single" or "zip"
    field_config: str = Form(...),  # JSON string
    filename_field: str = Form(""),  # column to use for ZIP filenames
    barcode_field: str = Form(""),  # column to generate barcode from
    banner_text: str = Form(""),  # text for bottom banner
):
    """Generate PDF labels and return as download."""
    import json

    excel_path = UPLOAD_DIR / "data.xlsx"
    if not excel_path.exists():
        raise HTTPException(400, "No Excel file uploaded yet")

    # Find logo
    logo_path = None
    for ext in (".png", ".jpg", ".jpeg", ".webp", ".bmp"):
        p = UPLOAD_DIR / f"logo{ext}"
        if p.exists():
            logo_path = p
            break

    columns, rows = read_excel(excel_path)
    if not rows:
        raise HTTPException(400, "No data rows found in Excel")

    try:
        config = json.loads(field_config)
    except json.JSONDecodeError:
        raise HTTPException(400, "Invalid field configuration")

    # config is a list of {column, role} where role is title/body/footer/hidden
    active_fields = [f for f in config if f.get("role") != "hidden"]

    if mode == "zip":
        return generate_zip(rows, active_fields, width, height, logo_path, filename_field, barcode_field, banner_text)
    else:
        return generate_single_pdf(rows, active_fields, width, height, logo_path, barcode_field, banner_text)


# ──────────────────────────────────────────────
# Excel Reading
# ──────────────────────────────────────────────

def read_excel(filepath: Path):
    """Read Excel file, return (columns, rows) where rows is list of dicts."""
    wb = load_workbook(str(filepath), data_only=True)

    for sheet_name in wb.sheetnames:
        ws = wb[sheet_name]
        headers = []
        for cell in ws[1]:
            val = str(cell.value).strip() if cell.value is not None else ""
            headers.append(val)

        if not any(headers):
            continue

        # Clean empty trailing headers
        while headers and not headers[-1]:
            headers.pop()

        if not headers:
            continue

        rows = []
        for row in ws.iter_rows(min_row=2, max_col=len(headers), values_only=True):
            row_data = {}
            all_empty = True
            for i, val in enumerate(row):
                if i < len(headers) and headers[i]:
                    cell_val = format_cell(val)
                    row_data[headers[i]] = cell_val
                    if cell_val:
                        all_empty = False
            if not all_empty:
                rows.append(row_data)

        if rows:
            return headers, rows

    return [], []


def format_cell(val):
    """Format cell value to string."""
    if val is None:
        return ""
    if isinstance(val, float):
        if val == int(val):
            return str(int(val))
        return f"{val:.2f}"
    return str(val).strip()


# ──────────────────────────────────────────────
# PDF Generation
# ──────────────────────────────────────────────

def generate_single_pdf(rows, fields, width_mm, height_mm, logo_path, barcode_field="", banner_text=""):
    """Generate a single PDF with all labels (one per page)."""
    buf = io.BytesIO()
    w = width_mm * mm
    h = height_mm * mm

    c = canvas.Canvas(buf, pagesize=(w, h))

    for i, row in enumerate(rows):
        draw_label(c, row, fields, w, h, width_mm, height_mm, logo_path, barcode_field, banner_text)
        if i < len(rows) - 1:
            c.showPage()

    c.save()
    buf.seek(0)

    return StreamingResponse(
        buf,
        media_type="application/pdf",
        headers={"Content-Disposition": "attachment; filename=labels.pdf"}
    )


def generate_zip(rows, fields, width_mm, height_mm, logo_path, filename_field, barcode_field="", banner_text=""):
    """Generate individual PDFs in a ZIP."""
    zip_buf = io.BytesIO()

    with zipfile.ZipFile(zip_buf, 'w', zipfile.ZIP_DEFLATED) as zf:
        for i, row in enumerate(rows):
            pdf_buf = io.BytesIO()
            w = width_mm * mm
            h = height_mm * mm
            c = canvas.Canvas(pdf_buf, pagesize=(w, h))
            draw_label(c, row, fields, w, h, width_mm, height_mm, logo_path, barcode_field, banner_text)
            c.save()
            pdf_buf.seek(0)

            # Filename from field or fallback
            name = ""
            if filename_field and filename_field in row:
                name = row[filename_field]
            if not name:
                name = f"label_{i + 1}"
            # Sanitize filename
            safe_name = "".join(c if c.isalnum() or c in "-_ " else "_" for c in str(name))
            zf.writestr(f"{safe_name}.pdf", pdf_buf.read())

    zip_buf.seek(0)
    return StreamingResponse(
        zip_buf,
        media_type="application/zip",
        headers={"Content-Disposition": "attachment; filename=labels.zip"}
    )


def get_field_font_size(field, h, role_default):
    """Compute font size for a field based on its fontSize setting."""
    size_mult = {"xs": 0.55, "sm": 0.7, "md": 1.0, "lg": 1.3, "xl": 1.6}
    fs = field.get("fontSize", "auto")
    if fs == "auto" or fs not in size_mult:
        return role_default
    return role_default * size_mult[fs]


def format_field_value(field, val):
    """Apply prefix, suffix, uppercase to value."""
    v = str(val)
    if field.get("uppercase"):
        v = v.upper()
    prefix = field.get("prefix", "")
    suffix = field.get("suffix", "")
    return f"{prefix}{v}{suffix}"


def draw_aligned(c, text, x_start, cursor_y, inner_w, align, font_name, font_size):
    """Draw text with alignment."""
    if align == "center":
        tw = c.stringWidth(text, font_name, font_size)
        c.drawString(x_start + (inner_w - tw) / 2, cursor_y, text)
    elif align == "right":
        tw = c.stringWidth(text, font_name, font_size)
        c.drawString(x_start + inner_w - tw, cursor_y, text)
    else:
        c.drawString(x_start, cursor_y, text)


def group_into_rows(fields):
    """Group consecutive fields by sameRow flag into visual rows."""
    rows = []
    for f in fields:
        if f.get("sameRow") and rows:
            rows[-1].append(f)
        else:
            rows.append([f])
    return rows


def draw_field_text(c, field, row_data, x, y, cell_w, fs, role_default_fs):
    """Draw a single field's text at position. Returns height used."""
    col = field["column"]
    val = row_data.get(col, "")
    if not val:
        val = ""

    actual_fs = get_field_font_size(field, 0, fs) if fs else role_default_fs
    is_bold = field.get("bold", False)
    font_name = "Helvetica-Bold" if is_bold else "Helvetica"
    show_label = field.get("showLabel", True)
    align = field.get("align", "left")

    display_val = format_field_value(field, val) if val else ""

    if show_label and val:
        text = f"{col}: {display_val}"
    elif val:
        text = display_val
    else:
        text = f"{col}: —"

    c.setFont(font_name, actual_fs)
    c.setFillColorRGB(0, 0, 0)
    lines = wrap_text(c, text, cell_w, font_name, actual_fs)
    line = lines[0] if lines else ""

    if show_label and line.startswith(f"{col}: ") and align == "left":
        label_part = f"{col}: "
        c.setFont("Helvetica-Bold", actual_fs)
        lw = c.stringWidth(label_part, "Helvetica-Bold", actual_fs)
        c.drawString(x, y, label_part)
        c.setFont(font_name, actual_fs)
        c.drawString(x + lw, y, line[len(label_part):])
    else:
        draw_aligned(c, line, x, y, cell_w, align, font_name, actual_fs)

    return actual_fs


def generate_barcode_image(value):
    """Generate a barcode image from a value and return as PIL Image."""
    try:
        code128 = barcode.get_barcode_class('code128')
        bc = code128(str(value), writer=ImageWriter())
        buf = io.BytesIO()
        bc.write(buf, options={"write_text": False, "module_height": 8, "quiet_zone": 2})
        buf.seek(0)
        return Image.open(buf)
    except Exception:
        return None


def draw_label(c, row_data, fields, w, h, w_mm, h_mm, logo_path, barcode_field="", banner_text=""):
    """Draw a single label on the canvas."""
    border_w = max(0.3 * mm, w * 0.004)
    pad = max(1.5 * mm, min(w, h) * 0.04)

    c.setStrokeColorRGB(0.2, 0.2, 0.2)
    c.setLineWidth(border_w)
    c.rect(border_w / 2, border_w / 2, w - border_w, h - border_w)

    inner_w = w - 2 * pad
    x_start = pad
    y_top = h - pad

    base_font = max(2 * mm, h * 0.04)
    title_font = max(2.5 * mm, h * 0.06)
    footer_font = max(1.5 * mm, h * 0.03)
    line_gap = base_font * 0.4
    cell_pad = max(0.8 * mm, h * 0.012)

    cursor_y = y_top

    # ── Logo ──
    if logo_path and logo_path.exists():
        try:
            img = ImageReader(str(logo_path))
            iw, ih = img.getSize()
            max_logo_w = inner_w * 0.30
            max_logo_h = (h - 2 * pad) * 0.15
            sc = min(max_logo_w / iw, max_logo_h / ih)
            draw_w = iw * sc
            draw_h = ih * sc
            c.drawImage(str(logo_path), x_start, cursor_y - draw_h,
                        width=draw_w, height=draw_h,
                        preserveAspectRatio=True, mask='auto')
            cursor_y -= draw_h + line_gap
        except Exception:
            pass

    title_fields = [f for f in fields if f["role"] == "title"]
    body_fields = [f for f in fields if f["role"] == "body"]
    footer_fields = [f for f in fields if f["role"] == "footer"]

    def draw_field_rows(field_list, default_fs):
        nonlocal cursor_y
        rows = group_into_rows(field_list)
        for visual_row in rows:
            n = len(visual_row)
            any_border = any(f.get("border") for f in visual_row)

            if n == 1:
                f = visual_row[0]
                fs = get_field_font_size(f, h, default_fs)
                row_h = fs + cell_pad * 2

                if f.get("border"):
                    cursor_y -= row_h
                    if cursor_y < pad:
                        break
                    c.setStrokeColorRGB(0.6, 0.6, 0.6)
                    c.setLineWidth(0.3 * mm)
                    c.rect(x_start, cursor_y, inner_w, row_h)
                    draw_field_text(c, f, row_data, x_start + cell_pad, cursor_y + cell_pad, inner_w - cell_pad * 2, fs, default_fs)
                    cursor_y -= line_gap * 0.3
                else:
                    cursor_y -= fs
                    if cursor_y < pad:
                        break
                    draw_field_text(c, f, row_data, x_start, cursor_y, inner_w, fs, default_fs)
                    cursor_y -= line_gap
            else:
                # Multiple fields on same row
                fs_list = [get_field_font_size(f, h, default_fs) for f in visual_row]
                max_fs = max(fs_list)
                row_h = max_fs + cell_pad * 2
                cell_w = inner_w / n

                cursor_y -= row_h
                if cursor_y < pad:
                    break

                for idx, f in enumerate(visual_row):
                    cx = x_start + idx * cell_w
                    fs = fs_list[idx]

                    if f.get("border") or any_border:
                        c.setStrokeColorRGB(0.6, 0.6, 0.6)
                        c.setLineWidth(0.3 * mm)
                        c.rect(cx, cursor_y, cell_w, row_h)
                        draw_field_text(c, f, row_data, cx + cell_pad, cursor_y + cell_pad, cell_w - cell_pad * 2, fs, default_fs)
                    else:
                        draw_field_text(c, f, row_data, cx, cursor_y + cell_pad, cell_w - cell_pad, fs, default_fs)

                cursor_y -= line_gap * 0.3

    # ── Titles ──
    draw_field_rows(title_fields, title_font)
    if title_fields:
        cursor_y -= line_gap * 0.5

    # ── Barcode ──
    if barcode_field and barcode_field in row_data and row_data[barcode_field]:
        bc_img = generate_barcode_image(row_data[barcode_field])
        if bc_img:
            try:
                bc_buf = io.BytesIO()
                bc_img.save(bc_buf, format='PNG')
                bc_buf.seek(0)
                bc_reader = ImageReader(bc_buf)
                bc_w, bc_h = bc_img.size
                max_bc_w = inner_w * 0.75
                max_bc_h = h * 0.1
                sc = min(max_bc_w / bc_w, max_bc_h / bc_h)
                draw_bc_w = bc_w * sc
                draw_bc_h = bc_h * sc
                bc_x = x_start + (inner_w - draw_bc_w) / 2
                cursor_y -= draw_bc_h
                if cursor_y > pad:
                    c.drawImage(bc_reader, bc_x, cursor_y,
                                width=draw_bc_w, height=draw_bc_h,
                                preserveAspectRatio=True, mask='auto')
                cursor_y -= line_gap * 0.5
            except Exception:
                pass

    # ── Body ──
    draw_field_rows(body_fields, base_font)

    # ── Footer separator ──
    any_footer_border = any(f.get("border") for f in footer_fields)
    if footer_fields and not any_footer_border and cursor_y > pad + footer_font * 2:
        cursor_y -= line_gap
        c.setStrokeColorRGB(0.7, 0.7, 0.7)
        c.setLineWidth(0.3 * mm)
        c.line(x_start, cursor_y, x_start + inner_w, cursor_y)
        cursor_y -= line_gap

    # ── Footers ──
    c.setFillColorRGB(0.3, 0.3, 0.3)
    draw_field_rows(footer_fields, footer_font)

    # ── Banner ──
    if banner_text:
        banner_h = max(2.5 * mm, h * 0.045)
        banner_fs = max(1.5 * mm, banner_h * 0.5)
        c.setFillColorRGB(0.07, 0.07, 0.07)
        c.rect(border_w, border_w, w - 2 * border_w, banner_h, fill=1, stroke=0)
        c.setFillColorRGB(1, 1, 1)
        c.setFont("Helvetica-Bold", banner_fs)
        tw = c.stringWidth(banner_text, "Helvetica-Bold", banner_fs)
        c.drawString((w - tw) / 2, border_w + (banner_h - banner_fs) / 2, banner_text)

    c.setFillColorRGB(0, 0, 0)


def wrap_text(c, text, max_width, font_name, font_size):
    """Wrap text to fit within max_width. Returns list of lines."""
    words = text.split()
    lines = []
    current_line = ""

    for word in words:
        test = f"{current_line} {word}".strip()
        if c.stringWidth(test, font_name, font_size) <= max_width:
            current_line = test
        else:
            if current_line:
                lines.append(current_line)
            # If single word is too wide, truncate it
            if c.stringWidth(word, font_name, font_size) > max_width:
                while c.stringWidth(word + "..", font_name, font_size) > max_width and len(word) > 1:
                    word = word[:-1]
                word += ".."
            current_line = word

    if current_line:
        lines.append(current_line)

    return lines if lines else [""]


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=5050, reload=True)
