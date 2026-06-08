'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useStore } from '@/lib/store';
import LabelPreview from './LabelPreview';
import FieldControls from './FieldControls';
import CodeControls from './CodeControls';
import LogoControls from './LogoControls';
import { X, Globe, Pencil, GripVertical, Image as ImageIcon, Barcode, Megaphone } from 'lucide-react';

interface Rect { top: number; left: number; width: number; height: number; }
interface PopoverPos { left: number; top: number; maxHeight: number; }
type ElKind = 'logo' | 'code' | 'banner';
type DropMode = 'before' | 'after' | 'row-after';

const POPOVER_WIDTH = 300;

function rectEq(a: Rect | null, b: Rect | null) {
  if (a === b) return true;
  if (!a || !b) return false;
  return Math.abs(a.top - b.top) < 0.5 && Math.abs(a.left - b.left) < 0.5
    && Math.abs(a.width - b.width) < 0.5 && Math.abs(a.height - b.height) < 0.5;
}

// Selection keys: "f:<column>" for data fields, "e:logo|code|banner" for special elements.
const fieldKey = (col: string) => `f:${col}`;
const elKey = (el: ElKind) => `e:${el}`;
const parseKey = (key: string): { kind: 'field'; column: string } | { kind: 'el'; el: ElKind } =>
  key.startsWith('f:') ? { kind: 'field', column: key.slice(2) } : { kind: 'el', el: key.slice(2) as ElKind };

/**
 * Wraps the read-only LabelPreview with an interactive editing layer:
 *  - click any field / logo / barcode / banner -> selection outline + a popover of its controls
 *  - double-click a field or the banner        -> edit its text directly on the label
 *  - drag a field's grip                        -> move it up/down across sections or side-by-side
 *  - drag the logo's grip                       -> move it to the top or bottom of the label
 * All editing chrome lives OUTSIDE the captured `.label-content` element and is cleared whenever
 * the previewed label changes, so exports stay clean.
 */
