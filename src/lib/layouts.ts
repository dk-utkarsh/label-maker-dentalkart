import { type FieldConfig } from './store';

export interface LayoutPreset {
  id: string;
  name: string;
  description: string;
}

export const LAYOUT_PRESETS: LayoutPreset[] = [
  {
    id: 'dentalkart-standard',
    name: 'Dentalkart Standard',
    description: 'Title, barcode, SKU, two-column grid, footer, banner',
  },
  {
    id: 'simple',
    name: 'Simple Label',
    description: 'Clean layout — title, body fields, footer',
  },
  {
    id: 'compact',
    name: 'Compact',
    description: 'Dense two-column layout for small labels',
  },
  {
    id: 'pharmacy',
    name: 'Pharmacy',
    description: 'Drug-fact box with composition, dosage, and warning sections',
  },
  {
    id: 'shipping',
    name: 'Shipping',
    description: 'Box label — large barcode, address, product info',
  },
  {
    id: 'shelf-tag',
    name: 'Shelf Tag',
    description: 'Retail price tag with large MRP and product summary',
  },
  {
    id: 'compliance',
    name: 'Compliance',
    description: 'Regulatory-heavy with license numbers and legal blocks',
  },
  {
    id: 'warehouse',
    name: 'Warehouse',
    description: 'Inventory label — oversized barcode, SKU, bin location',
  },
];

const nameHint = (col: string, keywords: string[]) => {
  const lower = col.toLowerCase().replace(/[^a-z0-9]/g, '');
  return keywords.some(kw => lower.includes(kw));
};

export function applyLayoutPreset(
  presetId: string,
  columns: string[],
) {
  switch (presetId) {
    case 'dentalkart-standard': return applyDentalkart(columns);
    case 'simple': return applySimple(columns);
    case 'compact': return applyCompact(columns);
    case 'pharmacy': return applyPharmacy(columns);
    case 'shipping': return applyShipping(columns);
    case 'shelf-tag': return applyShelfTag(columns);
    case 'compliance': return applyCompliance(columns);
    case 'warehouse': return applyWarehouse(columns);
    default: return null;
  }
}

/* ─── Dentalkart Standard ─── */

function applyDentalkart(columns: string[]) {
  const titleKeys = ['product', 'name', 'item', 'description', 'title'];
  const skuKeys = ['sku', 'article'];
  const barcodeKeys = ['barcode', 'ean', 'upc', 'code', 'sku'];
  const gridKeys = ['lot', 'batch', 'mfg', 'exp', 'date', 'pack', 'size', 'mrp', 'price', 'qty', 'quantity', 'weight', 'unit'];
  const footerKeys = ['imported', 'marketed', 'manufactured', 'address', 'lic', 'license', 'ref', 'customer', 'helpline', 'email', 'phone', 'company'];

  const titles: string[] = [];
  const skus: string[] = [];
  const grid: string[] = [];
  const footers: string[] = [];
  const rest: string[] = [];

  columns.forEach(col => {
    if (nameHint(col, titleKeys)) titles.push(col);
    else if (nameHint(col, skuKeys)) skus.push(col);
    else if (nameHint(col, footerKeys)) footers.push(col);
    else if (nameHint(col, gridKeys)) grid.push(col);
    else rest.push(col);
  });

  if (titles.length === 0 && grid.length === 0 && footers.length === 0) {
    return applyDentalkartPositional(columns);
  }

  if (titles.length === 0 && rest.length > 0) {
    titles.push(rest.shift()!);
  }

  const config: FieldConfig[] = [];

  titles.forEach(col => {
    config.push(makeField(col, 'title', { fontSize: 'xl', align: 'center', fontWeight: '700', uppercase: true }));
  });

  skus.forEach(col => {
    config.push(makeField(col, 'body', { fontSize: 'md', align: 'center', fontWeight: '700', showLabel: true }));
  });

  grid.forEach((col, i) => {
    config.push(makeField(col, 'body', {
      fontSize: 'sm',
      align: 'left',
      fontWeight: '400',
      uppercase: true,
      showLabel: true,
      sameRow: i % 2 === 1,
      border: true,
    }));
  });

  rest.forEach(col => {
    config.push(makeField(col, 'body', { fontSize: 'sm', showLabel: true }));
  });

  footers.forEach(col => {
    config.push(makeField(col, 'footer', { fontSize: 'xs', showLabel: true }));
  });

  const barcodeField = columns.find(c => nameHint(c, barcodeKeys)) || skus[0] || '';

  return {
    config,
    barcodeField,
    barcodeOrder: titles.length,
    bannerText: 'FOR DENTAL PROFESSIONAL USE ONLY',
    topRule: true,
  };
}

