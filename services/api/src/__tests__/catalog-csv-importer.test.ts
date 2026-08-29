import { describe, it, expect } from 'vitest';
import { importCatalogFromCsv, parseCsvText } from '../importers/catalog-csv-importer.js';

describe('Catalog CSV Importer', () => {
  it('successfully parses valid catalog CSV including SprintPro X2', () => {
    const csvContent = `sku,name,category,cost_paise,list_price_paise,inventory_qty,movement_rate,expiry_date,warehouse_location,clearance_flag
SPRINTPRO-X2,SprintPro X2 Running Shoes,Footwear,265000,429900,41,slow,,BLR-WH-01,false
GIFTBOX-CORP-A,Corporate Executive Gift Box,Gifts,2200000,3200000,50,normal,2026-12-31,BLR-WH-01,false`;

    const result = importCatalogFromCsv(csvContent);

    expect(result.success).toBe(true);
    expect(result.errors).toHaveLength(0);
    expect(result.validRows).toHaveLength(2);

    const sprintPro = result.validRows[0];
    expect(sprintPro).toBeDefined();
    expect(sprintPro?.sku).toBe('SPRINTPRO-X2');
    expect(sprintPro?.name).toBe('SprintPro X2 Running Shoes');
    expect(sprintPro?.costPaise).toBe(265000);
    expect(sprintPro?.listPricePaise).toBe(429900);
    expect(sprintPro?.inventoryQty).toBe(41);
    expect(sprintPro?.movementRate).toBe('slow');
    expect(sprintPro?.warehouseLocation).toBe('BLR-WH-01');
    expect(sprintPro?.clearanceFlag).toBe(false);
  });

  it('rejects rows with negative margin (list price < cost price) with a clear error', () => {
    const csvContent = `sku,name,category,cost_paise,list_price_paise,inventory_qty,movement_rate,expiry_date,warehouse_location,clearance_flag
LOSS-LEADER-01,Subsidized Item,Electronics,500000,350000,10,normal,,BLR-WH-01,false`;

    const result = importCatalogFromCsv(csvContent);

    expect(result.success).toBe(false);
    expect(result.validRows).toHaveLength(0);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]?.sku).toBe('LOSS-LEADER-01');
    expect(result.errors[0]?.message).toContain('Negative margin prohibited');
    expect(result.errors[0]?.message).toContain('LOSS-LEADER-01');
    expect(result.errors[0]?.message).toContain('500000 paise');
  });

  it('rejects rows with invalid movement rate', () => {
    const csvContent = `sku,name,category,cost_paise,list_price_paise,inventory_qty,movement_rate,expiry_date,warehouse_location,clearance_flag
INVALID-RATE-01,Test Item,Apparel,10000,20000,5,lightning_fast,,BLR-WH-01,false`;

    const result = importCatalogFromCsv(csvContent);

    expect(result.success).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.errors[0]?.message).toContain('Invalid enum value');
  });

  it('supports INR decimal columns by converting to integer paise', () => {
    const csvContent = `sku,name,category,cost_inr,list_price_inr,inventory_qty,movement_rate,expiry_date,warehouse_location,clearance_flag
DECIMAL-INR-01,Decimal Item,Accessories,26.50,42.99,10,fast,,DEL-WH-01,true`;

    const result = importCatalogFromCsv(csvContent);

    expect(result.success).toBe(true);
    expect(result.validRows[0]?.costPaise).toBe(2650);
    expect(result.validRows[0]?.listPricePaise).toBe(4299);
    expect(result.validRows[0]?.clearanceFlag).toBe(true);
  });

  it('handles CSV text with quoted values containing commas', () => {
    const csvContent = `sku,name,category,cost_paise,list_price_paise,inventory_qty,movement_rate,expiry_date,warehouse_location,clearance_flag
"SKU-COMMA-01","Shoes, Special Edition","Footwear, Men",100000,150000,20,normal,,BLR-WH-01,false`;

    const records = parseCsvText(csvContent);
    expect(records).toHaveLength(1);
    expect(records[0]?.['name']).toBe('Shoes, Special Edition');
    expect(records[0]?.['category']).toBe('Footwear, Men');
  });
});
