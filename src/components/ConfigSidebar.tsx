'use client';

import { useStore } from '@/lib/store';
import { Settings2, Type, ChevronDown, ChevronUp, GripVertical, Barcode } from 'lucide-react';
import { useState, useRef, useMemo } from 'react';
import FieldControls from './FieldControls';
import CodeControls from './CodeControls';

type DisplayItem =
  | { kind: 'field'; configIndex: number }
  | { kind: 'barcode' };

export default function ConfigSidebar() {
  const store = useStore();
  const { setConfig, setBarcodeOrder, setBannerText, setOuterBorder, setPinFooter, columns, editingLabelIdx, previewIdx } = store;
  const idx = editingLabelIdx ?? previewIdx;

  const effective = store.getEffectiveConfig(idx);
  const config = editingLabelIdx !== null ? effective.config : store.config;
  const barcodeField = editingLabelIdx !== null ? effective.barcodeField : store.barcodeField;
  const barcodeOrder = editingLabelIdx !== null ? effective.barcodeOrder : store.barcodeOrder;
  const bannerText = editingLabelIdx !== null ? effective.bannerText : store.bannerText;
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
          {/* Outer Border Toggle */}
          <div className="flex items-center justify-between">
            <label className="text-xs font-bold text-gray-400 uppercase tracking-widest">Label Border</label>
            <button
              onClick={() => setOuterBorder(!store.outerBorder)}
              className={`relative w-10 h-5 rounded-full transition-colors ${store.outerBorder ? 'bg-dk-blue' : 'bg-gray-300'}`}
            >
              <span className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${store.outerBorder ? 'translate-x-5' : ''}`} />
            </button>
          </div>

          {/* Pin Footer Toggle — when off, footer rows flow tight against body instead of being pushed to bottom */}
          <div className="flex items-center justify-between">
            <div className="flex flex-col">
              <label className="text-xs font-bold text-gray-400 uppercase tracking-widest">Pin Footer to Bottom</label>
              <span className="text-[10px] text-gray-400">Turn off to remove blank gap before footer</span>
            </div>
            <button
              onClick={() => setPinFooter(!store.pinFooter)}
              className={`relative w-10 h-5 rounded-full transition-colors shrink-0 ${store.pinFooter ? 'bg-dk-blue' : 'bg-gray-300'}`}
            >
              <span className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${store.pinFooter ? 'translate-x-5' : ''}`} />
            </button>
          </div>

          {/* Barcode / QR controls (shared with the inline popover) */}
          <CodeControls />

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
                <div className="p-3 pt-3 border-t border-gray-100 mt-2">
                  <FieldControls column={f.column} />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