function applyDentalkartPositional(columns: string[]) {
  const n = columns.length;
  const titleCount = Math.min(2, Math.max(1, Math.ceil(n * 0.1)));
  const footerCount = Math.min(3, Math.max(1, Math.floor(n * 0.2)));
  const bodyStart = titleCount;
  const bodyEnd = n - footerCount;

  const config: FieldConfig[] = columns.map((col, i) => {
    if (i < titleCount) {
      return makeField(col, 'title', { fontSize: 'xl', align: 'center', fontWeight: '700', uppercase: true });
    }
    if (i >= bodyEnd) {
      return makeField(col, 'footer', { fontSize: 'xs', showLabel: true });
    }
    const bodyIdx = i - bodyStart;
    return makeField(col, 'body', {
      fontSize: 'sm',
      uppercase: true,
      showLabel: true,
      sameRow: bodyIdx % 2 === 1,
      border: true,
    });
  });

  return {
    config,
    barcodeField: columns[0] || '',
    barcodeOrder: titleCount,
    bannerText: 'FOR DENTAL PROFESSIONAL USE ONLY',
    topRule: true,
  };
}

/* ─── Simple ─── */

function applySimple(columns: string[]) {
  const n = columns.length;
  const config: FieldConfig[] = columns.map((col, i) => {
    if (i === 0) return makeField(col, 'title', { fontSize: 'lg', align: 'center', fontWeight: '700', uppercase: true });
    if (i >= n - 2 && n > 3) return makeField(col, 'footer', { fontSize: 'xs', showLabel: true });
    return makeField(col, 'body', { fontSize: 'md', showLabel: true });
  });

  return { config, barcodeField: '', barcodeOrder: 1, bannerText: '', topRule: false };
}

/* ─── Compact ─── */

function applyCompact(columns: string[]) {
  const config: FieldConfig[] = columns.map((col, i) => {
    if (i === 0) return makeField(col, 'title', { fontSize: 'md', fontWeight: '700', uppercase: true });
    return makeField(col, 'body', {
      fontSize: 'xs',
      showLabel: true,
      sameRow: i % 2 === 0,
    });
  });

  return { config, barcodeField: '', barcodeOrder: 1, bannerText: '', topRule: false };
}

/* ─── Pharmacy ─── */

