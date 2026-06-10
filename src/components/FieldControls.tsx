'use client';

import { useStore, type FieldRole, type FontSize, type FontWeight, type Alignment, FONT_FAMILIES } from '@/lib/store';
import { markupToHtml } from '@/lib/richtext';
import { Type, AlignLeft, AlignCenter, AlignRight, CaseSensitive, Square, Columns, SplitSquareVertical, Minus, CornerDownLeft, Undo2 } from 'lucide-react';
import RichTextField from './RichTextField';

/**
 * The full set of formatting controls for a single field, keyed by column name.
 * Rendered both inside the Extra Settings panel (ConfigSidebar) and inside the
 * inline popover on the Live Preview (EditablePreview) — single source of truth
 * so the two can never drift apart.
 */
export default function FieldControls({ column }: { column: string }) {
  const store = useStore();
  const {
    updateField, setDataOverride, clearDataOverride,
    clearDataOverrideForColumn, data, dataOverrides, editingLabelIdx, previewIdx,
  } = store;

  const idx = editingLabelIdx ?? previewIdx;
  const effective = store.getEffectiveConfig(idx);
  const config = editingLabelIdx !== null ? effective.config : store.config;
  const f = config.find(c => c.column === column);

  const rawValue = String(data[idx]?.[column] ?? '');
  const displayValue = dataOverrides[idx]?.[column] ?? rawValue;
  const hasOverride = dataOverrides[idx]?.[column] !== undefined;
  const overrideCount = Object.values(dataOverrides).reduce((acc, row) => acc + (row[column] !== undefined ? 1 : 0), 0);

  if (!f) return null;

  // Toggle free placement. When turning free on, capture the field's current rendered
  // position from the DOM so it doesn't jump.
  const setFieldFree = (free: boolean) => {
    if (!free) { updateField(column, { free: false }); return; }
    const el = document.querySelector(`.label-content [data-field-column="${CSS.escape(column)}"]`);
    const content = document.querySelector('.label-content');
    if (el && content) {
      const r = el.getBoundingClientRect();
      const cr = content.getBoundingClientRect();
      updateField(column, { free: true, freeX: ((r.left - cr.left) / cr.width) * 100, freeY: ((r.top - cr.top) / cr.height) * 100, freeW: (r.width / cr.width) * 100 });
    } else {
      updateField(column, { free: true, freeX: 10, freeY: 10, freeW: 50 });
    }
  };

  return (
    <div className="space-y-4">
      {/* Placement: in-flow (auto) vs free (drag anywhere) */}
      <div className="space-y-1.5">
        <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Placement</label>
        <div className="flex gap-1 p-1 bg-gray-100 rounded-lg">
          {([
            { free: false, label: 'In-flow' },
            { free: true, label: 'Free (drag)' },
          ]).map(({ free, label }) => (
            <button
              key={label}
              onClick={() => setFieldFree(free)}
              className={`flex-1 py-1.5 rounded-md text-xs font-bold transition-all ${
                !!f.free === free ? 'bg-white text-dk-blue shadow-sm' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        {f.free && <p className="text-[10px] text-gray-400">Drag this field anywhere on the label; drag its corner to resize.</p>}
      </div>

      {/* Header / bold label text (falls back to the column name) */}
      <div className="space-y-1.5">
        <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Header (bold label)</label>
        <input
          type="text"
          value={f.customLabel ?? ''}
          onChange={(e) => updateField(column, { customLabel: e.target.value })}
          placeholder={column}
          className="w-full bg-gray-50 border border-gray-200 rounded-lg py-2 px-2.5 text-xs text-gray-800 focus:outline-none focus:ring-2 focus:ring-dk-blue/30 focus:border-dk-blue transition-all"
        />
        <p className="text-[10px] text-gray-400">
          {f.showLabel
            ? 'Bold text shown before the value. Leave empty to use the column name.'
            : 'Turn on the “Label” toggle below to show this header on the label.'}
        </p>
      </div>

      {/* Text content + line breaks + inline bold (per-label or all labels) */}
      <div className="space-y-1.5">
        <div className="flex items-center flex-wrap gap-2">
          <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
            Text (Label #{idx + 1})
          </label>
          {overrideCount > 0 && (
            <span className="ml-auto text-[9px] font-bold text-amber-700 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded-md">
              {overrideCount}/{data.length} overridden
            </span>
          )}
        </div>
        <RichTextField
          html={markupToHtml(displayValue)}
          onChange={(h) => setDataOverride(idx, column, h)}
          placeholder="(empty)"
          className="w-full min-h-[2.5rem] bg-gray-50 border border-gray-200 rounded-lg py-2 px-2.5 text-xs text-gray-800 leading-relaxed focus-within:ring-2 focus-within:ring-dk-blue/30 focus-within:border-dk-blue transition-all"
        />

        {/* Reset controls (applying to other labels lives in the bottom Apply bar) */}
        <div className="flex flex-wrap gap-2">
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
        </div>

        <p className="flex items-center gap-1 text-[10px] text-gray-400">
          <CornerDownLeft size={10} />
          <span><span className="font-bold text-gray-600">Enter</span> = new line. <span className="font-bold text-gray-600">Select any text</span> to format it (bold, italic, underline, size, colour). Use <span className="font-bold text-gray-600">Apply to All</span> if every label should read the same.</span>
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
