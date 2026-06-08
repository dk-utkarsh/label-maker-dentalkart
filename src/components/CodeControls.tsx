'use client';

import { useStore, type CodeType } from '@/lib/store';
import { AlignLeft, AlignCenter, AlignRight } from 'lucide-react';

/**
 * Barcode / QR controls (type, source column, size, position). Shared between the
 * Extra Settings panel and the inline popover so the two stay in lock-step.
 */
export default function CodeControls() {
  const store = useStore();
  const { setBarcodeField, setBarcodeSize, setQrSize, setCodeType, setCodeAlign, columns, editingLabelIdx, previewIdx } = store;
  const idx = editingLabelIdx ?? previewIdx;
  const effective = store.getEffectiveConfig(idx);
  const barcodeField = editingLabelIdx !== null ? effective.barcodeField : store.barcodeField;
  const barcodeSize = editingLabelIdx !== null ? effective.barcodeSize : store.barcodeSize;
  const qrSize = editingLabelIdx !== null ? effective.qrSize : store.qrSize;
  const codeType = editingLabelIdx !== null ? effective.codeType : store.codeType;
  const codeAlign = editingLabelIdx !== null ? effective.codeAlign : store.codeAlign;
  const currentCodeSize = codeType === 'qr' ? (qrSize ?? 100) : (barcodeSize ?? 100);
  const setCurrentCodeSize = codeType === 'qr' ? setQrSize : setBarcodeSize;

  return (
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
              onClick={() => setCodeType(value as CodeType)}
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
    </div>
  );
}