function applyPharmacy(columns: string[]) {
  const titleKeys = ['product', 'name', 'item', 'description', 'title', 'drug', 'medicine'];
  const compositionKeys = ['composition', 'ingredient', 'formula', 'content', 'active', 'salt', 'generic'];
  const dosageKeys = ['dosage', 'dose', 'direction', 'use', 'usage', 'application', 'instruction', 'method', 'route'];
  const warningKeys = ['warning', 'caution', 'precaution', 'side', 'effect', 'contraindication', 'allergy', 'interaction'];
  const storageKeys = ['storage', 'store', 'condition', 'temperature', 'shelf', 'keep'];
  const dateKeys = ['mfg', 'exp', 'date', 'batch', 'lot', 'manufacture', 'expiry'];
  const footerKeys = ['manufactured', 'marketed', 'imported', 'address', 'license', 'lic', 'phone', 'email', 'helpline', 'company'];
  const barcodeKeys = ['barcode', 'ean', 'upc', 'code', 'sku'];

  const titles: string[] = [];
  const compositions: string[] = [];
  const dosages: string[] = [];
  const warnings: string[] = [];
  const storages: string[] = [];
  const dates: string[] = [];
  const footers: string[] = [];
  const rest: string[] = [];

  columns.forEach(col => {
    if (nameHint(col, titleKeys)) titles.push(col);
    else if (nameHint(col, compositionKeys)) compositions.push(col);
    else if (nameHint(col, dosageKeys)) dosages.push(col);
    else if (nameHint(col, warningKeys)) warnings.push(col);
    else if (nameHint(col, storageKeys)) storages.push(col);
    else if (nameHint(col, dateKeys)) dates.push(col);
    else if (nameHint(col, footerKeys)) footers.push(col);
    else rest.push(col);
  });

  if (titles.length === 0 && rest.length > 0) titles.push(rest.shift()!);

  const config: FieldConfig[] = [];

  titles.forEach(col => {
    config.push(makeField(col, 'title', { fontSize: 'lg', align: 'center', fontWeight: '700', uppercase: true }));
  });

  // Composition in bordered section
  compositions.forEach(col => {
    config.push(makeField(col, 'body', { fontSize: 'sm', showLabel: true, fontWeight: '700', border: true }));
  });

  // Dosage/directions
  dosages.forEach(col => {
    config.push(makeField(col, 'body', { fontSize: 'sm', showLabel: true }));
  });

  // Dates in bordered grid
  dates.forEach((col, i) => {
    config.push(makeField(col, 'body', {
      fontSize: 'sm', showLabel: true, uppercase: true,
      sameRow: i % 2 === 1, border: true,
    }));
  });

  // Warnings
  warnings.forEach(col => {
    config.push(makeField(col, 'body', { fontSize: 'xs', showLabel: true, fontWeight: '700' }));
  });

  // Storage
  storages.forEach(col => {
    config.push(makeField(col, 'body', { fontSize: 'xs', showLabel: true }));
  });

  // Remaining body fields
  rest.forEach(col => {
    config.push(makeField(col, 'body', { fontSize: 'sm', showLabel: true }));
  });

  footers.forEach(col => {
    config.push(makeField(col, 'footer', { fontSize: 'xs', showLabel: true }));
  });

  const barcodeField = columns.find(c => nameHint(c, barcodeKeys)) || '';

  return {
    config,
    barcodeField,
    barcodeOrder: titles.length,
    bannerText: 'SCHEDULE H — FOR DENTAL PROFESSIONAL USE ONLY',
    topRule: true,
  };
}

/* ─── Shipping ─── */

