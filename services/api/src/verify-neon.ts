import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const merchants = await prisma.merchant.findMany({
    include: { products: true, policies: true },
  });
  console.log('LIVE NEON QUERY RESULTS:');
  console.log(`Found ${merchants.length} merchants in Neon DB:`);
  for (const m of merchants) {
    console.log(`- ${m.name} (${m.slug}): ${m.products.length} products, ${m.policies.length} policies`);
    for (const p of m.products) {
      console.log(`    SKU: ${p.sku} | List: ₹${p.listPricePaise / 100} | Cost: ₹${p.costPaise / 100} | Stock: ${p.inventoryQty}`);
    }
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
