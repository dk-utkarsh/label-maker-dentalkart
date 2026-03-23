'use client';

import { useEffect, useRef, useMemo } from 'react';
import JsBarcode from 'jsbarcode';
import QRCode from 'qrcode';
import { useStore } from '@/lib/store';

export default function LabelPreview({ overrideIdx }: { overrideIdx?: number } = {}) {
  const store = useStore();
  const { width, height, data, previewIdx, topRule } = store;
  const idx = overrideIdx ?? previewIdx;
  const effective = store.getEffectiveConfig(idx);
  const { config, logo, logoPosition, logoSize, bannerText, barcodeField, barcodeOrder, barcodeSize, qrSize, codeType, codeAlign } = effective;
  const barcodeRef = useRef<HTMLCanvasElement>(null);
  const qrRef = useRef<HTMLCanvasElement>(null);

  const row = data[idx] || {};
  const activeFields = config.filter(f => f.role !== 'hidden');

  // Scale mm → preview pixels
  const maxW = 550;
  const maxH = 750;
  const scale = Math.min(maxW / width, maxH / height);
  const wPx = width * scale;
  const hPx = height * scale;

  // All spacing derived from label dimensions
  const unit = Math.sqrt(wPx * hPx);
  const smallDim = Math.min(wPx, hPx);
  const pad = Math.max(4, smallDim * 0.045);
  const sectionGap = Math.max(2, hPx * 0.012);
  const rowGap = Math.max(1, hPx * 0.005);
  const fieldGap = Math.max(2, wPx * 0.012);
  const borderPad = Math.max(2, pad * 0.4);

  const fontBase: Record<string, number> = {
    title: Math.max(7, unit * 0.048),
    body: Math.max(6, unit * 0.036),
    footer: Math.max(5, unit * 0.028),
  };
  const fontScales: Record<string, number> = { xs: 0.7, sm: 0.85, md: 1, lg: 1.25, xl: 1.6, auto: 1 };

  const getFs = (f: any, role: string) => {
    const base = fontBase[role] || fontBase.body;
    return base * (fontScales[f.fontSize] || 1);
  };

  const activeCodeType = codeType ?? 'barcode';
  const hasCode = !!(barcodeField && row[barcodeField] && activeCodeType !== 'none');
  const currentCodeSize = activeCodeType === 'qr' ? (qrSize ?? 100) : (barcodeSize ?? 100);

  // Barcode section position
  const barcodeSection = useMemo(() => {
    if (!hasCode) return null;
    let lastActiveRole = '';
    for (let i = 0; i < Math.min(barcodeOrder, config.length); i++) {
      if (config[i].role !== 'hidden') lastActiveRole = config[i].role;
    }
    if (!lastActiveRole) return 'before-title';
    if (lastActiveRole === 'title') return 'after-title';
    if (lastActiveRole === 'body') return 'after-body';
    return 'after-footer';
  }, [hasCode, barcodeOrder, config]);

  // Render barcode
  useEffect(() => {
    if (barcodeRef.current && hasCode && activeCodeType === 'barcode') {
      try {
        const scale = (barcodeSize ?? 100) / 100;
        JsBarcode(barcodeRef.current, String(row[barcodeField]), {
          format: 'CODE128',
          width: Math.max(1, wPx * 0.004 * scale),
          height: Math.max(10, hPx * 0.09 * scale),
          displayValue: false,
          margin: 0,
        });
      } catch (e) {
        console.error('Barcode error:', e);
      }
    }
  }, [row, barcodeField, hasCode, hPx, wPx, barcodeSize, activeCodeType]);

  // Render QR code
  useEffect(() => {
    if (qrRef.current && hasCode && activeCodeType === 'qr') {
      const scale = (qrSize ?? 100) / 100;
      const qrCanvasSize = Math.max(30, Math.min(wPx, hPx) * 0.25 * scale);
      QRCode.toCanvas(qrRef.current, String(row[barcodeField]), {
        width: qrCanvasSize,
        margin: 0,
        color: { dark: '#000000', light: '#ffffff' },
      }).catch(e => console.error('QR error:', e));
    }
  }, [row, barcodeField, hasCode, hPx, wPx, qrSize, activeCodeType]);

  if (!data.length) return null;

  // Collect fields that should render inline with the barcode/QR (sameRow right after barcode)
  const codeRowFields = useMemo(() => {
    if (!hasCode) return [];
    const fields: typeof activeFields = [];
    for (let i = barcodeOrder; i < config.length; i++) {
      if (config[i].sameRow && config[i].role !== 'hidden') {
        fields.push(config[i]);
      } else {
        break;
      }
    }
    return fields;
  }, [hasCode, barcodeOrder, config, activeFields]);

  const codeRowColumns = useMemo(() => new Set(codeRowFields.map(f => f.column)), [codeRowFields]);

  const titles = activeFields.filter(f => f.role === 'title' && !codeRowColumns.has(f.column));
  const bodies = activeFields.filter(f => f.role === 'body' && !codeRowColumns.has(f.column));
  const footers = activeFields.filter(f => f.role === 'footer' && !codeRowColumns.has(f.column));

  const groupRows = (fields: any[]) => {
    const rows: any[][] = [];
    fields.forEach(f => {
      if (f.sameRow && rows.length > 0) {
        rows[rows.length - 1].push(f);
      } else {
        rows.push([f]);
      }
    });
    return rows;
  };

  const renderFieldContent = (f: any, role: string) => {
    const val = row[f.column] || '';
    const formatted = (f.prefix || '') + (f.uppercase ? String(val).toUpperCase() : val) + (f.suffix || '');
    return (
      <>
        {f.showLabel && <span style={{ fontWeight: 700, color: '#000' }}>{f.column}: </span>}
        {formatted}
      </>
    );
  };

  const renderField = (f: any, role: string, isSameRow = false) => {
    const val = row[f.column] || '';
    if (!val && !f.border) return null;
    const fontSize = getFs(f, role);
    const formatted = (f.prefix || '') + (f.uppercase ? String(val).toUpperCase() : val) + (f.suffix || '');

    return (
      <div
        key={f.column}
        style={{
          fontSize: `${fontSize}px`,
          fontWeight: f.bold ? '700' : (role === 'title' ? '600' : '400'),
          textAlign: f.align,
          lineHeight: 1.3,
          wordBreak: 'break-word',
          width: isSameRow ? undefined : '100%',
          flex: isSameRow ? 1 : undefined,
          border: f.border ? '1px solid #ccc' : 'none',
          padding: f.border ? `${borderPad * 0.6}px ${borderPad}px` : '0',
        }}
        className="text-[#111]"
      >
        {f.showLabel && <span className="font-bold text-[#000]">{f.column}: </span>}
        {formatted}
      </div>
    );
  };

  const renderSection = (fields: any[], role: string) => {
    const grouped = groupRows(fields);
    return grouped.map((gr, i) => (
      <div
        key={i}
        style={{
          display: 'flex',
          gap: `${fieldGap}px`,
          marginBottom: i < grouped.length - 1 ? `${rowGap}px` : 0,
        }}
      >
        {gr.map(f => renderField(f, role, gr.length > 1))}
      </div>
    ));
  };

  /** Render body section with bordered grid groups */
  const renderBodySection = () => {
    const grouped = groupRows(bodies);

    // Split into segments: bordered-grid vs normal
    type Segment = { type: 'bordered'; rows: any[][] } | { type: 'normal'; rows: any[][] };
    const segments: Segment[] = [];

    grouped.forEach(grpRow => {
      const allBordered = grpRow.every(f => f.border);
      const last = segments[segments.length - 1];
      if (allBordered) {
        const shouldBreak = grpRow[0]?.blockStart;
        if (last?.type === 'bordered' && !shouldBreak) last.rows.push(grpRow);
        else segments.push({ type: 'bordered', rows: [grpRow] });
      } else {
        if (last?.type === 'normal') last.rows.push(grpRow);
        else segments.push({ type: 'normal', rows: [grpRow] });
      }
    });

    return segments.map((seg, si) => {
      if (seg.type === 'bordered') {
        // Check if any field in the segment has openBorder
        const isOpen = seg.rows.some(r => r.some((f: any) => f.openBorder));
        // Render as table-like bordered grid
        return (
          <div
            key={si}
            style={{
              borderTop: '1.5px solid #222',
              borderBottom: '1.5px solid #222',
              borderLeft: isOpen ? 'none' : '1.5px solid #222',
              borderRight: isOpen ? 'none' : '1.5px solid #222',
              marginBottom: `${sectionGap}px`,
              overflow: 'hidden',
            }}
          >
            {seg.rows.map((grpRow, ri) => {
              const nextRowMerges = ri < seg.rows.length - 1 && seg.rows[ri + 1][0]?.mergeUp;
              return (
              <div
                key={ri}
                style={{
                  display: 'flex',
                  borderBottom: (ri < seg.rows.length - 1 && !nextRowMerges) ? '1px solid #333' : 'none',
                }}
              >
                {grpRow.map((f: any, fi: number) => {
                  const fontSize = getFs(f, 'body');
                  const val = row[f.column] || '';
                  const formatted = (f.prefix || '') + (f.uppercase ? String(val).toUpperCase() : val) + (f.suffix || '');
                  return (
                    <div
                      key={f.column}
                      style={{
                        flex: 1,
                        padding: `${Math.max(3, borderPad)}px`,
                        borderRight: (fi < grpRow.length - 1 && !grpRow[fi + 1]?.mergeRight) ? '1px solid #333' : 'none',
                        fontSize: `${fontSize}px`,
                        fontWeight: f.bold ? '700' : '400',
                        textAlign: f.align,
                        lineHeight: 1.35,
                        wordBreak: 'break-word',
                        color: '#111',
                      }}
                    >
                      {f.showLabel && <span style={{ fontWeight: 700 }}>{f.column}: </span>}
                      {formatted}
                    </div>
                  );
                })}
              </div>
            );
            })}
          </div>
        );
      }

      // Normal rows
      return seg.rows.map((grpRow, ri) => (
        <div
          key={`${si}-${ri}`}
          style={{
            display: 'flex',
            gap: `${fieldGap}px`,
            marginBottom: `${rowGap}px`,
          }}
        >
          {grpRow.map(f => renderField(f, 'body', grpRow.length > 1))}
        </div>
      ));
    });
  };

  const alignMap = { left: 'flex-start', center: 'center', right: 'flex-end' };
  const codeElement = hasCode ? (
    <div
      style={{
        margin: `${sectionGap * 0.5}px 0`,
        display: 'flex',
        justifyContent: codeRowFields.length > 0 ? 'flex-start' : alignMap[codeAlign ?? 'center'],
        alignItems: 'center',
        gap: `${fieldGap}px`,
      }}
    >
      {codeRowFields.map(f => renderField(f, f.role, true))}
      {activeCodeType === 'barcode' ? (
        <canvas
          key="barcode-canvas"
          ref={barcodeRef}
          style={{ maxWidth: `${Math.min(95, 85 * (currentCodeSize / 100))}%`, flexShrink: 0 }}
        />
      ) : (
        <canvas key="qr-canvas" ref={qrRef} style={{ flexShrink: 0 }} />
      )}
    </div>
  ) : null;

  const hasFooters = footers.length > 0;
  const hasBanner = !!bannerText;

  return (
    <div className="flex flex-col items-center gap-4 py-8">
      <div
        style={{
          width: `${wPx}px`,
          height: `${hPx}px`,
          padding: `${pad}px`,
          backgroundColor: '#ffffff',
        }}
        className="label-content shadow-2xl rounded-sm flex flex-col overflow-hidden border-2"
      >
        {/* Top Rule — thick black line */}
        {topRule && (
          <div
            style={{
              height: Math.max(2, hPx * 0.006),
              backgroundColor: '#000',
              margin: `0 0 ${sectionGap}px 0`,
              borderRadius: 1,
            }}
          />
        )}

        {/* Logo */}
        {logo ? (
          <div
            style={{
              marginBottom: `${sectionGap}px`,
              justifyContent: logoPosition === 'center' ? 'center' : logoPosition === 'right' ? 'flex-end' : 'flex-start',
            }}
            className="flex items-center"
          >
            <img
              src={logo}
              style={{ maxWidth: `${30 * ((logoSize ?? 100) / 100)}%`, maxHeight: hPx * 0.13 * ((logoSize ?? 100) / 100) }}
              className="object-contain"
              alt="Logo"
            />
          </div>
        ) : !topRule ? (
          <div
            style={{
              marginBottom: `${sectionGap}px`,
              justifyContent: logoPosition === 'center' ? 'center' : logoPosition === 'right' ? 'flex-end' : 'flex-start',
            }}
            className="flex items-center"
          >
            <div
              style={{
                width: Math.max(20, wPx * 0.18),
                height: Math.max(12, hPx * 0.065),
                fontSize: `${Math.max(5, unit * 0.017)}px`,
                borderColor: '#e2e8f0',
                backgroundColor: '#f8fafc',
                color: '#94a3b8',
              }}
              className="rounded border-dashed border flex items-center justify-center font-bold"
            >
              LOGO
            </div>
          </div>
        ) : null}

        {/* Barcode: before-title */}
        {barcodeSection === 'before-title' && codeElement}

        {/* Titles */}
        {titles.length > 0 && (
          <div style={{ marginBottom: `${sectionGap}px` }}>
            {renderSection(titles, 'title')}
          </div>
        )}

        {/* Barcode: after-title (default) */}
        {barcodeSection === 'after-title' && codeElement}

        {/* Body — takes remaining vertical space */}
        <div style={{ flex: 1 }}>
          {renderBodySection()}
        </div>

        {/* Barcode: after-body */}
        {barcodeSection === 'after-body' && codeElement}

        {/* Footers — pinned to bottom */}
        {hasFooters && (
          <div
            style={{
              marginTop: 'auto',
              paddingTop: `${sectionGap}px`,
              borderTop: '1px solid #ddd',
            }}
          >
            {renderSection(footers, 'footer')}
          </div>
        )}

        {/* Barcode: after-footer */}
        {barcodeSection === 'after-footer' && codeElement}

        {/* Banner — full-bleed bottom bar */}
        {hasBanner && (
          <div
            style={{
              margin: `${sectionGap}px -${pad}px -${pad}px`,
              padding: `${Math.max(3, hPx * 0.015)}px ${pad}px`,
              fontSize: `${Math.max(5, unit * 0.024)}px`,
              backgroundColor: '#000',
              color: '#ffffff',
            }}
            className="text-center font-bold uppercase tracking-wider"
          >
            {bannerText}
          </div>
        )}
      </div>
    </div>
  );
}