function applyShipping(columns: string[]) {
  const titleKeys = ['product', 'name', 'item', 'description', 'title'];
  const addressKeys = ['address', 'ship', 'consignee', 'destination', 'origin', 'receiver', 'sender', 'contact', 'city', 'state', 'pin', 'zip', 'country', 'to', 'from'];
  const weightKeys = ['weight', 'dimension', 'size', 'volume', 'gross', 'net', 'tare', 'length', 'width', 'height'];
  const handlingKeys = ['handling', 'fragile', 'instruction', 'special', 'care', 'hazard'];
  const skuKeys = ['sku', 'article', 'model', 'ref', 'order', 'po', 'invoice'];
  const qtyKeys = ['qty', 'quantity', 'units', 'pieces', 'count', 'carton', 'box'];
  const barcodeKeys = ['barcode', 'ean', 'upc', 'code', 'tracking'];

  const titles: string[] = [];
  const addresses: string[] = [];
  const weights: string[] = [];
  const handlings: string[] = [];
  const skus: string[] = [];
  const qtys: string[] = [];
  const rest: string[] = [];

  columns.forEach(col => {
    if (nameHint(col, titleKeys)) titles.push(col);
    else if (nameHint(col, addressKeys)) addresses.push(col);
    else if (nameHint(col, weightKeys)) weights.push(col);
    else if (nameHint(col, handlingKeys)) handlings.push(col);
    else if (nameHint(col, skuKeys)) skus.push(col);
    else if (nameHint(col, qtyKeys)) qtys.push(col);
    else rest.push(col);
  });

  if (titles.length === 0 && rest.length > 0) titles.push(rest.shift()!);

  const config: FieldConfig[] = [];

  // Product name — large
  titles.forEach(col => {
    config.push(makeField(col, 'title', { fontSize: 'xl', align: 'center', fontWeight: '700', uppercase: true }));
  });

  // SKU/Order reference
  skus.forEach(col => {
    config.push(makeField(col, 'body', { fontSize: 'md', align: 'center', fontWeight: '700', showLabel: true }));
  });

  // Quantity
  qtys.forEach(col => {
    config.push(makeField(col, 'body', { fontSize: 'lg', fontWeight: '700', showLabel: true, border: true }));
  });

  // Address block
  addresses.forEach(col => {
    config.push(makeField(col, 'body', { fontSize: 'sm', showLabel: true }));
  });

  // Weight/Dimensions in bordered grid
  weights.forEach((col, i) => {
    config.push(makeField(col, 'body', {
      fontSize: 'sm', showLabel: true, uppercase: true,
      sameRow: i % 2 === 1, border: true,
    }));
  });

  // Remaining fields
  rest.forEach(col => {
    config.push(makeField(col, 'body', { fontSize: 'sm', showLabel: true }));
  });

  // Handling instructions as footer
  handlings.forEach(col => {
    config.push(makeField(col, 'footer', { fontSize: 'xs', showLabel: true, fontWeight: '700', uppercase: true }));
  });

  const barcodeField = columns.find(c => nameHint(c, barcodeKeys)) || skus[0] || '';

  return {
    config,
    barcodeField,
    barcodeOrder: titles.length + skus.length,
    bannerText: '',
    topRule: true,
  };
}

/* ─── Shelf Tag ─── */

function applyShelfTag(columns: string[]) {
  const titleKeys = ['product', 'name', 'item', 'description', 'title'];
  const priceKeys = ['mrp', 'price', 'cost', 'rate', 'selling', 'offer', 'discount'];
  const sizeKeys = ['pack', 'size', 'unit', 'quantity', 'weight', 'volume', 'ml', 'gm', 'mg'];
  const skuKeys = ['sku', 'article', 'model', 'ref', 'id'];
  const barcodeKeys = ['barcode', 'ean', 'upc', 'code'];

  const titles: string[] = [];
  const prices: string[] = [];
  const sizes: string[] = [];
  const skus: string[] = [];
  const rest: string[] = [];

  columns.forEach(col => {
    if (nameHint(col, priceKeys)) prices.push(col);
    else if (nameHint(col, titleKeys)) titles.push(col);
    else if (nameHint(col, sizeKeys)) sizes.push(col);
    else if (nameHint(col, skuKeys)) skus.push(col);
    else rest.push(col);
  });

  if (titles.length === 0 && rest.length > 0) titles.push(rest.shift()!);

  const config: FieldConfig[] = [];

  // Product name
  titles.forEach(col => {
    config.push(makeField(col, 'title', { fontSize: 'lg', align: 'center', fontWeight: '700' }));
  });

  // PRICE — huge, centered, bold
  prices.forEach(col => {
    config.push(makeField(col, 'body', {
      fontSize: 'xl', align: 'center', fontWeight: '700', showLabel: true,
      prefix: '\u20B9 ',
    }));
  });

  // Pack size / quantity
  sizes.forEach(col => {
    config.push(makeField(col, 'body', { fontSize: 'md', align: 'center', showLabel: true }));
  });

  // Remaining fields
  rest.forEach(col => {
    config.push(makeField(col, 'body', { fontSize: 'sm', showLabel: true, align: 'center' }));
  });

  // SKU as footer
  skus.forEach(col => {
    config.push(makeField(col, 'footer', { fontSize: 'xs', align: 'center', showLabel: true }));
  });

  const barcodeField = columns.find(c => nameHint(c, barcodeKeys)) || skus[0] || '';

  return {
    config,
    barcodeField,
    barcodeOrder: config.length,
    bannerText: '',
    topRule: false,
  };
}

