'use client';

import { useState } from 'react';
import { useStore } from '@/lib/store';
import { Copy, X, Check, Layers, Type, Palette } from 'lucide-react';

/**
 * After you customise a label, a dismissible bar slides up offering to copy those
 * changes to other labels — only on explicit click. Nothing is applied automatically.
 */
export default function ApplyBar() {
  const { data, previewIdx, editingLabelIdx, labelOverrides, dataOverrides, applyLabelToTargets } = useStore();
  const idx = editingLabelIdx ?? previewIdx;

  const [dismissedHash, setDismissedHash] = useState<string | null>(null);
  const [panelOpen, setPanelOpen] = useState(false);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [copyStyling, setCopyStyling] = useState(true);
  const [copyText, setCopyText] = useState(true);
  const [flash, setFlash] = useState<number | null>(null);

  // A hash of this label's customisations — changes whenever you edit it, so the bar reappears.
  const hash = JSON.stringify(labelOverrides[idx] ?? null) + '|' + JSON.stringify(dataOverrides[idx] ?? null);
  const hasCustomization = !!(labelOverrides[idx] || dataOverrides[idx]);
  const showBar = data.length > 1 && hasCustomization && hash !== dismissedHash && !panelOpen;

  const openPanel = (preselectAll: boolean) => {
    const sel = new Set<number>();
    if (preselectAll) for (let i = 0; i < data.length; i++) if (i !== idx) sel.add(i);
    setSelected(sel);
    setPanelOpen(true);
  };

  const doApply = () => {
    if (selected.size === 0 || (!copyStyling && !copyText)) return;
    applyLabelToTargets(idx, [...selected], { styling: copyStyling, text: copyText });
    setFlash(selected.size);
    setTimeout(() => setFlash((f) => (f === selected.size ? null : f)), 2600);
    setDismissedHash(hash);
    setPanelOpen(false);
  };

  if (!data.length) return null;

  return (
    <>
      {/* Bottom bar */}
      {showBar && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[90] w-[min(680px,calc(100vw-2rem))]">
          <div className="rounded-2xl bg-white border border-gray-200 shadow-2xl overflow-hidden">
            <div className="h-1 bg-gradient-to-r from-dk-orange to-dk-blue" />
            <div className="p-3 sm:p-4 flex items-center gap-3 flex-wrap">
              <div className="w-9 h-9 rounded-xl bg-dk-blue-light flex items-center justify-center text-dk-blue shrink-0">
                <Copy size={17} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold text-gray-800 leading-tight">You edited Label #{idx + 1}</p>
                <p className="text-[11px] text-gray-500">Apply these changes to other labels?</p>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <button
                  onClick={() => setDismissedHash(hash)}
                  className="px-3 py-2 rounded-xl border border-gray-200 text-xs font-bold text-gray-600 hover:bg-gray-50 transition-colors"
                >
                  This label only
                </button>
                <button
                  onClick={() => openPanel(true)}
                  className="px-3 py-2 rounded-xl bg-dk-blue-light text-dk-blue text-xs font-bold border border-dk-blue/20 hover:bg-dk-blue hover:text-white transition-colors"
                >
                  All labels
                </button>
                <button
                  onClick={() => openPanel(false)}
                  className="px-3 py-2 rounded-xl bg-dk-blue text-white text-xs font-bold shadow-lg shadow-dk-blue/20 hover:bg-dk-blue-hover transition-colors active:scale-95"
                >
                  Choose labels…
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Selection + scope panel */}
      {panelOpen && (
        <div
          className="modal-backdrop fixed inset-0 z-[100] bg-black/40 flex items-center justify-center p-4"
          onClick={(e) => { if (e.target === e.currentTarget) setPanelOpen(false); }}
        >
          <div className="modal-content bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
            <div className="h-1 bg-gradient-to-r from-dk-orange to-dk-blue" />
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-dk-blue-light flex items-center justify-center text-dk-blue">
                    <Copy size={18} />
                  </div>
                  <div>
                    <h2 className="text-base font-bold text-gray-800">Apply Label #{idx + 1} to others</h2>
                    <p className="text-xs text-gray-400">Pick what to copy and which labels</p>
                  </div>
                </div>
                <button onClick={() => setPanelOpen(false)} className="p-2 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors">
                  <X size={18} />
                </button>
              </div>

              {/* Scope */}
              <div className="mb-4">
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">What to copy</p>
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => setCopyStyling((v) => !v)}
                    className={`flex items-center gap-1.5 px-3 py-2 rounded-xl border text-xs font-bold transition-colors ${
                      copyStyling ? 'bg-dk-blue-light border-dk-blue/30 text-dk-blue' : 'bg-gray-50 border-gray-200 text-gray-400'
                    }`}
                  >
                    <Palette size={13} /> Styling & layout
                  </button>
                  <button
                    onClick={() => setCopyText((v) => !v)}
                    className={`flex items-center gap-1.5 px-3 py-2 rounded-xl border text-xs font-bold transition-colors ${
                      copyText ? 'bg-amber-50 border-amber-300 text-amber-700' : 'bg-gray-50 border-gray-200 text-gray-400'
                    }`}
                  >
                    <Type size={13} /> Text content
                  </button>
                </div>
                {copyText && (
                  <p className="text-[10px] text-amber-700 mt-1.5">⚠ Text content will overwrite the chosen labels’ existing text.</p>
                )}
              </div>

              {/* Quick select */}
              <div className="flex items-center gap-2 mb-3">
                <button
                  onClick={() => { const all = new Set<number>(); for (let i = 0; i < data.length; i++) if (i !== idx) all.add(i); setSelected(all); }}
                  className="px-3 py-1.5 rounded-lg bg-dk-blue-light text-dk-blue text-[10px] font-bold hover:bg-dk-blue hover:text-white transition-colors border border-dk-blue/20"
                >
                  Select all
                </button>
                <button
                  onClick={() => setSelected(new Set())}
                  className="px-3 py-1.5 rounded-lg bg-gray-50 text-gray-500 text-[10px] font-bold hover:bg-gray-100 transition-colors border border-gray-200"
                >
                  Clear
                </button>
                <div className="flex items-center gap-1 ml-auto">
                  <input type="number" min={1} max={data.length} placeholder="From" id="apply-from" className="w-16 px-2 py-1.5 text-[10px] border border-gray-200 rounded-lg text-center" />
                  <span className="text-gray-400 text-[10px]">to</span>
                  <input type="number" min={1} max={data.length} placeholder="To" id="apply-to" className="w-16 px-2 py-1.5 text-[10px] border border-gray-200 rounded-lg text-center" />
                  <button
                    onClick={() => {
                      const from = parseInt((document.getElementById('apply-from') as HTMLInputElement).value) - 1;
                      const to = parseInt((document.getElementById('apply-to') as HTMLInputElement).value) - 1;
                      if (!isNaN(from) && !isNaN(to) && from >= 0 && to < data.length) {
                        const upd = new Set(selected);
                        for (let i = Math.min(from, to); i <= Math.max(from, to); i++) if (i !== idx) upd.add(i);
                        setSelected(upd);
                      }
                    }}
                    className="px-2 py-1.5 rounded-lg bg-dk-blue text-white text-[10px] font-bold hover:bg-dk-blue-hover transition-colors"
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
                      disabled={i === idx}
                      onClick={() => setSelected((prev) => { const upd = new Set(prev); if (upd.has(i)) upd.delete(i); else upd.add(i); return upd; })}
                      className={`px-1 py-1.5 rounded text-[10px] font-bold transition-colors ${
                        i === idx ? 'bg-amber-100 text-amber-400 cursor-not-allowed'
                          : selected.has(i) ? 'bg-dk-blue text-white' : 'bg-gray-50 text-gray-500 hover:bg-gray-100'
                      }`}
                    >
                      {i + 1}
                    </button>
                  ))}
                </div>
              </div>

              {selected.size > 0 && (
                <p className="text-xs text-dk-blue font-semibold mb-4">{selected.size} label{selected.size !== 1 ? 's' : ''} selected</p>
              )}

              <div className="flex gap-3">
                <button onClick={() => setPanelOpen(false)} className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm font-semibold text-gray-600 hover:bg-gray-50 transition-colors">
                  Cancel
                </button>
                <button
                  onClick={doApply}
                  disabled={selected.size === 0 || (!copyStyling && !copyText)}
                  className={`flex-1 py-2.5 rounded-xl text-sm font-bold transition-all flex items-center justify-center gap-2 ${
                    selected.size > 0 && (copyStyling || copyText)
                      ? 'bg-dk-blue text-white hover:bg-dk-blue-hover shadow-lg shadow-dk-blue/20 active:scale-95'
                      : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                  }`}
                >
                  <Check size={16} /> Apply to {selected.size} label{selected.size !== 1 ? 's' : ''}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Success toast */}
      {flash !== null && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[110] px-4 py-2.5 rounded-xl bg-green-600 text-white text-sm font-bold shadow-2xl flex items-center gap-2">
          <Layers size={15} /> Applied to {flash} label{flash !== 1 ? 's' : ''}
        </div>
      )}
    </>
  );
}
