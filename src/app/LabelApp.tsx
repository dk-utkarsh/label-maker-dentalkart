'use client';

import { useState, useRef, useEffect } from 'react';
import { useStore } from '@/lib/store';
import UploadSection from '@/components/UploadSection';
import ConfigSidebar from '@/components/ConfigSidebar';
import LabelPreview from '@/components/LabelPreview';
import LayoutSelector from '@/components/LayoutSelector';
import { Download, ChevronLeft, ChevronRight, Save, Trash2, RotateCcw, Eye, Layers, X, CheckCircle, Loader2, FileSpreadsheet, Palette, Printer, Pencil, Globe, Undo2, Copy, Check, ImageDown, AlertTriangle } from 'lucide-react';
import { HeroSection } from '@/components/ui/hero-section';

export default function Home() {
  const { data, previewIdx, setPreviewIdx, width, height, config, savedVariations, saveVariation, loadVariation, deleteVariation, fetchSavedVariations, editingLabelIdx, setEditingLabelIdx, labelOverrides, clearLabelOverride, setLabelOverride, getEffectiveConfig } = useStore();
  const [isGenerating, setIsGenerating] = useState(false);
  const [pdfProgress, setPdfProgress] = useState(0);
  const [generationLabel, setGenerationLabel] = useState<'PDF' | 'ZIP'>('PDF');
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [variationName, setVariationName] = useState('');
  const [showApplyModal, setShowApplyModal] = useState(false);
  const [selectedLabels, setSelectedLabels] = useState<Set<number>>(new Set());
  const nameInputRef = useRef<HTMLInputElement>(null);
  const uploadRef = useRef<HTMLDivElement>(null);
  const isGeneratingRef = useRef(false);
  const wakeLockRef = useRef<WakeLockSentinel | null>(null);

  // Mirror state into ref so beforeunload (which fires outside React's render cycle) can read it.
  useEffect(() => { isGeneratingRef.current = isGenerating; }, [isGenerating]);

  // Warn the user before they close / reload / navigate away while a generation is in progress.
  // This is the strongest client-side protection available — the browser shows a confirmation
  // and won't kill the JS context until the user explicitly confirms leaving.
  useEffect(() => {
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (!isGeneratingRef.current) return;
      e.preventDefault();
      e.returnValue = 'Labels are still being generated. Leaving now will cancel the export.';
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, []);

  /** Request a screen wake lock so the browser doesn't suspend the tab during long exports. */
  const acquireWakeLock = async () => {
    try {
      const wl = await (navigator as Navigator & { wakeLock?: { request: (t: string) => Promise<WakeLockSentinel> } })
        .wakeLock?.request('screen');
      if (wl) wakeLockRef.current = wl;
    } catch {
      // Wake Lock API unsupported or denied — non-fatal.
    }
  };
  const releaseWakeLock = async () => {
    try { await wakeLockRef.current?.release(); } catch { /* ignore */ }
    wakeLockRef.current = null;
  };

  /** Notify user when generation finishes, useful if they switched tabs. */
  const notifyDone = (kind: 'PDF' | 'ZIP', count: number) => {
    if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return;
    try {
      new Notification('Labels ready', {
        body: `${count} label${count !== 1 ? 's' : ''} exported as ${kind}.`,
        icon: '/favicon.ico',
      });
    } catch { /* ignore */ }
  };

  /** Best-effort request for notification permission before a long generation starts. */
  const requestNotificationPermissionOnce = () => {
    if (typeof Notification === 'undefined') return;
    if (Notification.permission === 'default') {
      Notification.requestPermission().catch(() => {});
    }
  };

  useEffect(() => {
    fetchSavedVariations();
  }, [fetchSavedVariations]);

  useEffect(() => {
    if (showSaveModal && nameInputRef.current) {
      nameInputRef.current.focus();
    }
  }, [showSaveModal]);

  const handleSaveVariation = () => {
    if (!variationName.trim()) return;
    saveVariation(variationName.trim());
    setVariationName('');
    setShowSaveModal(false);
  };

  /** Inject pHYs chunk into PNG to set DPI metadata */
  const setPngDpi = (pngBuffer: ArrayBuffer, dpi: number): Blob => {
    const ppm = Math.round(dpi / 0.0254); // pixels per meter
    // pHYs chunk: 4-byte x-ppm, 4-byte y-ppm, 1-byte unit (1 = meter)
    const phys = new Uint8Array(9);
    const view = new DataView(phys.buffer);
    view.setUint32(0, ppm);
    view.setUint32(4, ppm);
    phys[8] = 1; // unit = meter

    // Build chunk: length(4) + type(4) + data(9) + crc(4)
    const chunkType = new Uint8Array([0x70, 0x48, 0x59, 0x73]); // "pHYs"
    const chunkLen = new Uint8Array(4);
    new DataView(chunkLen.buffer).setUint32(0, 9);

    // CRC32 over type + data
    const crcData = new Uint8Array(4 + 9);
    crcData.set(chunkType, 0);
    crcData.set(phys, 4);
    const crc = crc32(crcData);
    const crcBytes = new Uint8Array(4);
    new DataView(crcBytes.buffer).setUint32(0, crc);

    const src = new Uint8Array(pngBuffer);
    // Insert after IHDR chunk (PNG signature=8 bytes, IHDR chunk=25 bytes → offset 33)
    const insertAt = 33;
    const chunk = new Uint8Array(4 + 4 + 9 + 4);
    chunk.set(chunkLen, 0);
    chunk.set(chunkType, 4);
    chunk.set(phys, 8);
    chunk.set(crcBytes, 17);

    const result = new Uint8Array(src.length + chunk.length);
    result.set(src.subarray(0, insertAt), 0);
    result.set(chunk, insertAt);
    result.set(src.subarray(insertAt), insertAt + chunk.length);
    return new Blob([result], { type: 'image/png' });
  };

  /** CRC32 for PNG chunks */
  const crc32 = (buf: Uint8Array): number => {
    let c = 0xffffffff;
    for (let i = 0; i < buf.length; i++) {
      c ^= buf[i];
      for (let j = 0; j < 8; j++) {
        c = (c >>> 1) ^ (c & 1 ? 0xedb88320 : 0);
      }
    }
    return (c ^ 0xffffffff) >>> 0;
  };

  /** Build inlined @font-face CSS so html-to-image embeds Google Fonts in canvas */
  const buildFontEmbedCSS = async (): Promise<string | undefined> => {
    try {
      // Collect unique font families actually used in the current config
      const usedFonts = new Set<string>();
      config.forEach(f => { if (f.fontFamily) usedFonts.add(f.fontFamily); });
      if (usedFonts.size === 0) return undefined;

      // Find all @font-face rules from loaded stylesheets
      const fontFaces: string[] = [];
      for (const sheet of Array.from(document.styleSheets)) {
        try {
          for (const rule of Array.from(sheet.cssRules)) {
            if (rule instanceof CSSFontFaceRule) {
              const family = rule.style.getPropertyValue('font-family').replace(/['"]/g, '');
              if (usedFonts.has(family)) {
                // Fetch the font file and convert to base64 data URI
                const srcMatch = rule.cssText.match(/url\(["']?(https?:\/\/[^"')]+)["']?\)/);
                if (srcMatch) {
                  try {
                    const resp = await fetch(srcMatch[1]);
                    const buf = await resp.arrayBuffer();
                    const b64 = btoa(String.fromCharCode(...new Uint8Array(buf)));
                    const mime = srcMatch[1].includes('.woff2') ? 'font/woff2' : 'font/woff';
                    const inlined = rule.cssText.replace(srcMatch[0], `url(data:${mime};base64,${b64})`);
                    fontFaces.push(inlined);
                  } catch {
                    fontFaces.push(rule.cssText);
                  }
                } else {
                  fontFaces.push(rule.cssText);
                }
              }
            }
          }
        } catch {
          // Cross-origin stylesheet — skip
        }
      }
      return fontFaces.length > 0 ? fontFaces.join('\n') : undefined;
    } catch {
      return undefined;
    }
  };

  /** Wait for React to flush state and the browser to paint before capture. */
  const waitForPaint = () =>
    new Promise<void>(resolve => {
      requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
    });

  const generatePDF = async () => {
    if (!data.length) return;
    requestNotificationPermissionOnce();
    setGenerationLabel('PDF');
    setIsGenerating(true);
    isGeneratingRef.current = true;
    setPdfProgress(0);
    await acquireWakeLock();
    let currentLabel = 0;

    // Auto-scale capture quality with label count to stay under V8's 512 MB string cap.
    //   ≤150: high quality (pixelRatio 2, q 0.92)
    //   151-300: mid quality (pixelRatio 1.75, q 0.88)
    //   301+: compact (pixelRatio 1.5, q 0.85)
    const count = data.length;
    const pixelRatio = count > 300 ? 1.5 : count > 150 ? 1.75 : 2;
    const jpegQuality = count > 300 ? 0.85 : count > 150 ? 0.88 : 0.92;

    try {
      const jsPDF = (await import('jspdf')).default;
      const { toCanvas } = await import('html-to-image');

      const doc = new jsPDF({
        orientation: width > height ? 'landscape' : 'portrait',
        unit: 'mm',
        format: [width, height],
        compress: true,
      });

      const previewEl = document.querySelector('.label-preview-container') as HTMLElement;
      if (!previewEl) throw new Error('Preview container not found in DOM');

      // Exit per-label edit mode before generating
      setEditingLabelIdx(null);

      // Pre-build font embed CSS and wait for fonts to load
      await document.fonts.ready;
      const fontEmbedCSS = await buildFontEmbedCSS();

      for (let i = 0; i < count; i++) {
        currentLabel = i + 1;
        setPreviewIdx(i);
        setPdfProgress(Math.round(((i + 1) / count) * 100));

        // Two RAFs guarantee React has committed and the browser has painted.
        await waitForPaint();
        await waitForPaint();

        const target = previewEl.querySelector('.label-content') as HTMLElement;
        if (!target) throw new Error(`Label #${currentLabel}: .label-content not found after re-render`);

        const sanitize = (node: HTMLElement) => {
          const walker = document.createTreeWalker(node, NodeFilter.SHOW_ELEMENT);
          let n: Node | null = walker.currentNode;
          while (n) {
            const el = n as HTMLElement;
            const style = window.getComputedStyle(el);
            if (style.backgroundColor.includes('oklch') || style.backgroundColor.includes('lab')) {
              el.style.backgroundColor = '#ffffff';
            }
            if (style.color.includes('oklch') || style.color.includes('lab')) {
              el.style.color = '#000000';
            }
            if (style.borderColor.includes('oklch') || style.borderColor.includes('lab')) {
              el.style.borderColor = '#cccccc';
            }
            n = walker.nextNode();
          }
        };
        sanitize(target);

        let imgData: string;
        try {
          const canvas = await toCanvas(target, {
            pixelRatio,
            backgroundColor: '#ffffff',
            fontEmbedCSS,
          });
          imgData = canvas.toDataURL('image/jpeg', jpegQuality);
          // canvas goes out of scope at end of try-block → GC-eligible
        } catch (e) {
          throw new Error(`Label #${currentLabel} render failed: ${e instanceof Error ? e.message : String(e)}`);
        }

        doc.addImage(imgData, 'JPEG', 0, 0, width, height, undefined, 'FAST');

        if (i < count - 1) {
          doc.addPage([width, height]);
        }

        // Every 25 labels yield to the event loop so V8 can run GC and free
        // the previous canvases / data URLs before the next batch piles on.
        if ((i + 1) % 25 === 0 && i + 1 < count) {
          await new Promise(r => setTimeout(r, 0));
        }
      }

      doc.save('labels.pdf');
      notifyDone('PDF', count);
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      console.error('PDF Generation failed:', error);
      const hint = msg.includes('Invalid string length') || msg.toLowerCase().includes('memory')
        ? '\n\nTip: For very large batches use "Download ZIP" — it writes each label as a separate PNG and avoids browser memory limits.'
        : '';
      alert(`Failed to generate PDF at label #${currentLabel} of ${count}.\n\n${msg}${hint}\n\nOpen the browser console (F12) for the full stack trace and share it.`);
    } finally {
      isGeneratingRef.current = false;
      setIsGenerating(false);
      setPdfProgress(0);
      setPreviewIdx(0);
      await releaseWakeLock();
    }
  };

  const generateZIP = async () => {
    if (!data.length) return;
    requestNotificationPermissionOnce();
    setGenerationLabel('ZIP');
    setIsGenerating(true);
    isGeneratingRef.current = true;
    setPdfProgress(0);
    await acquireWakeLock();
    let currentLabel = 0;
    const count = data.length;

    try {
      const JSZip = (await import('jszip')).default;
      const { toCanvas } = await import('html-to-image');
      const zip = new JSZip();

      const previewEl = document.querySelector('.label-preview-container') as HTMLElement;
      if (!previewEl) throw new Error('Preview container not found in DOM');

      setEditingLabelIdx(null);

      // Pre-build font embed CSS and wait for fonts to load
      await document.fonts.ready;
      const fontEmbedCSS = await buildFontEmbedCSS();

      for (let i = 0; i < count; i++) {
        currentLabel = i + 1;
        setPreviewIdx(i);
        setPdfProgress(Math.round(((i + 1) / count) * 100));

        await waitForPaint();
        await waitForPaint();

        const target = previewEl.querySelector('.label-content') as HTMLElement;
        if (!target) throw new Error(`Label #${currentLabel}: .label-content not found after re-render`);

        const sanitize = (node: HTMLElement) => {
          const walker = document.createTreeWalker(node, NodeFilter.SHOW_ELEMENT);
          let n: Node | null = walker.currentNode;
          while (n) {
            const el = n as HTMLElement;
            const style = window.getComputedStyle(el);
            if (style.backgroundColor.includes('oklch') || style.backgroundColor.includes('lab')) {
              el.style.backgroundColor = '#ffffff';
            }
            if (style.color.includes('oklch') || style.color.includes('lab')) {
              el.style.color = '#000000';
            }
            if (style.borderColor.includes('oklch') || style.borderColor.includes('lab')) {
              el.style.borderColor = '#cccccc';
            }
            n = walker.nextNode();
          }
        };
        sanitize(target);

        // Calculate pixelRatio for 500 DPI output; downscale slightly for huge batches
        // so the per-canvas memory doesn't pile up faster than GC can reclaim it.
        const scale = Math.min(550 / width, 750 / height);
        const baseDpi = count > 300 ? 350 : count > 150 ? 425 : 500;
        const dpiRatio = Math.max(2, Math.ceil(baseDpi / (25.4 * scale)));

        let pngBuf: ArrayBuffer;
        try {
          const canvas = await toCanvas(target, {
            pixelRatio: dpiRatio,
            backgroundColor: '#ffffff',
            fontEmbedCSS,
          });
          pngBuf = await new Promise<ArrayBuffer>((resolve, reject) => {
            canvas.toBlob(b => {
              if (!b) return reject(new Error('canvas.toBlob returned null'));
              b.arrayBuffer().then(resolve, reject);
            }, 'image/png');
          });
        } catch (e) {
          throw new Error(`Label #${currentLabel} render failed: ${e instanceof Error ? e.message : String(e)}`);
        }

        const dpiBlob = setPngDpi(pngBuf, baseDpi);
        zip.file(`label-${String(i + 1).padStart(3, '0')}.png`, dpiBlob);

        // Yield every 25 labels so GC can free canvas + PNG buffers from earlier iterations.
        if ((i + 1) % 25 === 0 && i + 1 < count) {
          await new Promise(r => setTimeout(r, 0));
        }
      }

      const zipBlob = await zip.generateAsync({ type: 'blob' });
      const url = URL.createObjectURL(zipBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'labels.zip';
      a.click();
      URL.revokeObjectURL(url);
      notifyDone('ZIP', count);
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      console.error('ZIP Generation failed:', error);
      alert(`Failed to generate ZIP at label #${currentLabel} of ${count}.\n\n${msg}\n\nOpen the browser console (F12) for the full stack trace and share it.`);
    } finally {
      isGeneratingRef.current = false;
      setIsGenerating(false);
      setPdfProgress(0);
      setPreviewIdx(0);
      await releaseWakeLock();
    }
  };

  return (
    <div className="min-h-screen bg-[var(--background)]">
      {/* Generation Lock Banner — fixed at top, blocks user from forgetting and closing the tab */}
      {isGenerating && (
        <div className="fixed top-0 left-0 right-0 z-[200] bg-amber-50 border-b-2 border-amber-400 shadow-lg">
          <div className="max-w-[1800px] mx-auto px-6 py-3 flex items-center gap-4">
            <div className="shrink-0 w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center text-amber-700">
              <Loader2 size={20} className="animate-spin" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 mb-1">
                <p className="text-sm font-bold text-amber-900">
                  Generating {generationLabel} — {pdfProgress}% &middot; label {Math.max(1, Math.round((pdfProgress / 100) * data.length))} of {data.length}
                </p>
                <span className="hidden sm:inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-widest text-amber-700 bg-amber-100 px-2 py-0.5 rounded-md border border-amber-300">
                  <AlertTriangle size={10} />
                  Keep this tab open
                </span>
              </div>
              <div className="h-2 bg-amber-200 rounded-full overflow-hidden">
                <div className="h-full bg-gradient-to-r from-amber-400 to-amber-600 transition-all duration-300" style={{ width: `${pdfProgress}%` }} />
              </div>
              <p className="text-[11px] text-amber-700 mt-1">
                You can switch to other tabs — the export will keep running. Closing or refreshing this tab will cancel it.
              </p>
            </div>
          </div>
        </div>
      )}
      {/* Push everything down while the banner is visible so it doesn't cover the header */}
      {isGenerating && <div aria-hidden style={{ height: 82 }} />}

      {/* Header */}
      <header className={`sticky z-50 bg-white shadow-sm ${isGenerating ? 'top-[82px]' : 'top-0'}`}>
        {/* Orange-blue accent line */}
        <div className="h-1 bg-gradient-to-r from-dk-orange via-dk-blue to-dk-orange" />
        <div className="max-w-[1800px] mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-dk-orange to-dk-blue flex items-center justify-center shadow-md">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
              </svg>
            </div>
            <div>
              <h1 className="text-lg font-bold tracking-tight">
                <span className="text-dk-blue">Dentalkart</span>{' '}
                <span className="text-dk-orange">Label Maker</span>
              </h1>
              <p className="text-[10px] text-gray-400 font-semibold uppercase tracking-widest leading-none">High-Precision Generator</p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            {data.length > 0 && (
              <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-green-100 text-green-500">
                <CheckCircle size={14} />
                <span className="text-xs font-bold">
                  {data.length} label{data.length !== 1 ? 's' : ''} ready
                </span>
              </div>
            )}
            <button
              onClick={generateZIP}
              disabled={!data.length || isGenerating}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold shadow-lg transition-all active:scale-95 ${
                !data.length || isGenerating
                  ? 'bg-gray-200 text-gray-400 cursor-not-allowed shadow-none'
                  : 'bg-dk-blue text-white shadow-dk-blue/25 hover:shadow-dk-blue/40'
              }`}
            >
              {isGenerating ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <ImageDown size={16} />
              )}
              {isGenerating ? `Generating ${pdfProgress}%` : 'Download ZIP'}
            </button>
            <button
              onClick={generatePDF}
              disabled={!data.length || isGenerating}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold shadow-lg transition-all active:scale-95 ${
                !data.length || isGenerating
                  ? 'bg-gray-200 text-gray-400 cursor-not-allowed shadow-none'
                  : 'bg-gradient-to-r from-dk-orange to-dk-orange-hover text-white shadow-dk-orange/25 hover:shadow-dk-orange/40'
              }`}
            >
              {isGenerating ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <Download size={16} />
              )}
              {isGenerating ? `Generating ${pdfProgress}%` : 'Download PDF'}
            </button>
          </div>
        </div>
        {/* Progress bar during PDF generation */}
        {isGenerating && (
          <div className="h-0.5 bg-gray-100">
            <div
              className="h-full bg-gradient-to-r from-dk-orange to-dk-blue transition-all duration-300"
              style={{ width: `${pdfProgress}%` }}
            />
          </div>
        )}
      </header>

      {/* Hero Section — shown when no data */}
      {!data.length && (
        <HeroSection
          title="Dentalkart Label Maker"
          subtitle={{
            regular: "Create professional labels with ",
            gradient: "precision and speed.",
          }}
          description="Upload your Excel data, choose from 8 layout presets, customize every field, and export high-fidelity PDF labels — all in millimeter-perfect accuracy."
          ctaText="Start Creating Labels"
          onCtaClick={() => uploadRef.current?.scrollIntoView({ behavior: 'smooth' })}
          gridOptions={{
            angle: 65,
            opacity: 0.3,
            cellSize: 50,
            lightLineColor: "#2B7CB8",
            darkLineColor: "#2B7CB8",
          }}
        />
      )}

      {/* Features strip — shown when no data */}
      {!data.length && (
        <div className="max-w-[1800px] mx-auto px-6 -mt-8 mb-8 relative z-10">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[
              { icon: FileSpreadsheet, color: 'text-dk-blue', bg: 'bg-dk-blue-light', title: 'Upload Excel Data', desc: 'Import .xlsx or .xls files with product data — columns are auto-detected' },
              { icon: Palette, color: 'text-dk-orange', bg: 'bg-dk-orange-light', title: '8 Layout Presets', desc: 'Standard, Pharmacy, Shipping, Shelf Tag, Compliance, Warehouse and more' },
              { icon: Printer, color: 'text-green-500', bg: 'bg-green-100', title: 'Export to PDF', desc: 'Generate print-ready labels with barcodes, logos, and precision sizing' },
            ].map(f => (
              <div key={f.title} className="p-5 rounded-2xl bg-white border border-gray-200 shadow-sm flex items-start gap-4 hover:shadow-md transition-shadow">
                <div className={`w-11 h-11 rounded-xl ${f.bg} flex items-center justify-center shrink-0`}>
                  <f.icon size={20} className={f.color} />
                </div>
                <div>
                  <p className="text-sm font-bold text-gray-800">{f.title}</p>
                  <p className="text-xs text-gray-400 mt-1 leading-relaxed">{f.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <main className="max-w-[1800px] mx-auto p-6">
        <div ref={uploadRef} className="grid grid-cols-1 xl:grid-cols-[1fr_360px] gap-6">

          {/* Main Workspace */}
          <div className="space-y-6">
            <UploadSection />

            {data.length > 0 && (
              <div className="space-y-6">
                <LayoutSelector />
                <div className="grid grid-cols-1 lg:grid-cols-[380px_1fr] gap-6">
                  <ConfigSidebar />

                  <div className="space-y-6">
                    {/* Preview Card */}
                    <div className="sticky top-20 p-6 rounded-2xl bg-white border border-gray-200 shadow-sm flex flex-col items-center max-h-[calc(100vh-6rem)] overflow-y-auto">
                      <div className="w-full flex items-center justify-between mb-6">
                        <div className="flex items-center gap-2">
                          <div className="flex items-center gap-2 text-dk-blue text-xs font-bold uppercase tracking-widest">
                            <Eye size={14} />
                            <span>Live Preview</span>
                          </div>
                          {editingLabelIdx !== null && (
                            <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 text-[10px] font-bold">
                              Editing Label #{editingLabelIdx + 1}
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-3">
                          <button
                            onClick={() => setPreviewIdx(Math.max(0, previewIdx - 1))}
                            className="p-2 rounded-lg bg-gray-50 border border-gray-200 text-gray-500 hover:text-gray-700 hover:border-gray-300 disabled:opacity-30 transition-colors"
                            disabled={previewIdx === 0}
                          >
                            <ChevronLeft size={16} />
                          </button>
                          <span className="text-xs font-mono font-bold text-gray-500 min-w-[60px] text-center">
                            {previewIdx + 1} / {data.length}
                          </span>
                          <button
                            onClick={() => setPreviewIdx(Math.min(data.length - 1, previewIdx + 1))}
                            className="p-2 rounded-lg bg-gray-50 border border-gray-200 text-gray-500 hover:text-gray-700 hover:border-gray-300 disabled:opacity-30 transition-colors"
                            disabled={previewIdx === data.length - 1}
                          >
                            <ChevronRight size={16} />
                          </button>
                        </div>
                      </div>

                      <div className="label-preview-container bg-gray-50 rounded-xl p-8 border border-gray-200 w-full flex items-center justify-center"
                        style={{ backgroundImage: 'radial-gradient(circle, #e5e7eb 1px, transparent 1px)', backgroundSize: '16px 16px' }}
                      >
                        <div className="label-preview-inner">
                          <LabelPreview />
                        </div>
                      </div>

                      {/* Per-label edit controls */}
                      <div className="mt-6 flex flex-wrap items-center gap-2">
                        {editingLabelIdx === null ? (
                          <button
                            onClick={() => setEditingLabelIdx(previewIdx)}
                            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-amber-50 text-amber-700 text-xs font-bold hover:bg-amber-100 transition-all active:scale-95 border border-amber-200"
                          >
                            <Pencil size={14} />
                            Customize Label #{previewIdx + 1}
                          </button>
                        ) : (
                          <>
                            <button
                              onClick={() => setEditingLabelIdx(null)}
                              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-dk-blue-light text-dk-blue text-xs font-bold hover:bg-dk-blue hover:text-white transition-all active:scale-95 border border-dk-blue/20"
                            >
                              <Globe size={14} />
                              Back to Global
                            </button>
                            {labelOverrides[editingLabelIdx] && (
                              <>
                                <button
                                  onClick={() => {
                                    setSelectedLabels(new Set());
                                    setShowApplyModal(true);
                                  }}
                                  className="flex items-center gap-2 px-4 py-2 rounded-xl bg-violet-50 text-violet-700 text-xs font-bold hover:bg-violet-100 transition-all active:scale-95 border border-violet-200"
                                >
                                  <Copy size={14} />
                                  Apply to Other Labels
                                </button>
                                <button
                                  onClick={() => {
                                    clearLabelOverride(editingLabelIdx);
                                    setEditingLabelIdx(null);
                                  }}
                                  className="flex items-center gap-2 px-4 py-2 rounded-xl bg-red-50 text-red-600 text-xs font-bold hover:bg-red-100 transition-all active:scale-95 border border-red-200"
                                >
                                  <Undo2 size={14} />
                                  Reset to Global
                                </button>
                              </>
                            )}
                          </>
                        )}

                        <button
                          onClick={() => {
                            setVariationName('');
                            setShowSaveModal(true);
                          }}
                          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-dk-blue-light text-dk-blue text-xs font-bold hover:bg-dk-blue hover:text-white transition-all active:scale-95 border border-dk-blue/20 hover:border-dk-blue"
                        >
                          <Save size={14} />
                          Save variation
                        </button>
                      </div>

                      {/* Show which labels have overrides */}
                      {Object.keys(labelOverrides).length > 0 && (
                        <div className="mt-3 px-3 py-2 rounded-lg bg-amber-50 border border-amber-200">
                          <p className="text-[10px] font-bold text-amber-700 uppercase tracking-widest mb-1">Customized Labels</p>
                          <div className="flex flex-wrap gap-1">
                            {Object.keys(labelOverrides).map(k => {
                              const i = Number(k);
                              return (
                                <button
                                  key={i}
                                  onClick={() => { setPreviewIdx(i); setEditingLabelIdx(i); }}
                                  className={`px-2 py-0.5 rounded text-[10px] font-bold transition-colors ${
                                    editingLabelIdx === i
                                      ? 'bg-amber-500 text-white'
                                      : 'bg-amber-100 text-amber-700 hover:bg-amber-200'
                                  }`}
                                >
                                  #{i + 1}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Right Sidebar */}
          <div className={`space-y-6 ${data.length > 0 ? 'hidden xl:block' : 'hidden'}`}>
            {/* Info Card */}
            <div className="p-6 rounded-2xl bg-gradient-to-br from-dk-orange-light to-dk-blue-light border border-dk-orange/15 shadow-sm">
              <h3 className="text-sm font-bold text-dk-blue uppercase tracking-widest mb-4">Precision Control</h3>
              <p className="text-xs text-gray-600 leading-relaxed mb-5">
                All dimensions in <span className="text-gray-900 font-bold">millimeters (mm)</span> for industrial-grade accuracy.
                Layouts are preserved at 100% fidelity during PDF export.
              </p>
              <div className="space-y-2.5">
                {[
                  { color: 'bg-green-500', text: '100% PDF Match Guarantee' },
                  { color: 'bg-dk-blue', text: 'Real-time State Refresh' },
                  { color: 'bg-dk-orange', text: '8 Layout Presets Available' },
                ].map(item => (
                  <div key={item.text} className="p-3 rounded-lg bg-white/80 border border-white flex items-center gap-3 shadow-sm">
                    <div className={`w-2 h-2 rounded-full ${item.color}`} />
                    <span className="text-[10px] font-bold text-gray-600 uppercase">{item.text}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Saved Layouts */}
            <div className="p-6 rounded-2xl bg-white border border-gray-200 shadow-sm">
              <div className="flex items-center gap-2 mb-4">
                <Layers size={16} className="text-dk-orange" />
                <h3 className="text-sm font-bold text-gray-700 uppercase tracking-widest">Saved Layouts</h3>
                {savedVariations.length > 0 && (
                  <span className="ml-auto text-[10px] font-bold text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">
                    {savedVariations.length}
                  </span>
                )}
              </div>
              <div className="space-y-2">
                {savedVariations.length === 0 ? (
                  <div className="p-6 rounded-xl border-2 border-dashed border-gray-200 flex flex-col gap-2 items-center justify-center text-gray-400">
                    <Save size={20} className="text-gray-300" />
                    <p className="text-[10px] font-bold uppercase tracking-widest">No layouts saved yet</p>
                    <p className="text-[10px] text-gray-300 text-center">Save a variation to quickly switch between designs</p>
                  </div>
                ) : (
                  savedVariations.map(v => (
                    <div
                      key={v.id}
                      className="p-3 rounded-xl border border-gray-200 bg-gray-50 hover:border-dk-blue/40 hover:bg-dk-blue-light/30 transition-all group"
                    >
                      <div className="flex items-center justify-between">
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-bold text-gray-700 truncate">{v.name}</p>
                          <p className="text-[10px] text-gray-400 mt-0.5">
                            {v.width}&times;{v.height}mm &middot; {v.config.filter(f => f.role !== 'hidden').length} fields
                          </p>
                        </div>
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={() => loadVariation(v.id)}
                            className="p-1.5 rounded-lg text-dk-blue hover:bg-dk-blue-light transition-colors"
                            title="Load this layout"
                          >
                            <RotateCcw size={12} />
                          </button>
                          <button
                            onClick={() => deleteVariation(v.id)}
                            className="p-1.5 rounded-lg text-red-500 hover:bg-red-100 transition-colors"
                            title="Delete this layout"
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

        </div>
      </main>

      {/* Save Variation Modal */}
      {showSaveModal && (
        <div
          className="modal-backdrop fixed inset-0 z-[100] bg-black/40 flex items-center justify-center p-4"
          onClick={(e) => { if (e.target === e.currentTarget) setShowSaveModal(false); }}
        >
          <div className="modal-content bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
            {/* Modal header accent */}
            <div className="h-1 bg-gradient-to-r from-dk-orange to-dk-blue" />
            <div className="p-6">
              <div className="flex items-center justify-between mb-5">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-dk-blue-light flex items-center justify-center">
                    <Save size={18} className="text-dk-blue" />
                  </div>
                  <div>
                    <h2 className="text-base font-bold text-gray-800">Save Variation</h2>
                    <p className="text-xs text-gray-400">Give your layout a memorable name</p>
                  </div>
                </div>
                <button
                  onClick={() => setShowSaveModal(false)}
                  className="p-2 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="space-y-2 mb-6">
                <label className="text-xs font-bold text-gray-500 uppercase tracking-widest">Layout Name</label>
                <input
                  ref={nameInputRef}
                  type="text"
                  value={variationName}
                  onChange={(e) => setVariationName(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') handleSaveVariation(); }}
                  placeholder="e.g. Standard 62x100, Shelf Tag Small..."
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl py-3 px-4 text-gray-800 text-sm focus:outline-none focus:ring-2 focus:ring-dk-blue/30 focus:border-dk-blue transition-all placeholder:text-gray-300"
                />
              </div>

              {/* Current config summary */}
              <div className="p-3 rounded-xl bg-gray-50 border border-gray-200 mb-6">
                <div className="flex items-center gap-4 text-xs text-gray-500">
                  <span><span className="font-bold text-gray-700">{width}&times;{height}</span> mm</span>
                  <span className="text-gray-300">|</span>
                  <span><span className="font-bold text-gray-700">{config.filter(f => f.role !== 'hidden').length}</span> fields</span>
                  <span className="text-gray-300">|</span>
                  <span><span className="font-bold text-gray-700">{data.length}</span> labels</span>
                </div>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => setShowSaveModal(false)}
                  className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm font-semibold text-gray-600 hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveVariation}
                  disabled={!variationName.trim()}
                  className={`flex-1 py-2.5 rounded-xl text-sm font-bold transition-all ${
                    variationName.trim()
                      ? 'bg-dk-blue text-white hover:bg-dk-blue-hover shadow-lg shadow-dk-blue/20 active:scale-95'
                      : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                  }`}
                >
                  Save Layout
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Apply to Other Labels Modal */}
      {showApplyModal && editingLabelIdx !== null && labelOverrides[editingLabelIdx] && (
        <div
          className="modal-backdrop fixed inset-0 z-[100] bg-black/40 flex items-center justify-center p-4"
          onClick={(e) => { if (e.target === e.currentTarget) setShowApplyModal(false); }}
        >
          <div className="modal-content bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
            <div className="h-1 bg-gradient-to-r from-violet-500 to-dk-blue" />
            <div className="p-6">
              <div className="flex items-center justify-between mb-5">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-violet-100 flex items-center justify-center">
                    <Copy size={18} className="text-violet-600" />
                  </div>
                  <div>
                    <h2 className="text-base font-bold text-gray-800">Apply to Labels</h2>
                    <p className="text-xs text-gray-400">Copy Label #{editingLabelIdx + 1} settings to other labels</p>
                  </div>
                </div>
                <button
                  onClick={() => setShowApplyModal(false)}
                  className="p-2 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Quick select */}
              <div className="flex gap-2 mb-3">
                <button
                  onClick={() => {
                    const all = new Set<number>();
                    for (let i = 0; i < data.length; i++) {
                      if (i !== editingLabelIdx) all.add(i);
                    }
                    setSelectedLabels(all);
                  }}
                  className="px-3 py-1.5 rounded-lg bg-violet-50 text-violet-700 text-[10px] font-bold hover:bg-violet-100 transition-colors border border-violet-200"
                >
                  Select All
                </button>
                <button
                  onClick={() => setSelectedLabels(new Set())}
                  className="px-3 py-1.5 rounded-lg bg-gray-50 text-gray-500 text-[10px] font-bold hover:bg-gray-100 transition-colors border border-gray-200"
                >
                  Clear
                </button>
                {/* Range input */}
                <div className="flex items-center gap-1 ml-auto">
                  <input
                    type="number"
                    min={1}
                    max={data.length}
                    placeholder="From"
                    className="w-16 px-2 py-1.5 text-[10px] border border-gray-200 rounded-lg text-center"
                    id="range-from"
                  />
                  <span className="text-gray-400 text-[10px]">to</span>
                  <input
                    type="number"
                    min={1}
                    max={data.length}
                    placeholder="To"
                    className="w-16 px-2 py-1.5 text-[10px] border border-gray-200 rounded-lg text-center"
                    id="range-to"
                  />
                  <button
                    onClick={() => {
                      const from = parseInt((document.getElementById('range-from') as HTMLInputElement).value) - 1;
                      const to = parseInt((document.getElementById('range-to') as HTMLInputElement).value) - 1;
                      if (!isNaN(from) && !isNaN(to) && from >= 0 && to < data.length) {
                        const updated = new Set(selectedLabels);
                        for (let i = Math.min(from, to); i <= Math.max(from, to); i++) {
                          if (i !== editingLabelIdx) updated.add(i);
                        }
                        setSelectedLabels(updated);
                      }
                    }}
                    className="px-2 py-1.5 rounded-lg bg-violet-500 text-white text-[10px] font-bold hover:bg-violet-600 transition-colors"
                  >
                    Add
                  </button>
                </div>
              </div>

              {/* Label grid */}
              <div className="max-h-48 overflow-y-auto rounded-xl border border-gray-200 p-2 mb-4">
                <div className="grid grid-cols-8 gap-1">
                  {Array.from({ length: data.length }, (_, i) => (
                    <button
                      key={i}
                      disabled={i === editingLabelIdx}
                      onClick={() => {
                        const updated = new Set(selectedLabels);
                        if (updated.has(i)) updated.delete(i);
                        else updated.add(i);
                        setSelectedLabels(updated);
                      }}
                      className={`px-1 py-1.5 rounded text-[10px] font-bold transition-colors ${
                        i === editingLabelIdx
                          ? 'bg-amber-100 text-amber-400 cursor-not-allowed'
                          : selectedLabels.has(i)
                          ? 'bg-violet-500 text-white'
                          : 'bg-gray-50 text-gray-500 hover:bg-gray-100'
                      }`}
                    >
                      {i + 1}
                    </button>
                  ))}
                </div>
              </div>

              {selectedLabels.size > 0 && (
                <p className="text-xs text-violet-600 font-semibold mb-4">
                  {selectedLabels.size} label{selectedLabels.size !== 1 ? 's' : ''} selected
                </p>
              )}

              <div className="flex gap-3">
                <button
                  onClick={() => setShowApplyModal(false)}
                  className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm font-semibold text-gray-600 hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    const override = labelOverrides[editingLabelIdx];
                    if (override) {
                      selectedLabels.forEach(i => {
                        setLabelOverride(i, structuredClone(override));
                      });
                    }
                    setShowApplyModal(false);
                  }}
                  disabled={selectedLabels.size === 0}
                  className={`flex-1 py-2.5 rounded-xl text-sm font-bold transition-all flex items-center justify-center gap-2 ${
                    selectedLabels.size > 0
                      ? 'bg-violet-600 text-white hover:bg-violet-700 shadow-lg shadow-violet-200 active:scale-95'
                      : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                  }`}
                >
                  <Check size={16} />
                  Apply to {selectedLabels.size} Label{selectedLabels.size !== 1 ? 's' : ''}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