/* ─── Compliance ─── */

function applyCompliance(columns: string[]) {
  const titleKeys = ['product', 'name', 'item', 'description', 'title'];
  const licenseKeys = ['license', 'lic', 'registration', 'reg', 'approval', 'certification', 'cert', 'fssai', 'bis', 'iso', 'gmp', 'who', 'cdsco', 'dcgi'];
  const mfgKeys = ['manufactured', 'manufacturer', 'mfg', 'maker', 'producer', 'plant', 'factory'];
  const importKeys = ['imported', 'importer', 'distributor', 'marketed', 'marketer', 'supplier', 'trader'];
  const addressKeys = ['address', 'location', 'city', 'state', 'pin', 'country', 'contact', 'phone', 'email', 'helpline', 'web', 'fax'];
  const dateKeys = ['mfg', 'exp', 'date', 'batch', 'lot', 'manufacture', 'expiry'];
  const barcodeKeys = ['barcode', 'ean', 'upc', 'code', 'sku'];

  const titles: string[] = [];
  const licenses: string[] = [];
  const mfgs: string[] = [];
  const imports: string[] = [];
  const addresses: string[] = [];
  const dates: string[] = [];
  const rest: string[] = [];

  columns.forEach(col => {
    if (nameHint(col, titleKeys)) titles.push(col);
    else if (nameHint(col, licenseKeys)) licenses.push(col);
    else if (nameHint(col, importKeys)) imports.push(col);
    else if (nameHint(col, mfgKeys)) mfgs.push(col);
    else if (nameHint(col, addressKeys)) addresses.push(col);
    else if (nameHint(col, dateKeys)) dates.push(col);
    else rest.push(col);
  });

  if (titles.length === 0 && rest.length > 0) titles.push(rest.shift()!);

  const config: FieldConfig[] = [];

  titles.forEach(col => {
    config.push(makeField(col, 'title', { fontSize: 'lg', align: 'center', fontWeight: '700', uppercase: true }));
  });

  // License/certification fields — bordered grid
  licenses.forEach((col, i) => {
    config.push(makeField(col, 'body', {
      fontSize: 'sm', showLabel: true, fontWeight: '700', uppercase: true,
      sameRow: i % 2 === 1, border: true,
    }));
  });

  // Date fields — bordered grid
  dates.forEach((col, i) => {
    config.push(makeField(col, 'body', {
      fontSize: 'sm', showLabel: true, uppercase: true,
      sameRow: i % 2 === 1, border: true,
    }));
  });

  // Manufacturer info
  mfgs.forEach(col => {
    config.push(makeField(col, 'body', { fontSize: 'sm', showLabel: true, fontWeight: '700' }));
  });

  // Importer/marketer info
  imports.forEach(col => {
    config.push(makeField(col, 'body', { fontSize: 'sm', showLabel: true }));
  });

  // Remaining fields
  rest.forEach(col => {
    config.push(makeField(col, 'body', { fontSize: 'sm', showLabel: true }));
  });

  // Address and contact as footer
  addresses.forEach(col => {
    config.push(makeField(col, 'footer', { fontSize: 'xs', showLabel: true }));
  });

  const barcodeField = columns.find(c => nameHint(c, barcodeKeys)) || '';

  return {
    config,
    barcodeField,
    barcodeOrder: titles.length,
    bannerText: 'FOR DENTAL PROFESSIONAL USE ONLY',
    topRule: true,
  };
}

