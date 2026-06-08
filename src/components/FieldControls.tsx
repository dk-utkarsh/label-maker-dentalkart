'use client';

import { useStore, type FieldRole, type FontSize, type FontWeight, type Alignment, FONT_FAMILIES } from '@/lib/store';
import { Type, AlignLeft, AlignCenter, AlignRight, CaseSensitive, Square, Columns, SplitSquareVertical, Minus, CornerDownLeft, Undo2, Layers, Check } from 'lucide-react';
import { useState, useRef } from 'react';

/**
 * The full set of formatting controls for a single field, keyed by column name.
 * Rendered both inside the Extra Settings panel (ConfigSidebar) and inside the
 * inline popover on the Live Preview (EditablePreview) — single source of truth
 * so the two can never drift apart.
 */
export default function FieldControls({ column }: { column: string }) {
  const store = useStore();
  const {
    updateField, setDataOverride, clearDataOverride, applyDataOverrideToAll,
    clearDataOverrideForColumn, data, dataOverrides, editingLabelIdx, previewIdx,
  } = store;

  const idx = editingLabelIdx ?? previewIdx;
  const effective = store.getEffectiveConfig(idx);
  const config = editingLabelIdx !== null ? effective.config : store.config;
  const f = config.find(c => c.column === column);

  const [appliedFlash, setAppliedFlash] = useState<{ count: number } | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  const rawValue = String(data[idx]?.[column] ?? '');
  const displayValue = dataOverrides[idx]?.[column] ?? rawValue;
  const hasOverride = dataOverrides[idx]?.[column] !== undefined;
  const overrideCount = Object.values(dataOverrides).reduce((acc, row) => acc + (row[column] !== undefined ? 1 : 0), 0);

  if (!f) return null;

  const wrapSelectionBold = () => {
    const ta = textareaRef.current;
    if (!ta) return;
    const start = ta.selectionStart;
    const end = ta.selectionEnd;
    const text = displayValue;
    const selected = text.slice(start, end);
    const replacement = selected || 'bold text';
    const newText = text.slice(0, start) + `**${replacement}**` + text.slice(end);
    setDataOverride(idx, column, newText);
    requestAnimationFrame(() => {
      ta.focus();
      const inner = start + 2;
      ta.setSelectionRange(inner, inner + replacement.length);
    });
  };

  const handleApplyToAll = () => {
    const count = applyDataOverrideToAll(column, displayValue);
    setAppliedFlash({ count });
    setTimeout(() => setAppliedFlash(null), 2500);
  };

  return (
    <div className="space-y-4">
      {/* Text content + line breaks + inline bold (per-label or all labels) */}
      <div className="space-y-1.5">
        <div className="flex items-center flex-wrap gap-2">
          <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
            Text (Label #{idx + 1})
          </label>
          {overrideCount > 0 && (
            <span className="text-[9px] font-bold text-amber-700 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded-md">
              {overrideCount}/{data.length} overridden
            </span>
          )}
          <button
            onClick={wrapSelectionBold}
            title="Wrap selected text in **bold**"
            className="ml-auto flex items-center gap-1 px-2 py-0.5 rounded-md bg-gray-100 border border-gray-200 text-gray-700 text-[10px] font-black hover:bg-dk-blue-light hover:border-dk-blue/30 hover:text-dk-blue transition-colors"
          >
            B
          </button>
        </div>
        <textarea
          ref={textareaRef}
          value={displayValue}
          onChange={(e) => setDataOverride(idx, column, e.target.value)}
          rows={Math.min(6, Math.max(2, displayValue.split('\n').length + 1))}
          placeholder="(empty)"
          className="w-full bg-gray-50 border border-gray-200 rounded-lg py-2 px-2.5 text-xs text-gray-800 font-mono leading-relaxed focus:outline-none focus:ring-2 focus:ring-dk-blue/30 focus:border-dk-blue transition-all resize-y"
        />

        {/* Scope controls: apply to one label vs. all */}
        <div className="flex flex-wrap gap-2">
          <button
            onClick={handleApplyToAll}
            disabled={data.length === 0}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-violet-50 border border-violet-200 text-violet-700 text-[10px] font-bold hover:bg-violet-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            title="Copy this exact text (with line breaks and bold) to every label"
          >
            <Layers size={11} />
            Apply to All {data.length} Labels
          </button>
          {hasOverride && (
            <button
              onClick={() => clearDataOverride(idx, column)}
              title="Reset this label only"
              className="flex items-center gap-1 px-2 py-1 rounded-md bg-amber-50 border border-amber-200 text-amber-700 text-[10px] font-bold hover:bg-amber-100 transition-colors"
            >
              <Undo2 size={11} />
              Reset This
            </button>
          )}
          {overrideCount > 0 && (
            <button
              onClick={() => clearDataOverrideForColumn(column)}
              title="Reset this field on every label"
              className="flex items-center gap-1 px-2 py-1 rounded-md bg-red-50 border border-red-200 text-red-600 text-[10px] font-bold hover:bg-red-100 transition-colors"
            >
              <Undo2 size={11} />
              Reset All
            </button>
          )}
          {appliedFlash && (
            <span className="flex items-center gap-1 px-2 py-1 rounded-md bg-green-50 border border-green-200 text-green-700 text-[10px] font-bold">
              <Check size={11} />
              Applied to {appliedFlash.count} label{appliedFlash.count !== 1 ? 's' : ''}
            </span>
          )}
        </div>

        <p className="flex items-center gap-1 text-[10px] text-gray-400">
          <CornerDownLeft size={10} />
          <span><span className="font-bold text-gray-600">Enter</span> = new line. Wrap in <span className="font-bold text-gray-600">**double asterisks**</span> for bold (or select text and click <span className="font-bold text-gray-600">B</span>). Use <span className="font-bold text-gray-600">Apply to All</span> if every label should read the same.</span>
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Role</label>
          <select
            value={f.role}
            onChange={(e) => updateField(column, { role: e.target.value as FieldRole })}
            className="w-full bg-gray-50 border border-gray-200 rounded-lg py-1.5 px-2 text-xs text-gray-800"
          >
            <option value="title">Title</option>
            <option value="body">Body</option>
            <option value="footer">Footer</option>
            <option value="hidden">Hidden</option>
          </select>
        </div>
        <div className="space-y-1.5">
          <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Font Size</label>
          <select
            value={f.fontSize}
            onChange={(e) => updateField(column, { fontSize: e.target.value as FontSize })}
            className="w-full bg-gray-50 border border-gray-200 rounded-lg py-1.5 px-2 text-xs text-gray-800"
          >
            <option value="auto">Auto</option>
            <option value="xs">XS</option>
            <option value="sm">SM</option>
            <option value="md">MD</option>
            <option value="lg">LG</option>
            <option value="xl">XL</option>
          </select>
        </div>
      </div>

      {/* Font Style & Weight */}
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Font Style</label>
          <select
            value={f.fontFamily || ''}
            onChange={(e) => updateField(column, { fontFamily: e.target.value })}
            className="w-full bg-gray-50 border border-gray-200 rounded-lg py-1.5 px-2 text-xs text-gray-800"
            style={{ fontFamily: f.fontFamily || 'inherit' }}
          >
            {FONT_FAMILIES.map(ff => (
              <option key={ff.value} value={ff.value} style={{ fontFamily: ff.value || 'inherit' }}>
                {ff.label}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1.5">
          <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Font Weight</label>
          <select
            value={f.fontWeight || '400'}
            onChange={(e) => updateField(column, { fontWeight: e.target.value as FontWeight })}
            className="w-full bg-gray-50 border border-gray-200 rounded-lg py-1.5 px-2 text-xs text-gray-800"
          >
            <option value="100">Thin</option>
            <option value="400">Regular</option>
            <option value="600">Semi-Bold</option>
            <option value="700">Bold</option>
          </select>
        </div>
      </div>

      {/* Toggles */}
      <div className="flex flex-wrap gap-2 pt-2">
        {[
          { id: 'uppercase', icon: CaseSensitive, label: 'Upper' },
          { id: 'showLabel', icon: Type, label: 'Label' },
          { id: 'sameRow', icon: Columns, label: 'Row ↔' },
          { id: 'border', icon: Square, label: 'Box' },
          ...(f.border ? [
            { id: 'blockStart', icon: SplitSquareVertical, label: 'Split' },
            { id: 'mergeUp', icon: Minus, label: 'Merge ↑' },
            ...(f.sameRow ? [{ id: 'mergeRight', icon: Minus, label: 'Merge ←' }] : []),
            { id: 'openBorder', icon: Columns, label: 'Open' },
          ] : []),
        ].map(opt => {
          const Icon = opt.icon;
          const isActive = !!(f as unknown as Record<string, unknown>)[opt.id];
          return (
            <button
              key={opt.id}
              onClick={() => updateField(column, { [opt.id]: !isActive })}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-[10px] font-bold transition-all ${
                isActive
                  ? 'bg-dk-blue-light border-dk-blue/30 text-dk-blue'
                  : 'bg-gray-50 border-gray-200 text-gray-400 hover:border-gray-300'
              }`}
            >
              <Icon size={12} />
              {opt.label}
            </button>
          );
        })}
      </div>

      {/* Alignment */}
      <div className="flex bg-gray-50 p-1 rounded-lg border border-gray-200">
        {(['left', 'center', 'right'] as Alignment[]).map(align => {
          const Icon = align === 'left' ? AlignLeft : align === 'center' ? AlignCenter : AlignRight;
          return (
            <button
              key={align}
              onClick={() => updateField(column, { align })}
              className={`flex-1 flex justify-center py-1 rounded-md transition-all ${
                f.align === align ? 'bg-white text-dk-blue shadow-sm' : 'text-gray-400 hover:text-gray-600'
              }`}
            >
              <Icon size={14} />
            </button>
          );
        })}
      </div>
    </div>
  );
}
