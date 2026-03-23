'use client';

import { useState } from 'react';
import * as XLSX from 'xlsx';
import { useStore, type FieldConfig } from '@/lib/store';
import { FileSpreadsheet, Image as ImageIcon, X, Ruler, CheckCircle, AlignLeft, AlignCenter, AlignRight } from 'lucide-react';

const PRESET_SIZES = [
  { label: '62 x 100', w: 62, h: 100 },
  { label: '50 x 25', w: 50, h: 25 },
  { label: '100 x 50', w: 100, h: 50 },
  { label: '38 x 25', w: 38, h: 25 },
  { label: '75 x 50', w: 75, h: 50 },
];

export default function UploadSection() {
  const { width, height, setDimensions, setData, setConfig, setLogo, logo, logoPosition, setLogoPosition, data, columns } = useStore();
  const [isDraggingExcel, setIsDraggingExcel] = useState(false);
  const [isDraggingLogo, setIsDraggingLogo] = useState(false);
  const [excelFileName, setExcelFileName] = useState('');

  const handleExcel = (file: File) => {
    setExcelFileName(file.name);
    const reader = new FileReader();
    reader.onload = (e) => {
      const bstr = e.target?.result;
      const wb = XLSX.read(bstr, { type: 'binary' });
      const wsname = wb.SheetNames[0];
      const ws = wb.Sheets[wsname];
      const data = XLSX.utils.sheet_to_json(ws);
      const columns = Object.keys(data[0] as any);

      const config: FieldConfig[] = columns.map((col, i) => {
        const lower = col.toLowerCase();
        let role: any = 'body';
        if (i === 0 || lower.includes('name') || lower.includes('product')) role = 'title';
        else if (lower.includes('sku') || lower.includes('id') || lower.includes('mfg') || lower.includes('exp')) role = 'footer';

        return {
          column: col,
          role,
          fontSize: 'auto' as const,
          align: 'left' as const,
          bold: role === 'title',
          uppercase: false,
          showLabel: true,
          prefix: '',
          suffix: '',
          sameRow: false,
          border: false,
        };
      });

      setData(data, columns);
      setConfig(config);
    };
    reader.readAsBinaryString(file);
  };

  const handleLogo = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      setLogo(e.target?.result as string);
    };
    reader.readAsDataURL(file);
  };

  const hasData = data.length > 0;

  const clearExcel = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    setData([], []);
    setConfig([]);
    setExcelFileName('');
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Excel Upload */}
        <div
          onDragOver={(e) => { e.preventDefault(); setIsDraggingExcel(true); }}
          onDragLeave={() => setIsDraggingExcel(false)}
          onDrop={(e) => { e.preventDefault(); setIsDraggingExcel(false); if (e.dataTransfer.files[0]) handleExcel(e.dataTransfer.files[0]); }}
          className={`relative border-2 border-dashed rounded-2xl p-6 text-center transition-all bg-white ${
            hasData
              ? 'border-green-500/30 bg-green-100/20'
              : isDraggingExcel ? 'border-dk-blue bg-dk-blue-light' : 'border-gray-300 hover:border-dk-blue/50'
          }`}
        >
          {!hasData && (
            <input
              type="file"
              accept=".xlsx,.xls"
              onChange={(e) => { if (e.target.files?.[0]) handleExcel(e.target.files[0]); }}
              className="absolute inset-0 opacity-0 cursor-pointer"
            />
          )}
          <div className="flex flex-col items-center gap-2.5">
            {hasData ? (
              <>
                <div className="relative">
                  <div className="w-12 h-12 rounded-2xl bg-green-100 flex items-center justify-center text-green-500">
                    <CheckCircle size={24} />
                  </div>
                  <button
                    onClick={clearExcel}
                    className="absolute -top-2 -right-2 p-1 rounded-full bg-red-100 text-red-500 hover:bg-red-500 hover:text-white transition-colors shadow-sm z-10"
                  >
                    <X size={12} />
                  </button>
                </div>
                <div>
                  <p className="font-bold text-gray-800 text-sm">{excelFileName || 'Data Loaded'}</p>
                  <p className="text-[10px] text-gray-400 mt-0.5">{data.length} rows &middot; {columns.length} columns</p>
                </div>
              </>
            ) : (
              <>
                <div className="w-12 h-12 rounded-2xl bg-dk-blue-light flex items-center justify-center text-dk-blue">
                  <FileSpreadsheet size={24} />
                </div>
                <div>
                  <p className="font-bold text-gray-800 text-sm">Upload Data</p>
                  <p className="text-[10px] text-gray-400 mt-0.5">Excel (.xlsx, .xls)</p>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Logo Upload */}
        <div
          onDragOver={(e) => { e.preventDefault(); setIsDraggingLogo(true); }}
          onDragLeave={() => setIsDraggingLogo(false)}
          onDrop={(e) => { e.preventDefault(); setIsDraggingLogo(false); if (e.dataTransfer.files[0]) handleLogo(e.dataTransfer.files[0]); }}
          className={`relative border-2 border-dashed rounded-2xl p-6 text-center transition-all bg-white ${
            logo
              ? 'border-dk-orange/30 bg-dk-orange-light/20'
              : isDraggingLogo ? 'border-dk-orange bg-dk-orange-light' : 'border-gray-300 hover:border-dk-orange/50'
          }`}
        >
          {logo ? (
            <div className="relative h-16 w-full flex items-center justify-center">
              <img src={logo} className="max-h-full max-w-full object-contain" alt="Logo" />
              <button
                onClick={(e) => { e.stopPropagation(); setLogo(null); }}
                className="absolute -top-3 -right-3 p-1.5 rounded-full bg-red-100 text-red-500 hover:bg-red-500 hover:text-white transition-colors shadow-sm"
              >
                <X size={12} />
              </button>
            </div>
          ) : (
            <>
              <input
                type="file"
                accept="image/*"
                onChange={(e) => { if (e.target.files?.[0]) handleLogo(e.target.files[0]); }}
                className="absolute inset-0 opacity-0 cursor-pointer"
              />
              <div className="flex flex-col items-center gap-2.5">
                <div className="w-12 h-12 rounded-2xl bg-dk-orange-light flex items-center justify-center text-dk-orange">
                  <ImageIcon size={24} />
                </div>
                <div>
                  <p className="font-bold text-gray-800 text-sm">Brand Logo</p>
                  <p className="text-[10px] text-gray-400 mt-0.5">Optional (.png, .jpg)</p>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Logo Position */}
        {logo && (
          <div className="flex items-center gap-2 px-1">
            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Logo Position</span>
            <div className="flex gap-1 ml-auto">
              {([
                { pos: 'left' as const, icon: AlignLeft, label: 'Left' },
                { pos: 'center' as const, icon: AlignCenter, label: 'Center' },
                { pos: 'right' as const, icon: AlignRight, label: 'Right' },
              ]).map(({ pos, icon: Icon, label }) => (
                <button
                  key={pos}
                  onClick={() => setLogoPosition(pos)}
                  title={label}
                  className={`p-1.5 rounded-lg transition-colors ${
                    logoPosition === pos
                      ? 'bg-dk-orange text-white'
                      : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                  }`}
                >
                  <Icon size={14} />
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Dimensions */}
        <div className="p-5 rounded-2xl bg-white border border-gray-200 shadow-sm">
          <div className="flex items-center gap-2 text-gray-600 mb-3 text-xs font-semibold uppercase tracking-wider">
            <Ruler size={14} className="text-dk-blue" />
            <span>Dimensions</span>
          </div>
          <div className="flex items-center gap-3 mb-3">
            <div className="flex-1">
              <label className="text-[9px] font-bold text-gray-400 uppercase tracking-widest">W (mm)</label>
              <input
                type="number"
                value={width}
                onChange={(e) => setDimensions(parseFloat(e.target.value) || 0, height)}
                className="w-full bg-gray-50 border border-gray-200 rounded-lg py-1.5 px-3 text-gray-900 focus:outline-none focus:ring-2 focus:ring-dk-blue/30 focus:border-dk-blue transition-all font-mono text-sm mt-1"
              />
            </div>
            <span className="text-gray-300 pt-4 text-sm">&times;</span>
            <div className="flex-1">
              <label className="text-[9px] font-bold text-gray-400 uppercase tracking-widest">H (mm)</label>
              <input
                type="number"
                value={height}
                onChange={(e) => setDimensions(width, parseFloat(e.target.value) || 0)}
                className="w-full bg-gray-50 border border-gray-200 rounded-lg py-1.5 px-3 text-gray-900 focus:outline-none focus:ring-2 focus:ring-dk-blue/30 focus:border-dk-blue transition-all font-mono text-sm mt-1"
              />
            </div>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {PRESET_SIZES.map(s => {
              const isActive = width === s.w && height === s.h;
              return (
                <button
                  key={s.label}
                  onClick={() => setDimensions(s.w, s.h)}
                  className={`px-2 py-1 rounded-md text-[9px] font-bold transition-all ${
                    isActive
                      ? 'bg-dk-blue text-white'
                      : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                  }`}
                >
                  {s.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
