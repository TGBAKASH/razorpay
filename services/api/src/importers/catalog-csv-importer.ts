import { z } from 'zod';

export const MovementRateSchema = z.enum(['fast', 'normal', 'slow']);
export type MovementRate = z.infer<typeof MovementRateSchema>;

export const ProductCsvInputSchema = z.object({
  sku: z.string().min(1, 'SKU is required').trim(),
  name: z.string().min(1, 'Product name is required').trim(),
  category: z.string().min(1, 'Category is required').trim(),
  cost_paise: z.coerce.number().int().positive('Cost paise must be a positive integer'),
  list_price_paise: z.coerce.number().int().positive('List price paise must be a positive integer'),
  inventory_qty: z.coerce.number().int().nonnegative('Inventory quantity must be 0 or greater'),
  movement_rate: MovementRateSchema,
  expiry_date: z.union([z.string(), z.null(), z.undefined()]).transform((val) => {
    if (!val || typeof val !== 'string' || val.trim() === '') return null;
    const d = new Date(val);
    if (isNaN(d.getTime())) {
      throw new Error(`Invalid date format for expiry_date: ${val}`);
    }
    return d.toISOString();
  }),
  warehouse_location: z.string().min(1, 'Warehouse location is required').trim(),
  clearance_flag: z.union([z.boolean(), z.string(), z.undefined(), z.null()]).transform((val) => {
    if (typeof val === 'boolean') return val;
    if (!val) return false;
    const lower = String(val).toLowerCase().trim();
    return lower === 'true' || lower === '1' || lower === 'yes';
  }),
});

export interface ValidatedProductRow {
  sku: string;
  name: string;
  category: string;
  costPaise: number;
  listPricePaise: number;
  inventoryQty: number;
  movementRate: MovementRate;
  expiryDate: string | null;
  warehouseLocation: string;
  clearanceFlag: boolean;
}

export interface ImporterError {
  rowNumber: number;
  sku?: string;
  field?: string;
  message: string;
}

export interface CatalogImportResult {
  success: boolean;
  totalRows: number;
  validRows: ValidatedProductRow[];
  errors: ImporterError[];
}

/**
 * Parses CSV text into array of object records.
 * Handles quoted fields containing commas and trimmed values.
 */
export function parseCsvText(csvContent: string): Record<string, string>[] {
  const lines = csvContent
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  if (lines.length === 0) {
    return [];
  }

  const headerLine = lines[0];
  if (!headerLine) return [];
  const headers = splitCsvLine(headerLine).map((h) => h.toLowerCase().trim());
  const records: Record<string, string>[] = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    if (!line) continue;
    const values = splitCsvLine(line);
    const record: Record<string, string> = {};
    headers.forEach((header, index) => {
      record[header] = values[index]?.trim() ?? '';
    });
    records.push(record);
  }

  return records;
}

function splitCsvLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      result.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current);
  return result;
}

/**
 * Validates and transforms parsed catalog records into typed product objects.
 * Rejects rows with negative margin (list_price_paise < cost_paise) with clear descriptive error.
 */
export function importCatalogFromCsv(csvContent: string): CatalogImportResult {
  const records = parseCsvText(csvContent);
  const validRows: ValidatedProductRow[] = [];
  const errors: ImporterError[] = [];

  records.forEach((record, index) => {
    const rowNumber = index + 2; // +1 for 1-based, +1 for header line

    // Allow flexible column naming (e.g. cost_inr -> cost_paise conversion if provided)
    let costPaise = record['cost_paise'];
    if (!costPaise && record['cost_inr']) {
      costPaise = String(Math.round(parseFloat(record['cost_inr']) * 100));
    }

    let listPricePaise = record['list_price_paise'];
    if (!listPricePaise && record['list_price_inr']) {
      listPricePaise = String(Math.round(parseFloat(record['list_price_inr']) * 100));
    }

    const rawRow = {
      sku: record['sku'] || '',
      name: record['name'] || '',
      category: record['category'] || '',
      cost_paise: costPaise,
      list_price_paise: listPricePaise,
      inventory_qty: record['inventory_qty'],
      movement_rate: record['movement_rate'],
      expiry_date: record['expiry_date'] || null,
      warehouse_location: record['warehouse_location'] || '',
      clearance_flag: record['clearance_flag'] ?? false,
    };

    const parsed = ProductCsvInputSchema.safeParse(rawRow);

    if (!parsed.success) {
      parsed.error.errors.forEach((err) => {
        errors.push({
          rowNumber,
          sku: rawRow.sku || undefined,
          field: err.path.join('.'),
          message: `Row ${rowNumber}: ${err.message}`,
        });
      });
      return;
    }

    const data = parsed.data;

    // Strict Negative Margin Invariant Check
    if (data.list_price_paise < data.cost_paise) {
      const costInr = (data.cost_paise / 100).toFixed(2);
      const listInr = (data.list_price_paise / 100).toFixed(2);
      errors.push({
        rowNumber,
        sku: data.sku,
        field: 'list_price_paise',
        message: `Row ${rowNumber}: Negative margin prohibited. SKU "${data.sku}" has list price (₹${listInr} = ${data.list_price_paise} paise) lower than cost price (₹${costInr} = ${data.cost_paise} paise).`,
      });
      return;
    }

    validRows.push({
      sku: data.sku,
      name: data.name,
      category: data.category,
      costPaise: data.cost_paise,
      listPricePaise: data.list_price_paise,
      inventoryQty: data.inventory_qty,
      movementRate: data.movement_rate,
      expiryDate: data.expiry_date,
      warehouseLocation: data.warehouse_location,
      clearanceFlag: data.clearance_flag,
    });
  });

  return {
    success: errors.length === 0,
    totalRows: records.length,
    validRows,
    errors,
  };
}
