'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Bold, Italic, Underline, Type } from 'lucide-react';
import { sanitizeHtml } from '@/lib/richtext';

interface Props {
  /** HTML the editor should display (already editor-ready — see markupToHtml). */
  html: string;
  onChange: (html: string) => void;
  autoFocus?: boolean;
  className?: string;
  style?: React.CSSProperties;
  placeholder?: string;
}

const COLORS = ['#000000', '#E8922A', '#2B7CB8', '#16a34a', '#dc2626', '#7c3aed', '#ffffff'];
const SIZES: { label: string; em: string }[] = [
  { label: 'S', em: '0.8em' },
  { label: 'M', em: '1em' },
  { label: 'L', em: '1.35em' },
  { label: 'XL', em: '1.8em' },
];

/**
 * A small WYSIWYG rich-text editor (contentEditable). Selecting text pops up a
 * floating toolbar to format just the selection: bold / italic / underline / size / colour.
 * Emits sanitized HTML on every change.
 */
export default function RichTextField({ html, onChange, autoFocus, className, style, placeholder }: Props) {
  const editorRef = useRef<HTMLDivElement>(null);
  const [toolbar, setToolbar] = useState<{ top: number; left: number } | null>(null);
  const savedRange = useRef<Range | null>(null);

  // Sync external value in without disrupting active typing.
  useEffect(() => {
    const el = editorRef.current;
    if (!el) return;
    if (document.activeElement === el) return;
    const incoming = html || '';
    if (el.innerHTML !== incoming) el.innerHTML = incoming;
  }, [html]);

  useEffect(() => {
    if (autoFocus && editorRef.current) {
      const el = editorRef.current;
      el.focus();
      const range = document.createRange();
      range.selectNodeContents(el);
      range.collapse(false);
      const sel = window.getSelection();
      sel?.removeAllRanges();
      sel?.addRange(range);
    }
  }, [autoFocus]);

  const emit = useCallback(() => {
    const el = editorRef.current;
    if (el) onChange(sanitizeHtml(el.innerHTML));
  }, [onChange]);

  // Show/position the selection toolbar.
  useEffect(() => {
    const onSel = () => {
      const el = editorRef.current;
      const sel = window.getSelection();
      if (!el || !sel || sel.isCollapsed || sel.rangeCount === 0) { setToolbar(null); return; }
      if (!el.contains(sel.anchorNode) || !el.contains(sel.focusNode)) { setToolbar(null); return; }
      const rect = sel.getRangeAt(0).getBoundingClientRect();
      if (rect.width === 0 && rect.height === 0) { setToolbar(null); return; }
      savedRange.current = sel.getRangeAt(0).cloneRange();
      setToolbar({ top: Math.max(8, rect.top - 8), left: rect.left + rect.width / 2 });
    };
    document.addEventListener('selectionchange', onSel);
    return () => document.removeEventListener('selectionchange', onSel);
  }, []);

  const restoreSelection = () => {
    const el = editorRef.current;
    const range = savedRange.current;
    if (!el || !range) return;
    el.focus();
    const sel = window.getSelection();
    sel?.removeAllRanges();
    sel?.addRange(range);
  };

  const exec = (cmd: string, value?: string) => {
    restoreSelection();
    if (cmd === 'fontSizeEm') {
      document.execCommand('fontSize', false, '7');
      editorRef.current?.querySelectorAll('font[size="7"]').forEach((f) => {
        const span = document.createElement('span');
        span.style.fontSize = value || '1em';
        while (f.firstChild) span.appendChild(f.firstChild);
        f.replaceWith(span);
      });
    } else if (cmd === 'foreColor') {
      document.execCommand('styleWithCSS', false, 'true');
      document.execCommand('foreColor', false, value);
    } else {
      document.execCommand(cmd);
    }
    emit();
  };

  return (
    <>
      <div
        ref={editorRef}
        contentEditable
        suppressContentEditableWarning
        onInput={emit}
        onBlur={emit}
        data-placeholder={placeholder}
        spellCheck={false}
        className={`dk-rte outline-none ${className || ''}`}
        style={style}
      />
      {toolbar && typeof document !== 'undefined' && createPortal(
        <div
          data-rte-toolbar
          className="fixed z-[200] -translate-x-1/2 -translate-y-full flex items-center gap-0.5 rounded-lg bg-gray-900 text-white shadow-2xl px-1 py-1"
          style={{ top: toolbar.top, left: toolbar.left }}
          onMouseDown={(e) => e.preventDefault()}
        >
          <button onClick={() => exec('bold')} title="Bold" className="w-7 h-7 rounded flex items-center justify-center hover:bg-white/15"><Bold size={14} /></button>
          <button onClick={() => exec('italic')} title="Italic" className="w-7 h-7 rounded flex items-center justify-center hover:bg-white/15"><Italic size={14} /></button>
          <button onClick={() => exec('underline')} title="Underline" className="w-7 h-7 rounded flex items-center justify-center hover:bg-white/15"><Underline size={14} /></button>
          <span className="w-px h-5 bg-white/20 mx-0.5" />
          {SIZES.map((s) => (
            <button key={s.label} onClick={() => exec('fontSizeEm', s.em)} title={`Size ${s.label}`} className="w-7 h-7 rounded flex items-center justify-center hover:bg-white/15 text-[11px] font-bold">{s.label}</button>
          ))}
          <span className="w-px h-5 bg-white/20 mx-0.5" />
          <Type size={12} className="ml-0.5 text-white/60" />
          {COLORS.map((c) => (
            <button
              key={c}
              onClick={() => exec('foreColor', c)}
              title={c}
              className="w-5 h-5 rounded-full border border-white/30"
              style={{ backgroundColor: c }}
            />
          ))}
        </div>,
        document.body,
      )}
    </>
  );
}
