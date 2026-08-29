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
export declare const SEED_MERCHANTS: SeedMerchantData[];
//# sourceMappingURL=seed-data.d.ts.map