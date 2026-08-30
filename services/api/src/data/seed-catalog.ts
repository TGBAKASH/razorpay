export interface MerchantPolicyData {
  policyVersion: string;
  minMarginPct: number;
  maxDiscountPct: number;
  freeDeliveryAbovePaise: number;
  noDiscountFastMoving: boolean;
  clearWithinDays: number;
  prepaidDiscountOnHighCodRisk: boolean;
  humanApprovalAbovePaise: number;
  updatedAt?: string;
  updatedBy?: string;
}

export interface ProductData {
  sku: string;
  name: string;
  category: string;
  costPaise: number;
  listPricePaise: number;
  inventoryQty: number;
  movementRate: 'fast' | 'normal' | 'slow';
  expiryDate?: string | null;
  warehouseLocation: string;
  clearanceFlag: boolean;
  listedAt?: string;
}

export interface MerchantData {
  id: string;
  name: string;
  slug: string;
  policy: MerchantPolicyData;
  policyHistory: MerchantPolicyData[];
  products: ProductData[];
}

export const CATALOG_MERCHANTS: MerchantData[] = [
  {
    id: 'merchant-sprint-alpha',
    name: 'Sprint Athletics',
    slug: 'sprint-athletics',
    policy: {
      policyVersion: 'v1',
      minMarginPct: 18.0,
      maxDiscountPct: 12.0,
      freeDeliveryAbovePaise: 149900,
      noDiscountFastMoving: true,
      clearWithinDays: 30,
      prepaidDiscountOnHighCodRisk: true,
      humanApprovalAbovePaise: 1500000,
      updatedAt: '2026-08-25T12:00:00Z',
      updatedBy: 'system:seed',
    },
    policyHistory: [
      {
        policyVersion: 'v1',
        minMarginPct: 18.0,
        maxDiscountPct: 12.0,
        freeDeliveryAbovePaise: 149900,
        noDiscountFastMoving: true,
        clearWithinDays: 30,
        prepaidDiscountOnHighCodRisk: true,
        humanApprovalAbovePaise: 1500000,
        updatedAt: '2026-08-25T12:00:00Z',
        updatedBy: 'system:seed',
      },
    ],
    products: [
      {
        sku: 'SPRINTPRO-X2',
        name: 'SprintPro X2 Running Shoes',
        category: 'Footwear / Running Shoes',
        costPaise: 265000,
        listPricePaise: 429900,
        inventoryQty: 41,
        movementRate: 'slow',
        warehouseLocation: 'BLR-WH-01',
        clearanceFlag: false,
        expiryDate: null,
        listedAt: '2026-06-15T00:00:00Z', // 75+ days aged inventory
      },
    ],
  },
  {
    id: 'merchant-a-crafts',
    name: 'Merchant A - Premium Crafts',
    slug: 'merchant-a-crafts',
    policy: {
      policyVersion: 'v1',
      minMarginPct: 15.0,
      maxDiscountPct: 15.0,
      freeDeliveryAbovePaise: 2000000,
      noDiscountFastMoving: false,
      clearWithinDays: 30,
      prepaidDiscountOnHighCodRisk: true,
      humanApprovalAbovePaise: 10000000, // ₹1,00,000
      updatedAt: '2026-08-25T12:00:00Z',
      updatedBy: 'system:seed',
    },
    policyHistory: [],
    products: [
      {
        sku: 'GIFTBOX-CORP-A',
        name: 'Executive Artisanal Gift Box (Free Branding)',
        category: 'Corporate Gifting',
        costPaise: 2200000, // ₹22,000
        listPricePaise: 3200000, // ₹32,000
        inventoryQty: 50,
        movementRate: 'normal',
        warehouseLocation: 'BLR-WH-01',
        clearanceFlag: false,
        listedAt: '2026-08-01T00:00:00Z',
      },
    ],
  },
  {
    id: 'merchant-b-bulk',
    name: 'Merchant B - Bulk Gifting Direct',
    slug: 'merchant-b-bulk',
    policy: {
      policyVersion: 'v1',
      minMarginPct: 15.0,
      maxDiscountPct: 15.0,
      freeDeliveryAbovePaise: 1500000,
      noDiscountFastMoving: false,
      clearWithinDays: 30,
      prepaidDiscountOnHighCodRisk: true,
      humanApprovalAbovePaise: 10000000,
      updatedAt: '2026-08-25T12:00:00Z',
      updatedBy: 'system:seed',
    },
    policyHistory: [],
    products: [
      {
        sku: 'GIFTBOX-CORP-B',
        name: 'Corporate Essentials Gift Box (Value Tier)',
        category: 'Corporate Gifting',
        costPaise: 2000000, // ₹20,000
        listPricePaise: 3100000, // ₹31,000
        inventoryQty: 100,
        movementRate: 'fast',
        warehouseLocation: 'BLR-WH-02',
        clearanceFlag: false,
        listedAt: '2026-08-20T00:00:00Z',
      },
    ],
  },
  {
    id: 'merchant-c-express',
    name: 'Merchant C - Express Corporate Gifting',
    slug: 'merchant-c-express',
    policy: {
      policyVersion: 'v1',
      minMarginPct: 15.0,
      maxDiscountPct: 15.0,
      freeDeliveryAbovePaise: 2500000,
      noDiscountFastMoving: false,
      clearWithinDays: 30,
      prepaidDiscountOnHighCodRisk: true,
      humanApprovalAbovePaise: 10000000,
      updatedAt: '2026-08-25T12:00:00Z',
      updatedBy: 'system:seed',
    },
    policyHistory: [],
    products: [
      {
        sku: 'GIFTBOX-CORP-C',
        name: 'VIP Executive Hamper (Express Air & 15d Warranty)',
        category: 'Corporate Gifting',
        costPaise: 2300000, // ₹23,000
        listPricePaise: 3300000, // ₹33,000
        inventoryQty: 30,
        movementRate: 'normal',
        warehouseLocation: 'BLR-WH-01',
        clearanceFlag: false,
        listedAt: '2026-08-10T00:00:00Z',
      },
    ],
  },
];
