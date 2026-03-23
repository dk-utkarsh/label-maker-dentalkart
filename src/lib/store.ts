import { create } from 'zustand';
import { applyLayoutPreset } from './layouts';

export type FieldRole = 'title' | 'body' | 'footer' | 'hidden';
export type FontSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl' | 'auto';
export type Alignment = 'left' | 'center' | 'right';
export type LogoPosition = 'left' | 'center' | 'right';
export type CodeType = 'none' | 'barcode' | 'qr';

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

export interface LabelOverride {
  config?: FieldConfig[];
  barcodeField?: string;
  barcodeOrder?: number;
  barcodeSize?: number;
  codeType?: CodeType;
  bannerText?: string;
  logo?: string | null;
  logoPosition?: LogoPosition;
  logoSize?: number;
}

export interface SavedVariation {
  id: string;
  name: string;
  config: FieldConfig[];
  width: number;
  height: number;
  barcodeField: string;
  barcodeOrder: number;
  barcodeSize: number;
  codeType: CodeType;
  bannerText: string;
  logo: string | null;
  logoPosition: LogoPosition;
  logoSize: number;
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
  logoPosition: LogoPosition;
  logoSize: number;
  bannerText: string;
  barcodeField: string;
  barcodeOrder: number;
  barcodeSize: number;
  codeType: CodeType;
  topRule: boolean;
  activeLayout: string;
  savedVariations: SavedVariation[];
  labelOverrides: Record<number, LabelOverride>;
  editingLabelIdx: number | null; // null = global editing

  // Actions
  setDimensions: (w: number, h: number) => void;
  setData: (data: any[], columns: string[]) => void;
  setConfig: (config: FieldConfig[]) => void;
  updateField: (column: string, updates: Partial<FieldConfig>) => void;
  setPreviewIdx: (idx: number) => void;
  setLogo: (logo: string | null) => void;
  setLogoPosition: (pos: LogoPosition) => void;
  setLogoSize: (size: number) => void;
  setBannerText: (text: string) => void;
  setBarcodeField: (field: string) => void;
  setBarcodeOrder: (order: number) => void;
  setBarcodeSize: (size: number) => void;
  setCodeType: (type: CodeType) => void;
  reorderConfig: (from: number, to: number) => void;
  setTopRule: (v: boolean) => void;
  applyLayout: (presetId: string) => void;
  saveVariation: (name: string) => void;
  loadVariation: (id: string) => void;
  deleteVariation: (id: string) => void;
  fetchSavedVariations: () => Promise<void>;
  setEditingLabelIdx: (idx: number | null) => void;
  setLabelOverride: (idx: number, override: LabelOverride) => void;
  clearLabelOverride: (idx: number) => void;
  getEffectiveConfig: (idx: number) => {
    config: FieldConfig[];
    barcodeField: string;
    barcodeOrder: number;
    barcodeSize: number;
    codeType: CodeType;
    bannerText: string;
    logo: string | null;
    logoPosition: LogoPosition;
    logoSize: number;
  };
}

// Fetch saved variations from server
const fetchVariations = async (): Promise<SavedVariation[]> => {
  try {
    const res = await fetch('/api/variations');
    if (!res.ok) return [];
    return await res.json();
  } catch {
    return [];
  }
};

const persistVariation = async (variation: SavedVariation) => {
  try {
    await fetch('/api/variations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(variation),
    });
  } catch {
    // Network error
  }
};