/* ─── Warehouse ─── */

function applyWarehouse(columns: string[]) {
  const titleKeys = ['product', 'name', 'item', 'description', 'title'];
  const skuKeys = ['sku', 'article', 'model', 'ref', 'id', 'code', 'part'];
  const locationKeys = ['bin', 'location', 'rack', 'shelf', 'zone', 'aisle', 'bay', 'warehouse', 'section', 'row'];
  const qtyKeys = ['qty', 'quantity', 'stock', 'count', 'pieces', 'units', 'available', 'onhand'];
  const batchKeys = ['batch', 'lot', 'serial'];
  const dateKeys = ['mfg', 'exp', 'date', 'received', 'inward', 'manufacture', 'expiry'];
  const barcodeKeys = ['barcode', 'ean', 'upc', 'code'];

  const titles: string[] = [];
  const skus: string[] = [];
  const locations: string[] = [];
  const qtys: string[] = [];
  const batches: string[] = [];
  const dates: string[] = [];
  const rest: string[] = [];

  columns.forEach(col => {
    if (nameHint(col, skuKeys)) skus.push(col);
    else if (nameHint(col, titleKeys)) titles.push(col);
    else if (nameHint(col, locationKeys)) locations.push(col);
    else if (nameHint(col, qtyKeys)) qtys.push(col);
    else if (nameHint(col, batchKeys)) batches.push(col);
    else if (nameHint(col, dateKeys)) dates.push(col);
    else rest.push(col);
  });

  const config: FieldConfig[] = [];

  // SKU as primary title — largest text
  skus.forEach(col => {
    config.push(makeField(col, 'title', { fontSize: 'xl', align: 'center', fontWeight: '700', uppercase: true, showLabel: true }));
  });

  // Product name — secondary title
  titles.forEach(col => {
    config.push(makeField(col, 'body', { fontSize: 'lg', align: 'center', fontWeight: '700' }));
  });

  // Location — prominent, bordered
  locations.forEach(col => {
    config.push(makeField(col, 'body', { fontSize: 'lg', fontWeight: '700', showLabel: true, border: true, uppercase: true }));
  });

  // Quantity — prominent, bordered
  qtys.forEach(col => {
    config.push(makeField(col, 'body', { fontSize: 'lg', fontWeight: '700', showLabel: true, border: true }));
  });

  // Batch/Lot — bordered grid
  batches.forEach((col, i) => {
    config.push(makeField(col, 'body', {
      fontSize: 'sm', showLabel: true, uppercase: true,
      sameRow: i % 2 === 1, border: true,
    }));
  });

  // Dates — bordered grid
  dates.forEach((col, i) => {
    config.push(makeField(col, 'body', {
      fontSize: 'sm', showLabel: true, uppercase: true,
      sameRow: i % 2 === 1, border: true,
    }));
  });

  // Remaining fields as footer
  rest.forEach(col => {
    config.push(makeField(col, 'footer', { fontSize: 'xs', showLabel: true }));
  });

  const barcodeField = columns.find(c => nameHint(c, barcodeKeys)) || skus[0] || '';

  return {
    config,
    barcodeField,
    barcodeOrder: skus.length,
    bannerText: '',
    topRule: true,
  };
}

/* ─── Helpers ─── */

function makeField(
  column: string,
  role: FieldConfig['role'],
  overrides: Partial<Omit<FieldConfig, 'column' | 'role'>> = {},
): FieldConfig {
  return {
    column,
    role,
    fontSize: 'md',
    align: 'left',
    fontWeight: '400',
    fontFamily: '',
    uppercase: false,
    showLabel: false,
    prefix: '',
    suffix: '',
    sameRow: false,
    border: false,
    ...overrides,
  } as FieldConfig;
}
