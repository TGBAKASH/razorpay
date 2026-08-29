import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { SEED_MERCHANTS } from '../../../../prisma/seed-data.js';
import { importCatalogFromCsv } from '../importers/catalog-csv-importer.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('Seed Data & Catalog Integrity Verification', () => {
  it('contains SprintPro X2 SKU with exact specification values', () => {
    const sprintMerchant = SEED_MERCHANTS.find((m) => m.slug === 'sprint-athletics');
    expect(sprintMerchant).toBeDefined();

    const sprintPro = sprintMerchant?.products.find((p) => p.sku === 'SPRINTPRO-X2');
    expect(sprintPro).toBeDefined();

    // Verify exact seeded values from the brief:
    // Cost: ₹2,650 (265,000 paise)
    // List: ₹4,299 (429,900 paise)
    // Inventory: 41 units
    // Movement: slow
    expect(sprintPro?.costPaise).toBe(265000);
    expect(sprintPro?.listPricePaise).toBe(429900);
    expect(sprintPro?.inventoryQty).toBe(41);
    expect(sprintPro?.movementRate).toBe('slow');
    expect(sprintPro?.warehouseLocation).toBe('BLR-WH-01');
    expect(sprintPro?.clearanceFlag).toBe(false);

    // Verify policy parameters:
    expect(sprintMerchant?.policy.policyVersion).toBe('v1');
    expect(sprintMerchant?.policy.minMarginPct).toBe(18.0);
    expect(sprintMerchant?.policy.maxDiscountPct).toBe(12.0);
    expect(sprintMerchant?.policy.freeDeliveryAbovePaise).toBe(149900);
    expect(sprintMerchant?.policy.noDiscountFastMoving).toBe(true);
    expect(sprintMerchant?.policy.clearWithinDays).toBe(30);
    expect(sprintMerchant?.policy.humanApprovalAbovePaise).toBe(1500000);
  });

  it('contains complete 3-merchant auction gift box dataset (Merchants A, B, C)', () => {
    const merchantA = SEED_MERCHANTS.find((m) => m.slug === 'merchant-a-crafts');
    const merchantB = SEED_MERCHANTS.find((m) => m.slug === 'merchant-b-quickship');
    const merchantC = SEED_MERCHANTS.find((m) => m.slug === 'merchant-c-elite');

    expect(merchantA).toBeDefined();
    expect(merchantB).toBeDefined();
    expect(merchantC).toBeDefined();

    const prodA = merchantA?.products.find((p) => p.sku === 'GIFTBOX-CORP-A');
    expect(prodA?.costPaise).toBe(2200000); // ₹22,000
    expect(prodA?.listPricePaise).toBe(3200000); // ₹32,000
    expect(prodA?.inventoryQty).toBe(50);
    expect(prodA?.warehouseLocation).toBe('BLR-WH-01');

    const prodB = merchantB?.products.find((p) => p.sku === 'GIFTBOX-CORP-B');
    expect(prodB?.costPaise).toBe(2100000); // ₹21,000
    expect(prodB?.listPricePaise).toBe(3100000); // ₹31,000
    expect(prodB?.inventoryQty).toBe(100);
    expect(prodB?.warehouseLocation).toBe('HYD-WH-01');

    const prodC = merchantC?.products.find((p) => p.sku === 'GIFTBOX-CORP-C');
    expect(prodC?.costPaise).toBe(2300000); // ₹23,000
    expect(prodC?.listPricePaise).toBe(3300000); // ₹33,000
    expect(prodC?.inventoryQty).toBe(35);
    expect(prodC?.warehouseLocation).toBe('BLR-WH-02');
  });

  it('successfully parses and validates the sample catalog.csv file', () => {
    const csvPath = path.resolve(__dirname, '../../../../prisma/seeds/catalog.csv');
    const csvContent = fs.readFileSync(csvPath, 'utf-8');

    const importResult = importCatalogFromCsv(csvContent);

    expect(importResult.success).toBe(true);
    expect(importResult.errors).toHaveLength(0);
    expect(importResult.validRows.length).toBeGreaterThanOrEqual(4);

    const sprintPro = importResult.validRows.find((r) => r.sku === 'SPRINTPRO-X2');
    expect(sprintPro).toBeDefined();
    expect(sprintPro?.costPaise).toBe(265000);
    expect(sprintPro?.listPricePaise).toBe(429900);
    expect(sprintPro?.inventoryQty).toBe(41);
    expect(sprintPro?.movementRate).toBe('slow');
  });
});
