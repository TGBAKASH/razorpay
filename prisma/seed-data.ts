export interface SeedMerchantData {
  id: string;
  name: string;
  slug: string;
  policy: {
    policyVersion: string;
    minMarginPct: number;
    maxDiscountPct: number;
    freeDeliveryAbovePaise: number;
    noDiscountFastMoving: boolean;
    clearWithinDays: number;
    prepaidDiscountOnHighCodRisk: boolean;
    humanApprovalAbovePaise: number;
  };
  products: {
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
  }[];
  promotionBudget?: {
    name: string;
    totalBudgetPaise: number;
    spentBudgetPaise: number;
  };
}

export const SEED_MERCHANTS: SeedMerchantData[] = [
  // SprintPro X2 Primary Merchant
  {
    id: 'merchant-sprint-alpha',
    name: 'Sprint Athletics',
    slug: 'sprint-athletics',
    policy: {
      policyVersion: 'v1',
      minMarginPct: 18.0,
      maxDiscountPct: 12.0,
      freeDeliveryAbovePaise: 149900, // ₹1,499.00
      noDiscountFastMoving: true,
      clearWithinDays: 30,
      prepaidDiscountOnHighCodRisk: true,
      humanApprovalAbovePaise: 1500000, // ₹15,000.00
    },
    products: [
      {
        sku: 'SPRINTPRO-X2',
        name: 'SprintPro X2 Running Shoes',
        category: 'Footwear / Running Shoes',
        costPaise: 265000, // ₹2,650
        listPricePaise: 429900, // ₹4,299
        inventoryQty: 41,
        movementRate: 'slow',
        warehouseLocation: 'BLR-WH-01',
        clearanceFlag: false,
        expiryDate: null,
      },
    ],
    promotionBudget: {
      name: 'Sprint Season Promo',
      totalBudgetPaise: 5000000, // ₹50,000
      spentBudgetPaise: 0,
    },
  },

  // 3-Merchant Auction: Merchant A
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
      humanApprovalAbovePaise: 5000000,
    },
    products: [
      {
        sku: 'GIFTBOX-CORP-A',
        name: 'Corporate Executive Gift Box - Custom Brand',
        category: 'Corporate Gifting',
        costPaise: 2200000, // ₹22,000
        listPricePaise: 3200000, // ₹32,000
        inventoryQty: 50,
        movementRate: 'normal',
        warehouseLocation: 'BLR-WH-01', // Delivers by Thursday in BLR
        clearanceFlag: false,
      },
    ],
  },

  // 3-Merchant Auction: Merchant B
  {
    id: 'merchant-b-quickship',
    name: 'Merchant B - QuickShip Supplies',
    slug: 'merchant-b-quickship',
    policy: {
      policyVersion: 'v1',
      minMarginPct: 12.0,
      maxDiscountPct: 10.0,
      freeDeliveryAbovePaise: 1000000,
      noDiscountFastMoving: true,
      clearWithinDays: 30,
      prepaidDiscountOnHighCodRisk: false,
      humanApprovalAbovePaise: 5000000,
    },
    products: [
      {
        sku: 'GIFTBOX-CORP-B',
        name: 'Corporate Standard Gift Box - Bulk Pack',
        category: 'Corporate Gifting',
        costPaise: 2100000, // ₹21,000
        listPricePaise: 3100000, // ₹31,000
        inventoryQty: 100,
        movementRate: 'fast',
        warehouseLocation: 'HYD-WH-01', // Delivers by Friday in BLR
        clearanceFlag: false,
      },
    ],
  },

  // 3-Merchant Auction: Merchant C
  {
    id: 'merchant-c-elite',
    name: 'Merchant C - Elite Gifting',
    slug: 'merchant-c-elite',
    policy: {
      policyVersion: 'v1',
      minMarginPct: 16.0,
      maxDiscountPct: 12.0,
      freeDeliveryAbovePaise: 1500000,
      noDiscountFastMoving: false,
      clearWithinDays: 30,
      prepaidDiscountOnHighCodRisk: true,
      humanApprovalAbovePaise: 5000000,
    },
    products: [
      {
        sku: 'GIFTBOX-CORP-C',
        name: 'Corporate Luxe Gift Box - 15 Day Replacement',
        category: 'Corporate Gifting',
        costPaise: 2300000, // ₹23,000
        listPricePaise: 3300000, // ₹33,000
        inventoryQty: 35,
        movementRate: 'normal',
        warehouseLocation: 'BLR-WH-02', // Delivers by Wednesday in BLR
        clearanceFlag: false,
      },
    ],
  },
];
