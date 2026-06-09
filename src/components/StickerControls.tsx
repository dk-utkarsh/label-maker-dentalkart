'use client';

import { useStore } from '@/lib/store';
import { Upload, Trash2 } from 'lucide-react';
import { useRef } from 'react';

/** Sticker controls (image, size) for the inline popover. Position is set by dragging on the label. */
export default function StickerControls() {
  const { sticker, setSticker, stickerSize, setStickerSize } = useStore();
  const fileRef = useRef<HTMLInputElement>(null);

  const onPick = (file?: File | null) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => setSticker(e.target?.result as string);
    reader.readAsDataURL(file);
  };

  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Image</label>
        <div className="flex items-center gap-2">
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => onPick(e.target.files?.[0])} />
          <button
            onClick={() => fileRef.current?.click()}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-violet-50 border border-violet-200 text-violet-700 text-[10px] font-bold hover:bg-violet-100 transition-colors"
          >
            <Upload size={12} />
            {sticker ? 'Replace' : 'Upload'}
          </button>
          {sticker && (
            <button
              onClick={() => setSticker(null)}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-red-50 border border-red-200 text-red-600 text-[10px] font-bold hover:bg-red-100 transition-colors"
            >
              <Trash2 size={12} />
              Remove
            </button>
          )}
        </div>
      </div>

      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Size</label>
          <span className="text-xs font-semibold text-gray-600">{stickerSize}%</span>
        </div>
        <input
          type="range"
          min={5}
          max={100}
          step={1}
          value={stickerSize}
          onChange={(e) => setStickerSize(Number(e.target.value))}
          className="w-full accent-violet-500"
        />
      </div>

      <p className="text-[10px] text-gray-400">Drag the sticker on the label to move it; drag the corner handle to resize.</p>
    </div>
  );
}
