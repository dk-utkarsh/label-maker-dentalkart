import { create } from 'zustand';
import { applyLayoutPreset } from './layouts';

export type FieldRole = 'title' | 'body' | 'footer' | 'hidden';
export type FontSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl' | 'auto';
export type Alignment = 'left' | 'center' | 'right';

export interface FieldConfig {
  column: string;
  role: FieldRole;
  fontSize: FontSize;
  align: Alignment;
  bold: boolean;
  uppercase: boolean;
  showLabel: boolean;
  prefix: string;
  suffix: string;
  sameRow: boolean;
  border: boolean;
}

export interface SavedVariation {
  id: string;
  name: string;
  config: FieldConfig[];
  width: number;
  height: number;
  barcodeField: string;
  barcodeOrder: number;
  bannerText: string;
  logo: string | null;
  timestamp: number;
}

interface LabelState {
  width: number;
  height: number;
  data: any[];
  columns: string[];
  config: FieldConfig[];
  previewIdx: number;
  logo: string | null;
  bannerText: string;
  barcodeField: string;
  barcodeOrder: number;
  topRule: boolean;
  activeLayout: string;
  savedVariations: SavedVariation[];

  // Actions
  setDimensions: (w: number, h: number) => void;
  setData: (data: any[], columns: string[]) => void;
  setConfig: (config: FieldConfig[]) => void;
  updateField: (column: string, updates: Partial<FieldConfig>) => void;
  setPreviewIdx: (idx: number) => void;
  setLogo: (logo: string | null) => void;
  setBannerText: (text: string) => void;
  setBarcodeField: (field: string) => void;
  setBarcodeOrder: (order: number) => void;
  reorderConfig: (from: number, to: number) => void;
  setTopRule: (v: boolean) => void;
  applyLayout: (presetId: string) => void;
  saveVariation: (name: string) => void;
  loadVariation: (id: string) => void;
  deleteVariation: (id: string) => void;
}

// Load saved variations from localStorage
const loadSavedVariations = (): SavedVariation[] => {
  if (typeof window === 'undefined') return [];
  try {
    const stored = localStorage.getItem('label-saved-variations');
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
};

const persistVariations = (variations: SavedVariation[]) => {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem('label-saved-variations', JSON.stringify(variations));
  } catch {
    // localStorage full or unavailable
  }
};

export const useStore = create<LabelState>((set, get) => ({
  width: 62,
  height: 100,
  data: [],
  columns: [],
  config: [],
  previewIdx: 0,
  logo: null,
  bannerText: '',
  barcodeField: '',
  barcodeOrder: 0,
  topRule: false,
  activeLayout: 'custom',
  savedVariations: loadSavedVariations(),

  setDimensions: (width, height) => set({ width, height }),
  setData: (data, columns) => set({ data, columns, previewIdx: 0 }),
  setConfig: (config) => set({ config }),
  updateField: (column, updates) => set((state) => ({
    config: state.config.map(f => f.column === column ? { ...f, ...updates } : f)
  })),
  setPreviewIdx: (previewIdx) => set({ previewIdx }),
  setLogo: (logo) => set({ logo }),
  setBannerText: (bannerText) => set({ bannerText }),
  setBarcodeField: (barcodeField) => set({ barcodeField }),
  setBarcodeOrder: (barcodeOrder) => set({ barcodeOrder }),
  reorderConfig: (from, to) => set((state) => {
    const newConfig = [...state.config];
    const [moved] = newConfig.splice(from, 1);
    newConfig.splice(to, 0, moved);
    return { config: newConfig };
  }),
  setTopRule: (topRule) => set({ topRule }),
  applyLayout: (presetId) => {
    const s = get();
    if (!s.columns.length) return;
    const result = applyLayoutPreset(presetId, s.columns);
    if (!result) return;
    set({
      config: result.config,
      barcodeField: result.barcodeField,
      barcodeOrder: result.barcodeOrder,
      bannerText: result.bannerText,
      topRule: result.topRule,
      activeLayout: presetId,
    });
  },

  saveVariation: (name: string) => {
    const s = get();
    const variation: SavedVariation = {
      id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      name: name || `Variation ${s.savedVariations.length + 1}`,
      config: structuredClone(s.config),
      width: s.width,
      height: s.height,
      barcodeField: s.barcodeField,
      barcodeOrder: s.barcodeOrder,
      bannerText: s.bannerText,
      logo: s.logo,
      timestamp: Date.now(),
    };
    const updated = [...s.savedVariations, variation];
    persistVariations(updated);
    set({ savedVariations: updated });
  },

  loadVariation: (id) => {
    const v = get().savedVariations.find(v => v.id === id);
    if (!v) return;
    set({
      config: structuredClone(v.config),
      width: v.width,
      height: v.height,
      barcodeField: v.barcodeField,
      barcodeOrder: v.barcodeOrder,
      bannerText: v.bannerText,
      logo: v.logo,
    });
  },

  deleteVariation: (id) => {
    const updated = get().savedVariations.filter(v => v.id !== id);
    persistVariations(updated);
    set({ savedVariations: updated });
  },
}));
