'use client';

import { useStore } from '@/lib/store';
import { LAYOUT_PRESETS } from '@/lib/layouts';
import { LayoutGrid } from 'lucide-react';

function PresetThumb({ id }: { id: string }) {
  if (id === 'dentalkart-standard') {
    return (
      <div className="w-full aspect-[3/4] bg-white rounded border border-gray-300 p-1.5 flex flex-col gap-[2px] overflow-hidden">
        <div className="h-[3px] bg-gray-900 rounded-sm" />
        <div className="h-[6px] bg-gray-800 rounded-sm" />
        <div className="h-[5px] bg-gray-700 rounded-sm w-3/4 mx-auto" />
        <div className="flex justify-center my-[2px]">
          <div className="w-3/5 h-[8px] bg-[repeating-linear-gradient(90deg,#374151_0px,#374151_1px,#fff_1px,#fff_2px)]" />
        </div>
        <div className="h-[4px] bg-gray-300 rounded-sm w-1/2 mx-auto" />
        <div className="flex-1 border border-gray-400 rounded-sm grid grid-cols-2 gap-px bg-gray-300 my-[2px] overflow-hidden">
          <div className="bg-white p-px"><div className="h-[3px] bg-gray-300 rounded-sm" /></div>
          <div className="bg-white p-px"><div className="h-[3px] bg-gray-300 rounded-sm" /></div>
          <div className="bg-white p-px"><div className="h-[3px] bg-gray-300 rounded-sm" /></div>
          <div className="bg-white p-px"><div className="h-[3px] bg-gray-300 rounded-sm" /></div>
        </div>
        <div className="h-[3px] bg-gray-200 rounded-sm" />
        <div className="h-[5px] bg-gray-900 rounded-sm mt-auto" />
      </div>
    );
  }

  if (id === 'simple') {
    return (
      <div className="w-full aspect-[3/4] bg-white rounded border border-gray-300 p-1.5 flex flex-col gap-[3px] overflow-hidden">
        <div className="h-[7px] bg-gray-800 rounded-sm w-3/4 mx-auto" />
        <div className="flex-1 flex flex-col gap-[3px] mt-1">
          <div className="h-[4px] bg-gray-300 rounded-sm" />
          <div className="h-[4px] bg-gray-300 rounded-sm" />
          <div className="h-[4px] bg-gray-300 rounded-sm" />
          <div className="h-[4px] bg-gray-300 rounded-sm w-3/4" />
        </div>
        <div className="h-[3px] bg-gray-200 rounded-sm mt-auto" />
        <div className="h-[3px] bg-gray-200 rounded-sm" />
      </div>
    );
  }

  if (id === 'compact') {
    return (
      <div className="w-full aspect-[3/4] bg-white rounded border border-gray-300 p-1.5 flex flex-col gap-[2px] overflow-hidden">
        <div className="h-[5px] bg-gray-800 rounded-sm" />
        <div className="flex-1 flex flex-col gap-[2px] mt-0.5">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="flex gap-[2px]">
              <div className="flex-1 h-[3px] bg-gray-300 rounded-sm" />
              <div className="flex-1 h-[3px] bg-gray-300 rounded-sm" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (id === 'pharmacy') {
    return (
      <div className="w-full aspect-[3/4] bg-white rounded border border-gray-300 p-1.5 flex flex-col gap-[2px] overflow-hidden">
        <div className="h-[3px] bg-gray-900 rounded-sm" />
        <div className="h-[5px] bg-gray-800 rounded-sm w-3/4 mx-auto" />
        <div className="border border-gray-400 rounded-sm p-0.5 my-[2px]">
          <div className="h-[3px] bg-gray-400 rounded-sm mb-[2px]" />
          <div className="h-[3px] bg-gray-300 rounded-sm mb-[2px]" />
          <div className="h-[3px] bg-gray-300 rounded-sm" />
        </div>
        <div className="h-[3px] bg-gray-300 rounded-sm" />
        <div className="h-[3px] bg-gray-200 rounded-sm w-3/4" />
        <div className="h-[3px] bg-red-300 rounded-sm mt-auto" />
        <div className="h-[5px] bg-gray-900 rounded-sm" />
      </div>
    );
  }

  if (id === 'shipping') {
    return (
      <div className="w-full aspect-[3/4] bg-white rounded border border-gray-300 p-1.5 flex flex-col gap-[2px] overflow-hidden">
        <div className="h-[3px] bg-gray-900 rounded-sm" />
        <div className="h-[8px] bg-gray-800 rounded-sm" />
        <div className="flex justify-center my-[3px]">
          <div className="w-4/5 h-[12px] bg-[repeating-linear-gradient(90deg,#374151_0px,#374151_2px,#fff_2px,#fff_3px)]" />
        </div>
        <div className="h-[3px] bg-gray-300 rounded-sm" />
        <div className="h-[3px] bg-gray-300 rounded-sm" />
        <div className="h-[3px] bg-gray-300 rounded-sm w-2/3" />
        <div className="flex gap-[2px] mt-auto">
          <div className="flex-1 h-[3px] bg-gray-300 rounded-sm" />
          <div className="flex-1 h-[3px] bg-gray-300 rounded-sm" />
        </div>
      </div>
    );
  }

  if (id === 'shelf-tag') {
    return (
      <div className="w-full aspect-[3/4] bg-white rounded border border-gray-300 p-1.5 flex flex-col items-center gap-[3px] overflow-hidden">
        <div className="h-[5px] bg-gray-800 rounded-sm w-3/4" />
        <div className="flex-1 flex items-center justify-center">
          <div className="text-[14px] font-black text-gray-700 leading-none">{'\u20B9'}</div>
        </div>
        <div className="h-[3px] bg-gray-300 rounded-sm w-2/3" />
        <div className="h-[3px] bg-gray-200 rounded-sm w-1/2" />
        <div className="flex justify-center mt-auto">
          <div className="w-3/5 h-[6px] bg-[repeating-linear-gradient(90deg,#6b7280_0px,#6b7280_1px,#fff_1px,#fff_2px)]" />
        </div>
      </div>
    );
  }

  if (id === 'compliance') {
    return (
      <div className="w-full aspect-[3/4] bg-white rounded border border-gray-300 p-1.5 flex flex-col gap-[2px] overflow-hidden">
        <div className="h-[3px] bg-gray-900 rounded-sm" />
        <div className="h-[5px] bg-gray-800 rounded-sm w-3/4 mx-auto" />
        <div className="border border-gray-400 rounded-sm grid grid-cols-2 gap-px bg-gray-300 my-[2px] overflow-hidden">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="bg-white p-px"><div className="h-[2px] bg-gray-300 rounded-sm" /></div>
          ))}
        </div>
        <div className="h-[3px] bg-gray-300 rounded-sm" />
        <div className="h-[3px] bg-gray-300 rounded-sm" />
        <div className="h-[3px] bg-gray-200 rounded-sm" />
        <div className="h-[3px] bg-gray-200 rounded-sm w-2/3" />
        <div className="h-[5px] bg-gray-900 rounded-sm mt-auto" />
      </div>
    );
  }

  // warehouse
  return (
    <div className="w-full aspect-[3/4] bg-white rounded border border-gray-300 p-1.5 flex flex-col gap-[2px] overflow-hidden">
      <div className="h-[3px] bg-gray-900 rounded-sm" />
      <div className="h-[8px] bg-gray-900 rounded-sm text-[3px] text-white font-bold flex items-center justify-center">SKU</div>
      <div className="flex justify-center my-[2px]">
        <div className="w-4/5 h-[14px] bg-[repeating-linear-gradient(90deg,#111827_0px,#111827_2px,#fff_2px,#fff_3px)]" />
      </div>
      <div className="h-[4px] bg-gray-600 rounded-sm" />
      <div className="border border-gray-400 rounded-sm p-0.5">
        <div className="h-[3px] bg-gray-400 rounded-sm mb-[1px]" />
        <div className="h-[3px] bg-gray-300 rounded-sm" />
      </div>
      <div className="flex gap-[2px] mt-auto">
        <div className="flex-1 h-[3px] bg-gray-200 rounded-sm" />
        <div className="flex-1 h-[3px] bg-gray-200 rounded-sm" />
      </div>
    </div>
  );
}