export default function EditablePreview() {
  const store = useStore();
  const { previewIdx, editingLabelIdx, data } = store;

  const wrapRef = useRef<HTMLDivElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [editingTextKey, setEditingTextKey] = useState<string | null>(null);
  const [selRect, setSelRect] = useState<Rect | null>(null);
  const [popoverPos, setPopoverPos] = useState<PopoverPos | null>(null);
  const [dropLine, setDropLine] = useState<{ top: number; left: number; width: number; vertical?: boolean; height?: number } | null>(null);

  const draggingRef = useRef(false);
  const dragKeyRef = useRef<string | null>(null);
  const dropTargetRef = useRef<{ col: string; mode: DropMode } | null>(null);
  const logoDropRef = useRef<'top' | 'bottom' | null>(null);
  const justDraggedRef = useRef(false); // suppress the click that fires right after a drag

  const idx = editingLabelIdx ?? previewIdx;

  // Reset selection when the previewed/edited label changes (covers export stepping previewIdx).
  const idxKey = `${previewIdx}:${editingLabelIdx}`;
  const [seenIdxKey, setSeenIdxKey] = useState(idxKey);
  if (idxKey !== seenIdxKey) {
    setSeenIdxKey(idxKey);
    setSelectedKey(null);
    setEditingTextKey(null);
  }

  const findEl = (key: string): HTMLElement | null => {
    const wrap = wrapRef.current;
    if (!wrap) return null;
    const p = parseKey(key);
    return p.kind === 'field'
      ? wrap.querySelector(`[data-field-column="${CSS.escape(p.column)}"]`)
      : wrap.querySelector(`[data-element="${p.el}"]`);
  };

  // Measure the selected element and reposition outline + popover.
  const measure = useCallback(() => {
    const wrap = wrapRef.current;
    if (!wrap || !selectedKey) {
      setSelRect(prev => (prev === null ? prev : null));
      setPopoverPos(prev => (prev === null ? prev : null));
      return;
    }
    const el = findEl(selectedKey);
    if (!el) { setSelRect(prev => (prev === null ? prev : null)); return; }
    const wr = wrap.getBoundingClientRect();
    const er = el.getBoundingClientRect();
    const next: Rect = { top: er.top - wr.top, left: er.left - wr.left, width: er.width, height: er.height };
    setSelRect(prev => (rectEq(prev, next) ? prev : next));

    const gap = 10;
    let left = er.right + gap;
    if (left + POPOVER_WIDTH > window.innerWidth - 8) left = er.left - POPOVER_WIDTH - gap;
    if (left < 8) left = Math.max(8, window.innerWidth - POPOVER_WIDTH - 8);
    const top = Math.min(Math.max(8, er.top), Math.max(8, window.innerHeight - 360));
    const maxHeight = window.innerHeight - top - 16;
    setPopoverPos(prev => (prev && Math.abs(prev.left - left) < 0.5 && Math.abs(prev.top - top) < 0.5 && Math.abs(prev.maxHeight - maxHeight) < 0.5 ? prev : { left, top, maxHeight }));
  }, [selectedKey]);

  // Keep outline + popover glued to the selection as the label re-lays-out / scrolls / resizes.
  useEffect(() => {
    if (!selectedKey) return;
    const wrap = wrapRef.current;
    if (!wrap) return;
    const handler = () => measure();
    const ro = new ResizeObserver(handler);
    ro.observe(wrap);
    const mo = new MutationObserver(handler);
    mo.observe(wrap, { subtree: true, childList: true, attributes: true, characterData: true });
    window.addEventListener('scroll', handler, true);
    window.addEventListener('resize', handler);
    return () => {
      ro.disconnect();
      mo.disconnect();
      window.removeEventListener('scroll', handler, true);
      window.removeEventListener('resize', handler);
    };
  }, [selectedKey, measure]);

  // Focus the inline text editor when it opens.
  useEffect(() => {
    if (editingTextKey && textareaRef.current) {
      const ta = textareaRef.current;
      ta.focus();
      ta.setSelectionRange(ta.value.length, ta.value.length);
    }
  }, [editingTextKey]);

  // Close on outside click / Escape.
  useEffect(() => {
    if (!selectedKey) return;
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (draggingRef.current) return;
      if (popoverRef.current?.contains(t)) return;
      if (textareaRef.current?.contains(t)) return;
      if ((t as HTMLElement)?.closest?.('[data-drag-handle]')) return;
      if ((t as HTMLElement)?.closest?.('[data-field-column]')) return;
      if ((t as HTMLElement)?.closest?.('[data-element]')) return;
      setSelectedKey(null);
      setEditingTextKey(null);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (editingTextKey) setEditingTextKey(null);
        else setSelectedKey(null);
      }
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [selectedKey, editingTextKey]);

  // Resolve the selection key for a clicked DOM node (field takes priority over container element).
  const keyAt = (target: EventTarget | null): string | null => {
    const t = target as HTMLElement;
    const fieldEl = t?.closest?.('[data-field-column]') as HTMLElement | null;
    if (fieldEl) return fieldKey(fieldEl.dataset.fieldColumn || '');
    const elEl = t?.closest?.('[data-element]') as HTMLElement | null;
    if (elEl) return elKey(elEl.dataset.element as ElKind);
    return null;
  };

  const handleClick = (e: React.MouseEvent) => {
    if (justDraggedRef.current) { justDraggedRef.current = false; return; } // this "click" was the end of a drag
    const key = keyAt(e.target);
    if (key) {
      setSelectedKey(key);
      if (editingTextKey && editingTextKey !== key) setEditingTextKey(null);
    } else {
      setSelectedKey(null);
      setEditingTextKey(null);
    }
  };

  const handleDoubleClick = (e: React.MouseEvent) => {
    const key = keyAt(e.target);
    if (!key) return;
    const p = parseKey(key);
    setSelectedKey(key);
    if (p.kind === 'field' || (p.kind === 'el' && p.el === 'banner')) {
      setEditingTextKey(key);
    }
  };

  // ----- Inline text editor binding (fields + banner) -----
  const bannerTextEffective = editingLabelIdx !== null ? store.getEffectiveConfig(idx).bannerText : store.bannerText;
  const editingValue = (() => {
    if (!editingTextKey) return '';
    const p = parseKey(editingTextKey);
    return p.kind === 'field' ? store.getValue(idx, p.column) : bannerTextEffective;
  })();
  const commitEditingValue = (val: string) => {
    if (!editingTextKey) return;
    const p = parseKey(editingTextKey);
    if (p.kind === 'field') store.setDataOverride(idx, p.column, val);
    else store.setBannerText(val);
  };

  // ----- Drag-to-reorder (fields) + drag logo top/bottom -----
  const dispConfigNow = () => {
    const st = useStore.getState();
    const i = st.editingLabelIdx ?? st.previewIdx;
    return st.editingLabelIdx !== null ? st.getEffectiveConfig(i).config : st.config;
  };

  // Attach the document-level move/up handlers that actually perform the drag for `key`.
  const attachDrag = (key: string, initialEv?: PointerEvent) => {
    const parsed = parseKey(key);
    const isLogo = parsed.kind === 'el' && parsed.el === 'logo';
    const dragCol = parsed.kind === 'field' ? parsed.column : null;
    if (!isLogo && !dragCol) return;
    dragKeyRef.current = key;
    dropTargetRef.current = null;
    logoDropRef.current = null;
    draggingRef.current = true;
    const prevUserSelect = document.body.style.userSelect;
    document.body.style.userSelect = 'none';

    const onMove = (ev: PointerEvent) => {
      justDraggedRef.current = true;
      const wrap = wrapRef.current;
      if (!wrap) return;
      const wr = wrap.getBoundingClientRect();

      if (isLogo) {
        // Logo: decide top vs bottom by pointer position relative to label mid-line.
        const content = wrap.querySelector('.label-content') as HTMLElement | null;
        if (!content) return;
        const cr = content.getBoundingClientRect();
        const toTop = ev.clientY < cr.top + cr.height / 2;
        logoDropRef.current = toTop ? 'top' : 'bottom';
        setDropLine({
          top: (toTop ? cr.top + 3 : cr.bottom - 3) - wr.top,
          left: cr.left - wr.left,
          width: cr.width,
        });
        return;
      }

      // Field: find the nearest field element across all roles; decide before/after/row-after.
      const els = Array.from(wrap.querySelectorAll('.label-content [data-field-column]')) as HTMLElement[];
      const cands = els.filter(el => el.dataset.fieldColumn !== dragCol);
      if (!cands.length) return;
      let target = cands[0];
      let best = Infinity;
      for (const el of cands) {
        const r = el.getBoundingClientRect();
        const cy = r.top + r.height / 2;
        const d = Math.abs(ev.clientY - cy);
        if (d < best) { best = d; target = el; }
      }
      const tr = target.getBoundingClientRect();
      const inBand = ev.clientY >= tr.top - 2 && ev.clientY <= tr.bottom + 2;
      const rightZone = ev.clientX > tr.left + tr.width * 0.55;
      let mode: DropMode;
      if (inBand && rightZone) {
        mode = 'row-after';
        setDropLine({ top: tr.top - wr.top, left: tr.right - wr.left, width: 0, vertical: true, height: tr.height });
      } else {
        const after = ev.clientY > tr.top + tr.height / 2;
        mode = after ? 'after' : 'before';
        setDropLine({ top: (after ? tr.bottom : tr.top) - wr.top, left: tr.left - wr.left, width: tr.width });
      }
      dropTargetRef.current = { col: target.dataset.fieldColumn || '', mode };
    };

    const onUp = () => {
      document.removeEventListener('pointermove', onMove);
      try {
        if (isLogo) {
          if (logoDropRef.current) useStore.getState().setLogoPlacement(logoDropRef.current);
        } else if (dragCol) {
          const tgt = dropTargetRef.current;
          if (tgt && tgt.col && tgt.col !== dragCol) {
            const disp = dispConfigNow();
            const dragged = disp.find(f => f.column === dragCol);
            const target = disp.find(f => f.column === tgt.col);
            if (dragged && target) {
              const newField = { ...dragged, role: target.role, sameRow: tgt.mode === 'row-after' };
              const without = disp.filter(f => f.column !== dragCol);
              let at = without.findIndex(f => f.column === tgt.col);
              if (at >= 0) {
                if (tgt.mode === 'after' || tgt.mode === 'row-after') at += 1;
                const newConfig = [...without.slice(0, at), newField, ...without.slice(at)];
                useStore.getState().setConfig(newConfig);
              }
            }
          }
        }
      } finally {
        draggingRef.current = false;
        dragKeyRef.current = null;
        dropTargetRef.current = null;
        logoDropRef.current = null;
        setDropLine(null);
        document.body.style.userSelect = prevUserSelect;
        // clear the click-suppression flag after the trailing click has had a chance to fire
        setTimeout(() => { justDraggedRef.current = false; }, 0);
      }
    };

    document.addEventListener('pointermove', onMove);
    document.addEventListener('pointerup', onUp, { once: true });
    if (initialEv) onMove(initialEv);
  };

  // Press-and-drag directly on a field or the logo (a 5px movement threshold keeps
  // plain clicks and double-clicks working). The grip handle calls attachDrag directly.
  const onWrapPointerDown = (e: React.PointerEvent) => {
    if (e.button !== 0) return;
    const t = e.target as HTMLElement;
    if (t?.closest?.('[data-drag-handle]')) return;
    if (popoverRef.current?.contains(t)) return;
    if (t?.tagName === 'TEXTAREA') return;
    const key = keyAt(e.target);
    if (!key) return;
    const p = parseKey(key);
    const draggable = p.kind === 'field' || (p.kind === 'el' && p.el === 'logo');
    if (!draggable) return;
    const sx = e.clientX, sy = e.clientY;
    const move = (ev: PointerEvent) => {
      if (Math.hypot(ev.clientX - sx, ev.clientY - sy) < 5) return;
      document.removeEventListener('pointermove', move);
      document.removeEventListener('pointerup', up);
      setSelectedKey(key);
      attachDrag(key, ev);
    };
    const up = () => {
      document.removeEventListener('pointermove', move);
      document.removeEventListener('pointerup', up);
    };
    document.addEventListener('pointermove', move);
    document.addEventListener('pointerup', up);
  };

  const selParsed = selectedKey ? parseKey(selectedKey) : null;
  const canDrag = selParsed && (selParsed.kind === 'field' || (selParsed.kind === 'el' && selParsed.el === 'logo'));

  // Popover header label + body per selection kind.
  const headerFor = () => {
    if (!selParsed) return { icon: <Pencil size={11} />, title: '', dot: 'bg-dk-blue' };
    if (selParsed.kind === 'field') return { icon: null, title: selParsed.column, dot: 'bg-dk-blue' };
    if (selParsed.el === 'logo') return { icon: <ImageIcon size={13} className="text-dk-orange" />, title: 'Logo', dot: 'bg-dk-orange' };
    if (selParsed.el === 'code') return { icon: <Barcode size={13} className="text-violet-500" />, title: 'Barcode / QR', dot: 'bg-violet-500' };
    return { icon: <Megaphone size={13} className="text-gray-700" />, title: 'Banner', dot: 'bg-gray-700' };
  };
  const header = headerFor();
  const isGlobalOnly = selParsed?.kind === 'el' && selParsed.el === 'logo';

  return (
    <div ref={wrapRef} className="relative" onClick={handleClick} onDoubleClick={handleDoubleClick} onPointerDown={onWrapPointerDown}>
      <LabelPreview />

      {/* Selection outline (sibling of .label-content — never captured) */}
      {selectedKey && selRect && !editingTextKey && (
        <div
          className="pointer-events-none absolute z-10 rounded-[2px]"
          style={{
            top: selRect.top - 2,
            left: selRect.left - 2,
            width: selRect.width + 4,
            height: selRect.height + 4,
            outline: '2px solid #2B7CB8',
            outlineOffset: 0,
            boxShadow: '0 0 0 4px rgba(43,124,184,0.12)',
          }}
        >
          {canDrag && (
            <div
              className="pointer-events-auto absolute -left-3 top-1/2 -translate-y-1/2 flex items-center justify-center w-5 h-6 rounded bg-dk-blue text-white shadow cursor-grab active:cursor-grabbing touch-none"
              title={selParsed?.kind === 'el' ? 'Drag to move top / bottom' : 'Drag to move'}
              data-drag-handle
              onPointerDown={(e) => { e.preventDefault(); e.stopPropagation(); if (selectedKey) attachDrag(selectedKey, e.nativeEvent); }}
            >
              <GripVertical size={12} />
            </div>
          )}
        </div>
      )}

      {/* Drop-line indicator while dragging */}
      {dropLine && (
        dropLine.vertical ? (
          <div
            className="pointer-events-none absolute z-20 w-0.5 bg-dk-orange rounded-full"
            style={{ top: dropLine.top, left: dropLine.left - 1, height: dropLine.height }}
          />
        ) : (
          <div
            className="pointer-events-none absolute z-20 h-0.5 bg-dk-orange rounded-full"
            style={{ top: dropLine.top - 1, left: dropLine.left, width: dropLine.width }}
          >
            <span className="absolute -left-1 -top-1 w-2 h-2 rounded-full bg-dk-orange" />
          </div>
        )
      )}

      {/* Inline text editor (double-click a field or the banner) */}
      {editingTextKey && selRect && (
        <textarea
          ref={textareaRef}
          value={editingValue}
          onChange={(e) => commitEditingValue(e.target.value)}
          onBlur={() => setEditingTextKey(null)}
          onClick={(e) => e.stopPropagation()}
          onDoubleClick={(e) => e.stopPropagation()}
          spellCheck={false}
          className="absolute z-30 resize-none rounded-[2px] bg-white text-[#111] outline outline-2 outline-dk-blue shadow-lg leading-tight"
          style={{
            top: selRect.top - 2,
            left: selRect.left - 2,
            width: Math.max(selRect.width + 4, 80),
            minHeight: selRect.height + 4,
            padding: '1px 2px',
            fontSize: 12,
            fontFamily: 'monospace',
          }}
        />
      )}

      {/* Popover (portaled to body so the scroll container can't clip it) */}
      {selectedKey && selParsed && popoverPos && typeof document !== 'undefined' && createPortal(
        <div
          ref={popoverRef}
          className="fixed z-[120] rounded-2xl bg-white border border-gray-200 shadow-2xl flex flex-col"
          style={{ left: popoverPos.left, top: popoverPos.top, width: POPOVER_WIDTH, maxHeight: popoverPos.maxHeight }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-100">
            {header.icon
              ? <span className="shrink-0">{header.icon}</span>
              : <span className={`w-2 h-2 rounded-full shrink-0 ${header.dot}`} />}
            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold text-gray-800 truncate leading-tight">{header.title}</p>
              <span className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-widest text-gray-400">
                {isGlobalOnly
                  ? <><Globe size={9} className="text-dk-blue" /> Global</>
                  : editingLabelIdx !== null
                    ? <><Pencil size={9} className="text-amber-500" /> Editing label #{idx + 1}</>
                    : <><Globe size={9} className="text-dk-blue" /> All labels</>}
              </span>
            </div>
            <button
              onClick={() => { setSelectedKey(null); setEditingTextKey(null); }}
              className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors shrink-0"
              title="Close (Esc)"
            >
              <X size={16} />
            </button>
          </div>

          {/* Body */}
          <div className="p-4 overflow-y-auto">
            {selParsed.kind === 'field' && <FieldControls column={selParsed.column} />}
            {selParsed.kind === 'el' && selParsed.el === 'logo' && <LogoControls />}
            {selParsed.kind === 'el' && selParsed.el === 'code' && <CodeControls />}
            {selParsed.kind === 'el' && selParsed.el === 'banner' && (
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Banner Text</label>
                <input
                  type="text"
                  value={bannerTextEffective}
                  onChange={(e) => store.setBannerText(e.target.value)}
                  placeholder="e.g. FOR DENTAL PROFESSIONAL USE"
                  className="w-full bg-gray-50 border border-gray-200 rounded-lg py-2 px-3 text-gray-800 focus:outline-none focus:ring-2 focus:ring-dk-blue/30 focus:border-dk-blue transition-all text-sm"
                />
                {bannerTextEffective && (
                  <button
                    onClick={() => store.setBannerText('')}
                    className="text-[10px] font-bold text-red-600 hover:underline"
                  >
                    Clear banner
                  </button>
                )}
                <p className="text-[10px] text-gray-400">Tip: double-click the banner on the label to edit it in place.</p>
              </div>
            )}
          </div>
        </div>,
        document.body,
      )}

      {/* First-use hint */}
      {data.length > 0 && !selectedKey && (
        <div className="pointer-events-none absolute -bottom-1 left-1/2 -translate-x-1/2 translate-y-full text-[10px] text-gray-400 font-semibold whitespace-nowrap">
          Click to edit · double-click text to retype · drag a field or the logo to move it
        </div>
      )}
    </div>
  );
}
