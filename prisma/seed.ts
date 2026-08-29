import { PrismaClient } from '@prisma/client';
import { SEED_MERCHANTS } from './seed-data.js';

const prisma = new PrismaClient();

export async function runSeed(client: PrismaClient = prisma) {
  console.log('🌱 Starting database seed...');

  for (const merchantData of SEED_MERCHANTS) {
    console.log(`Creating/updating merchant: ${merchantData.name} (${merchantData.id})`);

    const merchant = await client.merchant.upsert({
      where: { slug: merchantData.slug },
      update: { name: merchantData.name },
      create: {
        id: merchantData.id,
        name: merchantData.name,
        slug: merchantData.slug,
      },
    });

    // Versioned Merchant Policy
    console.log(`  -> Seeding policy ${merchantData.policy.policyVersion}`);
    await client.merchantPolicy.upsert({
      where: {
        merchantId_policyVersion: {
          merchantId: merchant.id,
          policyVersion: merchantData.policy.policyVersion,
        },
      },
      update: {
        minMarginPct: merchantData.policy.minMarginPct,
        maxDiscountPct: merchantData.policy.maxDiscountPct,
        freeDeliveryAbovePaise: merchantData.policy.freeDeliveryAbovePaise,
        noDiscountFastMoving: merchantData.policy.noDiscountFastMoving,
        clearWithinDays: merchantData.policy.clearWithinDays,
        prepaidDiscountOnHighCodRisk: merchantData.policy.prepaidDiscountOnHighCodRisk,
        humanApprovalAbovePaise: merchantData.policy.humanApprovalAbovePaise,
        isActive: true,
      },
      create: {
        merchantId: merchant.id,
        policyVersion: merchantData.policy.policyVersion,
        minMarginPct: merchantData.policy.minMarginPct,
        maxDiscountPct: merchantData.policy.maxDiscountPct,
        freeDeliveryAbovePaise: merchantData.policy.freeDeliveryAbovePaise,
        noDiscountFastMoving: merchantData.policy.noDiscountFastMoving,
        clearWithinDays: merchantData.policy.clearWithinDays,
        prepaidDiscountOnHighCodRisk: merchantData.policy.prepaidDiscountOnHighCodRisk,
        humanApprovalAbovePaise: merchantData.policy.humanApprovalAbovePaise,
        isActive: true,
      },
    });

    // Products / Catalog
    for (const prod of merchantData.products) {
      console.log(`  -> Seeding product ${prod.sku} (Cost: ₹${prod.costPaise / 100}, List: ₹${prod.listPricePaise / 100})`);
      await client.product.upsert({
        where: {
          merchantId_sku: {
            merchantId: merchant.id,
            sku: prod.sku,
          },
        },
        update: {
          name: prod.name,
          category: prod.category,
          costPaise: prod.costPaise,
          listPricePaise: prod.listPricePaise,
          inventoryQty: prod.inventoryQty,
          movementRate: prod.movementRate,
          warehouseLocation: prod.warehouseLocation,
          clearanceFlag: prod.clearanceFlag,
          expiryDate: prod.expiryDate ? new Date(prod.expiryDate) : null,
        },
        create: {
          merchantId: merchant.id,
          sku: prod.sku,
          name: prod.name,
          category: prod.category,
          costPaise: prod.costPaise,
          listPricePaise: prod.listPricePaise,
          inventoryQty: prod.inventoryQty,
          movementRate: prod.movementRate,
          warehouseLocation: prod.warehouseLocation,
          clearanceFlag: prod.clearanceFlag,
          expiryDate: prod.expiryDate ? new Date(prod.expiryDate) : null,
        },
      });
    }

    // Promotion Budget if defined
    if (merchantData.promotionBudget) {
      console.log(`  -> Seeding promotion budget: ${merchantData.promotionBudget.name}`);
      const existingBudget = await client.promotionBudget.findFirst({
        where: {
          merchantId: merchant.id,
          name: merchantData.promotionBudget.name,
        },
      });

      if (existingBudget) {
        await client.promotionBudget.update({
          where: { id: existingBudget.id },
          data: {
            totalBudgetPaise: merchantData.promotionBudget.totalBudgetPaise,
            spentBudgetPaise: merchantData.promotionBudget.spentBudgetPaise,
            isActive: true,
          },
        });
      } else {
        await client.promotionBudget.create({
          data: {
            merchantId: merchant.id,
            name: merchantData.promotionBudget.name,
            totalBudgetPaise: merchantData.promotionBudget.totalBudgetPaise,
            spentBudgetPaise: merchantData.promotionBudget.spentBudgetPaise,
            isActive: true,
          },
        });
      }
    }
  }

  console.log('✅ Database seed completed successfully!');
}

if (process.env.NODE_ENV !== 'test' && require.main === module) {
  runSeed()
    .catch((err) => {
      console.error('❌ Error running database seed:', err);
      process.exit(1);
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}