export default function LayoutSelector() {
  const { activeLayout, applyLayout, columns } = useStore();

  if (!columns.length) return null;

  return (
    <div className="p-5 rounded-2xl bg-white border border-gray-200 shadow-sm">
      <div className="flex items-center gap-2 text-gray-600 mb-4 text-sm font-semibold uppercase tracking-wider">
        <LayoutGrid size={16} className="text-dk-orange" />
        <span>Layout Presets</span>
        <span className="ml-auto text-[10px] text-gray-400 font-normal normal-case tracking-normal">{LAYOUT_PRESETS.length} templates</span>
      </div>
      <div className="grid grid-cols-4 sm:grid-cols-4 md:grid-cols-8 gap-3">
        {LAYOUT_PRESETS.map(preset => {
          const isActive = activeLayout === preset.id;
          return (
            <button
              key={preset.id}
              onClick={() => applyLayout(preset.id)}
              className={`group p-2.5 rounded-xl border transition-all text-left ${
                isActive
                  ? 'bg-dk-orange-light border-dk-orange ring-1 ring-dk-orange/30'
                  : 'bg-gray-50 border-gray-200 hover:border-gray-300 hover:bg-white'
              }`}
            >
              <div className="w-full max-w-[56px] mx-auto mb-2">
                <PresetThumb id={preset.id} />
              </div>
              <p className={`text-[10px] font-bold truncate text-center ${isActive ? 'text-dk-orange' : 'text-gray-600'}`}>
                {preset.name}
              </p>
            </button>
          );
        })}
      </div>
    </div>
  );
}
