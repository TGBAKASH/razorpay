import { prisma } from '../db.js';
import { CATALOG_MERCHANTS } from '../data/seed-catalog.js';

export interface ReserveInventoryResult {
  success: boolean;
  remainingQty: number;
  previousQty: number;
  reason?: string;
  source: 'database' | 'catalog';
}

/**
 * Concurrency-Safe Atomic Inventory Service
 *
 * Replaces vulnerable "read-check-then-write" patterns with a single atomic conditional
 * reservation:
 * 1. In Postgres: prisma.product.updateMany with WHERE inventory_qty >= quantity
 *    leveraging Postgres row-level locking.
 * 2. In-memory / Catalog: Synchronized promise queue per SKU preventing concurrent
 *    event-loop microtasks from interleaving and driving stock negative.
 */
export class InventoryService {
  private locks: Map<string, Promise<any>> = new Map();

  private async acquireLock<T>(sku: string, fn: () => Promise<T> | T): Promise<T> {
    const key = sku.toLowerCase();
    const currentLock = this.locks.get(key) || Promise.resolve();
    let release: () => void;
    const nextLock = new Promise<void>((resolve) => {
      release = resolve;
    });
    this.locks.set(key, nextLock);

    try {
      await currentLock;
      return await fn();
    } finally {
      release!();
      if (this.locks.get(key) === nextLock) {
        this.locks.delete(key);
      }
    }
  }

  /**
   * Atomic conditional reservation:
   * Decrements stock by quantity IF AND ONLY IF current stock >= quantity.
   */
  async reserveInventoryAtomically(
    sku: string,
    quantity: number,
    merchantId?: string
  ): Promise<ReserveInventoryResult> {
    return this.acquireLock(sku, async () => {
      // 1. Try Prisma conditional update if in non-test DB mode
      if (process.env.NODE_ENV !== 'test') {
        try {
          const updateResult = await prisma.product.updateMany({
            where: {
              sku: { equals: sku, mode: 'insensitive' },
              inventoryQty: { gte: quantity },
            },
            data: {
              inventoryQty: { decrement: quantity },
            },
          });

          if (updateResult.count > 0) {
            const dbProd = await prisma.product.findFirst({
              where: { sku: { equals: sku, mode: 'insensitive' } },
            });
            const remaining = dbProd?.inventoryQty ?? 0;

            const catProd = this.findCatalogProduct(sku, merchantId);
            if (catProd) {
              catProd.inventoryQty = remaining;
            }

            return {
              success: true,
              remainingQty: remaining,
              previousQty: remaining + quantity,
              source: 'database',
            };
          } else {
            const dbProd = await prisma.product.findFirst({
              where: { sku: { equals: sku, mode: 'insensitive' } },
            });
            const current = dbProd?.inventoryQty ?? 0;
            return {
              success: false,
              remainingQty: current,
              previousQty: current,
              reason: `Item is out of stock. Requested ${quantity}, but only ${current} available.`,
              source: 'database',
            };
          }
        } catch {
          // Fall back to in-memory catalog
        }
      }

      // 2. In-Memory Catalog Atomic Conditional Update
      const catProd = this.findCatalogProduct(sku, merchantId);
      if (!catProd) {
        return {
          success: false,
          remainingQty: 0,
          previousQty: 0,
          reason: `Product with SKU '${sku}' not found in catalog.`,
          source: 'catalog',
        };
      }

      const prevQty = catProd.inventoryQty;
      if (prevQty < quantity || prevQty <= 0) {
        return {
          success: false,
          remainingQty: Math.max(0, prevQty),
          previousQty: prevQty,
          reason: `Item is out of stock. Requested ${quantity}, but only ${prevQty} available.`,
          source: 'catalog',
        };
      }

      // Atomic conditional decrement: strictly serialized by acquireLock
      catProd.inventoryQty -= quantity;
      return {
        success: true,
        remainingQty: catProd.inventoryQty,
        previousQty: prevQty,
        source: 'catalog',
      };
    });
  }

  /**
   * Release reserved inventory (e.g. on payment cancellation or expiry).
   */
  async releaseInventoryAtomically(
    sku: string,
    quantity: number,
    merchantId?: string
  ): Promise<void> {
    return this.acquireLock(sku, async () => {
      if (process.env.NODE_ENV !== 'test') {
        try {
          await prisma.product.updateMany({
            where: { sku: { equals: sku, mode: 'insensitive' } },
            data: { inventoryQty: { increment: quantity } },
          });
        } catch {}
      }
      const catProd = this.findCatalogProduct(sku, merchantId);
      if (catProd) {
        catProd.inventoryQty += quantity;
      }
    });
  }

  /**
   * Set inventory to an exact value (useful for test seeding and benchmark initialization).
   */
  async setInventory(sku: string, quantity: number, merchantId?: string): Promise<void> {
    return this.acquireLock(sku, async () => {
      if (process.env.NODE_ENV !== 'test') {
        try {
          await prisma.product.updateMany({
            where: { sku: { equals: sku, mode: 'insensitive' } },
            data: { inventoryQty: quantity },
          });
        } catch {}
      }
      const catProd = this.findCatalogProduct(sku, merchantId);
      if (catProd) {
        catProd.inventoryQty = quantity;
      }
    });
  }

  /**
   * Get current inventory balance.
   */
  async getInventory(sku: string, merchantId?: string): Promise<number> {
    return this.acquireLock(sku, async () => {
      if (process.env.NODE_ENV !== 'test') {
        try {
          const dbProd = await prisma.product.findFirst({
            where: { sku: { equals: sku, mode: 'insensitive' } },
          });
          if (dbProd) return dbProd.inventoryQty;
        } catch {}
      }
      const catProd = this.findCatalogProduct(sku, merchantId);
      return catProd ? catProd.inventoryQty : 0;
    });
  }

  private findCatalogProduct(sku: string, merchantId?: string) {
    for (const m of CATALOG_MERCHANTS) {
      if (merchantId && m.id !== merchantId && m.slug !== merchantId) continue;
      const prod = m.products.find((p) => p.sku.toLowerCase() === sku.toLowerCase());
      if (prod) return prod;
    }
    return null;
  }
}

export const inventoryService = new InventoryService();
