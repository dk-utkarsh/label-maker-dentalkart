'use client';

import { useStore, type FieldRole, type FontSize, type Alignment } from '@/lib/store';
import { Settings2, Type, ChevronDown, ChevronUp, AlignLeft, AlignCenter, AlignRight, Bold, CaseSensitive, Square, Columns, GripVertical, Barcode, SplitSquareVertical, Minus } from 'lucide-react';
import { useState, useRef, useMemo } from 'react';

type DisplayItem =
  | { kind: 'field'; configIndex: number }
  | { kind: 'barcode' };

export default function ConfigSidebar() {
  const store = useStore();
  const { setConfig, updateField, setBarcodeField, setBarcodeOrder, setBarcodeSize, setQrSize, setCodeType, setCodeAlign, setBannerText, columns, editingLabelIdx, previewIdx } = store;
  const idx = editingLabelIdx ?? previewIdx;
  const effective = store.getEffectiveConfig(idx);
  const config = editingLabelIdx !== null ? effective.config : store.config;
  const barcodeField = editingLabelIdx !== null ? effective.barcodeField : store.barcodeField;
  const barcodeOrder = editingLabelIdx !== null ? effective.barcodeOrder : store.barcodeOrder;
  const barcodeSize = editingLabelIdx !== null ? effective.barcodeSize : store.barcodeSize;
  const qrSize = editingLabelIdx !== null ? effective.qrSize : store.qrSize;
  const codeType = editingLabelIdx !== null ? effective.codeType : store.codeType;
  const codeAlign = editingLabelIdx !== null ? effective.codeAlign : store.codeAlign;
  const bannerText = editingLabelIdx !== null ? effective.bannerText : store.bannerText;
  const currentCodeSize = codeType === 'qr' ? (qrSize ?? 100) : (barcodeSize ?? 100);
  const setCurrentCodeSize = codeType === 'qr' ? setQrSize : setBarcodeSize;
  const [expandedField, setExpandedField] = useState<string | null>(null);

  const dragIdx = useRef<number | null>(null);
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null);

  const displayItems = useMemo((): DisplayItem[] => {
    if (!barcodeField) {
      return config.map((_, i) => ({ kind: 'field' as const, configIndex: i }));
    }
    const items: DisplayItem[] = [];
    const bo = Math.min(Math.max(0, barcodeOrder), config.length);
    config.forEach((_, i) => {
      if (i === bo) items.push({ kind: 'barcode' });
      items.push({ kind: 'field', configIndex: i });
    });
    if (bo >= config.length) items.push({ kind: 'barcode' });
    return items;
  }, [config, barcodeField, barcodeOrder]);

  const handleDragStart = (displayIndex: number) => {
    dragIdx.current = displayIndex;
  };

  const handleDragOver = (e: React.DragEvent, displayIndex: number) => {
    e.preventDefault();
    if (dragIdx.current !== null && dragIdx.current !== displayIndex) {
      setDragOverIdx(displayIndex);
    }
  };

  const handleDrop = (toDisplayIndex: number) => {
    const fromDisplayIndex = dragIdx.current;
    if (fromDisplayIndex === null || fromDisplayIndex === toDisplayIndex) {
      dragIdx.current = null;
      setDragOverIdx(null);
      return;
    }

    const items = [...displayItems];
    const [moved] = items.splice(fromDisplayIndex, 1);
    items.splice(toDisplayIndex, 0, moved);

    const newFieldOrder: number[] = [];
    let newBarcodeOrder = 0;
    items.forEach(item => {
      if (item.kind === 'barcode') {
        newBarcodeOrder = newFieldOrder.length;
      } else {
        newFieldOrder.push(item.configIndex);
      }
    });

    const newConfig = newFieldOrder.map(i => config[i]);
    setConfig(newConfig);
    if (barcodeField) setBarcodeOrder(newBarcodeOrder);

    dragIdx.current = null;
    setDragOverIdx(null);
  };

  const handleDragEnd = () => {
    dragIdx.current = null;
    setDragOverIdx(null);
  };

  if (!columns.length) return null;

  return (
    <div className="space-y-4">
      {/* Extra Options */}
      <div className="p-5 rounded-2xl bg-white border border-gray-200 shadow-sm">
        <div className="flex items-center gap-2 text-gray-600 mb-5 text-sm font-semibold uppercase tracking-wider">
          <Settings2 size={16} className="text-dk-blue" />
          <span>Extra Settings</span>
        </div>
        <div className="space-y-4">
          {/* Code Type Toggle */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-gray-400 uppercase tracking-widest">Code Type</label>
            <div className="flex gap-1 p-1 bg-gray-100 rounded-lg">
              {([
                { value: 'none' as const, label: 'None' },
                { value: 'barcode' as const, label: 'Barcode' },
                { value: 'qr' as const, label: 'QR Code' },
              ]).map(({ value, label }) => (
                <button
                  key={value}
                  onClick={() => setCodeType(value)}
                  className={`flex-1 py-1.5 rounded-md text-xs font-bold transition-all ${
                    codeType === value
                      ? 'bg-white text-dk-blue shadow-sm'
                      : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Data Source — shown for barcode or QR */}
          {codeType !== 'none' && (
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-gray-400 uppercase tracking-widest">
                {codeType === 'qr' ? 'QR Code' : 'Barcode'} Source
              </label>
              <select
                value={barcodeField}
                onChange={(e) => setBarcodeField(e.target.value)}
                className="w-full bg-gray-50 border border-gray-200 rounded-lg py-2 px-3 text-gray-800 focus:outline-none focus:ring-2 focus:ring-dk-blue/30 focus:border-dk-blue transition-all text-sm"
              >
                <option value="">Select Column</option>
                {columns.map(col => <option key={col} value={col}>{col}</option>)}
              </select>
            </div>
          )}

          {codeType !== 'none' && barcodeField && (
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-gray-400 uppercase tracking-widest">{codeType === 'qr' ? 'QR' : 'Barcode'} Size</label>
                <span className="text-xs font-semibold text-gray-600">{currentCodeSize}%</span>
              </div>
              <input
                type="range"
                min={30}
                max={200}
                step={5}
                value={currentCodeSize}
                onChange={(e) => setCurrentCodeSize(Number(e.target.value))}
                className="w-full accent-violet-500"
              />
              <div className="flex justify-between text-[10px] text-gray-400">
                <span>Small</span>
                <span>Default</span>
                <span>Large</span>
              </div>
            </div>
          )}

          {/* Code Position */}
          {codeType !== 'none' && barcodeField && (
            <div className="space-y-1.5">
              <div className="flex items-center gap-2">
                <label className="text-xs font-bold text-gray-400 uppercase tracking-widest">
                  {codeType === 'qr' ? 'QR' : 'Barcode'} Position
                </label>
                <div className="flex gap-1 ml-auto">
                  {([
                    { pos: 'left' as const, icon: AlignLeft, label: 'Left' },
                    { pos: 'center' as const, icon: AlignCenter, label: 'Center' },
                    { pos: 'right' as const, icon: AlignRight, label: 'Right' },
                  ]).map(({ pos, icon: Icon, label }) => (
                    <button
                      key={pos}
                      onClick={() => setCodeAlign(pos)}
                      title={label}
                      className={`p-1.5 rounded-lg transition-colors ${
                        codeAlign === pos
                          ? 'bg-violet-500 text-white'
                          : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                      }`}
                    >
                      <Icon size={14} />
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          <div className="space-y-1.5">
            <label className="text-xs font-bold text-gray-400 uppercase tracking-widest">Global Banner Text</label>
            <input
              type="text"
              value={bannerText}
              onChange={(e) => setBannerText(e.target.value)}
              placeholder="e.g. FOR DENTAL PROFESSIONAL USE"
              className="w-full bg-gray-50 border border-gray-200 rounded-lg py-2 px-3 text-gray-800 focus:outline-none focus:ring-2 focus:ring-dk-blue/30 focus:border-dk-blue transition-all text-sm"
            />
          </div>
        </div>
      </div>

      {/* Field List */}
      <div className="space-y-2">
        <div className="flex items-center gap-2 text-gray-600 mb-3 text-sm font-semibold uppercase tracking-wider px-1">
          <Type size={16} className="text-dk-orange" />
          <span>Field Configuration</span>
          <span className="ml-auto text-[10px] text-gray-400 font-normal normal-case tracking-normal">Drag to reorder</span>
        </div>

        {displayItems.map((item, displayIdx) => {
          if (item.kind === 'barcode') {
            return (
              <div
                key="__barcode__"
                draggable
                onDragStart={() => handleDragStart(displayIdx)}
                onDragOver={(e) => handleDragOver(e, displayIdx)}
                onDrop={() => handleDrop(displayIdx)}
                onDragEnd={handleDragEnd}
                className={`rounded-xl border transition-all ${
                  dragOverIdx === displayIdx
                    ? 'border-dk-blue bg-dk-blue-light scale-[1.01]'
                    : 'bg-violet-400/5 border-violet-400/30 hover:border-violet-400/50'
                }`}
              >
                <div className="p-3 flex items-center gap-2 select-none">
                  <div className="cursor-grab active:cursor-grabbing text-gray-400 hover:text-gray-600 transition-colors shrink-0">
                    <GripVertical size={16} />
                  </div>
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <Barcode size={14} className="text-violet-500 shrink-0" />
                    <span className="text-sm font-semibold text-violet-600">Barcode</span>
                  </div>
                  <span className="text-[10px] font-black uppercase tracking-widest bg-violet-500/10 text-violet-500 px-2 py-0.5 rounded border border-violet-400/20">
                    {barcodeField}
                  </span>
                </div>
              </div>
            );
          }

          const f = config[item.configIndex];
          return (
            <div
              key={f.column}
              draggable
              onDragStart={() => handleDragStart(displayIdx)}
              onDragOver={(e) => handleDragOver(e, displayIdx)}
              onDrop={() => handleDrop(displayIdx)}
              onDragEnd={handleDragEnd}
              className={`rounded-xl border transition-all ${
                dragOverIdx === displayIdx
                  ? 'border-dk-blue bg-dk-blue-light scale-[1.01]'
                  : expandedField === f.column
                    ? 'bg-white border-gray-300 shadow-md ring-1 ring-gray-200'
                    : 'bg-white border-gray-200 hover:border-gray-300'
              } ${f.role === 'hidden' ? 'opacity-40 hover:opacity-100' : ''}`}
            >
              <div
                className="p-3 flex items-center gap-2 cursor-pointer select-none"
                onClick={() => setExpandedField(expandedField === f.column ? null : f.column)}
              >
                <div
                  className="cursor-grab active:cursor-grabbing text-gray-400 hover:text-gray-600 transition-colors shrink-0"
                  onMouseDown={(e) => e.stopPropagation()}
                >
                  <GripVertical size={16} />
                </div>
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <div className={`w-2 h-2 rounded-full shrink-0 ${
                    f.role === 'title' ? 'bg-dk-blue' :
                    f.role === 'body' ? 'bg-green-500' :
                    f.role === 'footer' ? 'bg-dk-orange' : 'bg-gray-400'
                  }`} />
                  <span className="text-sm font-semibold text-gray-800 truncate">{f.column}</span>
                </div>
                <div className="flex items-center gap-2 text-gray-400 shrink-0">
                  <span className={`text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded border ${
                    f.role === 'title' ? 'bg-dk-blue-light text-dk-blue border-dk-blue/20' :
                    f.role === 'body' ? 'bg-green-100 text-green-500 border-green-500/20' :
                    f.role === 'footer' ? 'bg-dk-orange-light text-dk-orange border-dk-orange/20' :
                    'bg-gray-100 text-gray-400 border-gray-200'
                  }`}>{f.role}</span>
                  {expandedField === f.column ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                </div>
              </div>

              {expandedField === f.column && (
                <div className="p-3 pt-0 border-t border-gray-100 mt-2 space-y-4">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Role</label>
                      <select
                        value={f.role}
                        onChange={(e) => updateField(f.column, { role: e.target.value as FieldRole })}
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
                        onChange={(e) => updateField(f.column, { fontSize: e.target.value as FontSize })}
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

                  {/* Toggles */}
                  <div className="flex flex-wrap gap-2 pt-2">
                    {[
                      { id: 'bold', icon: Bold, label: 'Bold' },
                      { id: 'uppercase', icon: CaseSensitive, label: 'Upper' },
                      { id: 'showLabel', icon: Type, label: 'Label' },
                      { id: 'sameRow', icon: Columns, label: 'Row \u2194' },
                      { id: 'border', icon: Square, label: 'Box' },
                      ...(f.border ? [
                        { id: 'blockStart', icon: SplitSquareVertical, label: 'Split' },
                        { id: 'mergeUp', icon: Minus, label: 'Merge ↑' },
                        ...(f.sameRow ? [{ id: 'mergeRight', icon: Minus, label: 'Merge ←' }] : []),
                        { id: 'openBorder', icon: Columns, label: 'Open' },
                      ] : []),
                    ].map(opt => {
                      const Icon = opt.icon;
                      const isActive = !!(f as any)[opt.id];
                      return (
                        <button
                          key={opt.id}
                          onClick={() => updateField(f.column, { [opt.id]: !isActive })}
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
                          onClick={() => updateField(f.column, { align })}
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
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
