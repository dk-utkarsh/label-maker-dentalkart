'use client';

import { useStore } from '@/lib/store';
import { AlignLeft, AlignCenter, AlignRight, ArrowUpToLine, ArrowDownToLine, Upload, Trash2 } from 'lucide-react';
import { useRef } from 'react';

/** Logo controls (image, horizontal position, top/bottom placement, size) for the inline popover. */
export default function LogoControls() {
  const { logo, logoPosition, setLogoPosition, logoSize, setLogoSize, logoPlacement, setLogoPlacement, setLogo } = useStore();
  const fileRef = useRef<HTMLInputElement>(null);

  const onPick = (file?: File | null) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => setLogo(e.target?.result as string);
    reader.readAsDataURL(file);
  };

  return (
    <div className="space-y-4">
      {/* Image: upload / replace / remove */}
      <div className="space-y-1.5">
        <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Image</label>
        <div className="flex items-center gap-2">
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => onPick(e.target.files?.[0])}
          />
          <button
            onClick={() => fileRef.current?.click()}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-dk-blue-light border border-dk-blue/20 text-dk-blue text-[10px] font-bold hover:bg-dk-blue hover:text-white transition-colors"
          >
            <Upload size={12} />
            {logo ? 'Replace' : 'Upload'}
          </button>
          {logo && (
            <button
              onClick={() => setLogo(null)}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-red-50 border border-red-200 text-red-600 text-[10px] font-bold hover:bg-red-100 transition-colors"
            >
              <Trash2 size={12} />
              Remove
            </button>
          )}
        </div>
      </div>

      {/* Placement: top / bottom */}
      <div className="space-y-1.5">
        <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Placement</label>
        <div className="flex gap-1 p-1 bg-gray-100 rounded-lg">
          {([
            { val: 'top' as const, icon: ArrowUpToLine, label: 'Top' },
            { val: 'bottom' as const, icon: ArrowDownToLine, label: 'Bottom' },
          ]).map(({ val, icon: Icon, label }) => (
            <button
              key={val}
              onClick={() => setLogoPlacement(val)}
              className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-md text-xs font-bold transition-all ${
                logoPlacement === val ? 'bg-white text-dk-blue shadow-sm' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              <Icon size={13} />
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Horizontal position */}
      <div className="space-y-1.5">
        <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Horizontal</label>
        <div className="flex bg-gray-50 p-1 rounded-lg border border-gray-200">
          {([
            { pos: 'left' as const, icon: AlignLeft },
            { pos: 'center' as const, icon: AlignCenter },
            { pos: 'right' as const, icon: AlignRight },
          ]).map(({ pos, icon: Icon }) => (
            <button
              key={pos}
              onClick={() => setLogoPosition(pos)}
              className={`flex-1 flex justify-center py-1 rounded-md transition-all ${
                logoPosition === pos ? 'bg-white text-dk-blue shadow-sm' : 'text-gray-400 hover:text-gray-600'
              }`}
            >
              <Icon size={14} />
            </button>
          ))}
        </div>
      </div>

      {/* Size */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Size</label>
          <span className="text-xs font-semibold text-gray-600">{logoSize}%</span>
        </div>
        <input
          type="range"
          min={20}
          max={250}
          step={5}
          value={logoSize}
          onChange={(e) => setLogoSize(Number(e.target.value))}
          className="w-full accent-dk-orange"
        />
        <div className="flex justify-between text-[9px] text-gray-400">
          <span>Small</span>
          <span>Default</span>
          <span>Large</span>
        </div>
      </div>
    </div>
  );
}