const deleteVariationFromServer = async (id: string) => {
  try {
    await fetch('/api/variations', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    });
  } catch {
    // Network error
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
  logoPosition: 'left' as LogoPosition,
  logoSize: 100,
  bannerText: '',
  barcodeField: '',
  barcodeOrder: 0,
  barcodeSize: 100,
  codeType: 'barcode' as CodeType,
  topRule: false,
  activeLayout: 'custom',
  savedVariations: [],
  labelOverrides: {},
  editingLabelIdx: null,

  setDimensions: (width, height) => set({ width, height }),
  setData: (data, columns) => set({ data, columns, previewIdx: 0 }),
  setConfig: (config) => {
    const s = get();
    if (s.editingLabelIdx !== null) {
      const override = s.labelOverrides[s.editingLabelIdx] || {};
      set({ labelOverrides: { ...s.labelOverrides, [s.editingLabelIdx]: { ...override, config } } });
    } else {
      set({ config });
    }
  },
  updateField: (column, updates) => {
    const s = get();
    if (s.editingLabelIdx !== null) {
      const override = s.labelOverrides[s.editingLabelIdx] || {};
      const baseConfig = override.config ?? s.config;
      const newConfig = baseConfig.map(f => f.column === column ? { ...f, ...updates } : f);
      set({ labelOverrides: { ...s.labelOverrides, [s.editingLabelIdx]: { ...override, config: newConfig } } });
    } else {
      set((state) => ({
        config: state.config.map(f => f.column === column ? { ...f, ...updates } : f)
      }));
    }
  },
  setPreviewIdx: (previewIdx) => set({ previewIdx }),
  setLogo: (logo) => set({ logo }),
  setLogoPosition: (logoPosition) => set({ logoPosition }),
  setLogoSize: (logoSize) => set({ logoSize }),
  setBannerText: (bannerText) => {
    const s = get();
    if (s.editingLabelIdx !== null) {
      const override = s.labelOverrides[s.editingLabelIdx] || {};
      set({ labelOverrides: { ...s.labelOverrides, [s.editingLabelIdx]: { ...override, bannerText } } });
    } else {
      set({ bannerText });
    }
  },
  setBarcodeField: (barcodeField) => {
    const s = get();
    if (s.editingLabelIdx !== null) {
      const override = s.labelOverrides[s.editingLabelIdx] || {};
      set({ labelOverrides: { ...s.labelOverrides, [s.editingLabelIdx]: { ...override, barcodeField } } });
    } else {
      set({ barcodeField });
    }
  },
  setBarcodeOrder: (barcodeOrder) => {
    const s = get();
    if (s.editingLabelIdx !== null) {
      const override = s.labelOverrides[s.editingLabelIdx] || {};
      set({ labelOverrides: { ...s.labelOverrides, [s.editingLabelIdx]: { ...override, barcodeOrder } } });
    } else {
      set({ barcodeOrder });
    }
  },
  setBarcodeSize: (barcodeSize) => {
    const s = get();
    if (s.editingLabelIdx !== null) {
      const override = s.labelOverrides[s.editingLabelIdx] || {};
      set({ labelOverrides: { ...s.labelOverrides, [s.editingLabelIdx]: { ...override, barcodeSize } } });
    } else {
      set({ barcodeSize });
    }
  },
  setCodeType: (codeType) => {
    const s = get();
    if (s.editingLabelIdx !== null) {
      const override = s.labelOverrides[s.editingLabelIdx] || {};
      set({ labelOverrides: { ...s.labelOverrides, [s.editingLabelIdx]: { ...override, codeType } } });
    } else {
      set({ codeType });
    }
  },
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
      barcodeSize: s.barcodeSize,
      codeType: s.codeType,
      bannerText: s.bannerText,
      logo: s.logo,
      logoPosition: s.logoPosition,
      logoSize: s.logoSize,
      timestamp: Date.now(),
    };
    const updated = [...s.savedVariations, variation];
    set({ savedVariations: updated });
    persistVariation(variation);
  },

  loadVariation: (id) => {
    const v = get().savedVariations.find(v => v.id === id);
    if (!v) return;
    const s = get();

    // Map saved layout config onto current columns (don't change data)
    const newConfig = s.config.map(currentField => {
      // Find matching field from saved variation by column name
      const savedField = v.config.find(f => f.column === currentField.column);
      if (savedField) {
        // Apply saved styling but keep current column reference
        return { ...structuredClone(savedField) };
      }
      // Column doesn't exist in saved variation — keep as-is
      return currentField;
    });

    set({
      config: newConfig,
      // Keep current width/height (user's current label size)
      barcodeField: s.columns.includes(v.barcodeField) ? v.barcodeField : s.barcodeField,
      barcodeOrder: v.barcodeOrder,
      barcodeSize: v.barcodeSize ?? 100,
      bannerText: v.bannerText,
      logoPosition: v.logoPosition ?? s.logoPosition,
      // Keep user's current logo — don't overwrite with saved layout's logo
    });
  },

  deleteVariation: (id) => {
    const updated = get().savedVariations.filter(v => v.id !== id);
    set({ savedVariations: updated });
    deleteVariationFromServer(id);
  },

  fetchSavedVariations: async () => {
    const variations = await fetchVariations();
    set({ savedVariations: variations });
  },

  setEditingLabelIdx: (idx) => set({ editingLabelIdx: idx }),

  setLabelOverride: (idx, override) => set((state) => ({
    labelOverrides: { ...state.labelOverrides, [idx]: { ...state.labelOverrides[idx], ...override } },
  })),

  clearLabelOverride: (idx) => set((state) => {
    const updated = { ...state.labelOverrides };
    delete updated[idx];
    return { labelOverrides: updated };
  }),

  getEffectiveConfig: (idx) => {
    const s = get();
    const override = s.labelOverrides[idx];
    if (!override) {
      return {
        config: s.config,
        barcodeField: s.barcodeField,
        barcodeOrder: s.barcodeOrder,
        barcodeSize: s.barcodeSize,
        codeType: s.codeType,
        bannerText: s.bannerText,
        logo: s.logo,
        logoPosition: s.logoPosition,
        logoSize: s.logoSize,
      };
    }
    return {
      config: override.config ?? s.config,
      barcodeField: override.barcodeField ?? s.barcodeField,
      barcodeOrder: override.barcodeOrder ?? s.barcodeOrder,
      barcodeSize: override.barcodeSize ?? s.barcodeSize,
      codeType: override.codeType ?? s.codeType,
      bannerText: override.bannerText ?? s.bannerText,
      logo: override.logo !== undefined ? override.logo : s.logo,
      logoPosition: override.logoPosition ?? s.logoPosition,
      logoSize: override.logoSize ?? s.logoSize,
    };
  },
}));
