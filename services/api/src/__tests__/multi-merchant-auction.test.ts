import { describe, it, expect, beforeEach } from 'vitest';
import { buildServer } from '../index.js';
import { verify, nonceStore } from '@razorpay-dealflow/contract-service';
import { stateMachine } from '../services/state-machine.js';

describe('Multi-Merchant Parallel Broadcast & Multi-Attribute Auction (Phase 9)', () => {
  const server = buildServer();

  beforeEach(() => {
    stateMachine.reset();
    nonceStore.reset();
  });

  it('fans out buyer RFP in parallel to Merchants A, B, and C and verifies all 3 return cryptographically signed contracts', async () => {
    const res = await server.inject({
      method: 'POST',
      url: '/api/auction/broadcast',
      payload: {
        category: 'Corporate Gift Boxes',
        buyer_constraints: {
          quantity: 20,
          budget_max_paise: 3000000, // ₹30,000 unit budget
          currency: 'INR',
          delivery_deadline: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
          payment_preference: ['upi', 'card'],
          return_preference: 'flexible',
          priorities: ['delivery_speed', 'price', 'return_terms', 'extras'],
        },
      },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(true);
    const bids = body.auction.competing_bids;

    // Confirms exactly 3 competing bids from Merchants A, B, and C
    expect(bids).toHaveLength(3);

    const bidA = bids.find((b: any) => b.sku === 'GIFTBOX-CORP-A');
    const bidB = bids.find((b: any) => b.sku === 'GIFTBOX-CORP-B');
    const bidC = bids.find((b: any) => b.sku === 'GIFTBOX-CORP-C');

    expect(bidA).toBeDefined();
    expect(bidA.unit_price_paise).toBe(2950000); // ₹29,500
    expect(bidA.delivery_day_label).toBe('Thursday');
    expect(bidA.extras_description).toContain('branding');

    expect(bidB).toBeDefined();
    expect(bidB.unit_price_paise).toBe(2890000); // ₹28,900 (lowest price)
    expect(bidB.delivery_day_label).toBe('Friday');

    expect(bidC).toBeDefined();
    expect(bidC.unit_price_paise).toBe(3000000); // ₹30,000
    expect(bidC.delivery_day_label).toBe('Wednesday'); // fastest delivery
    expect(bidC.return_terms_days).toBe(15);

    // Verify each merchant independently signed its contract with HMAC-SHA256
    for (const bid of bids) {
      const verification = verify(bid.signed_contract);
      expect(verification.valid).toBe(true);
      expect(bid.signed_contract.signature).toBeDefined();
    }
  });

  it('selects Merchant C when priorities are weighted toward Delivery Speed (Fastest: Wednesday delivery)', async () => {
    const res = await server.inject({
      method: 'POST',
      url: '/api/auction/broadcast',
      payload: {
        category: 'Corporate Gift Boxes',
        buyer_constraints: {
          quantity: 20,
          budget_max_paise: 3000000,
          currency: 'INR',
          delivery_deadline: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
          payment_preference: ['upi', 'card'],
          return_preference: 'flexible',
          priorities: ['delivery_speed', 'price', 'return_terms', 'extras'], // Speed Priority #1
        },
      },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    const winner = body.auction.winner;

    // Simulator must select Merchant C because Wednesday delivery beats Thursday and Friday
    expect(winner.sku).toBe('GIFTBOX-CORP-C');
    expect(winner.merchant_name).toContain('Merchant C');
    expect(winner.delivery_day_label).toBe('Wednesday');
    expect(winner.unit_price_paise).toBe(3000000);

    // Confirm decision rationale states delivery speed was #1 priority
    expect(body.auction.decision_rationale).toContain('delivery speed was ranked #1 priority');
    expect(body.auction.decision_rationale).toContain('Wednesday');
  });

  it('selects Merchant B when priorities are weighted toward Price (Lowest price: ₹28,900)', async () => {
    const res = await server.inject({
      method: 'POST',
      url: '/api/auction/broadcast',
      payload: {
        category: 'Corporate Gift Boxes',
        buyer_constraints: {
          quantity: 20,
          budget_max_paise: 3000000,
          currency: 'INR',
          delivery_deadline: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
          payment_preference: ['upi', 'card'],
          return_preference: 'flexible',
          priorities: ['price', 'delivery_speed', 'extras', 'return_terms'], // Price Priority #1
        },
      },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    const winner = body.auction.winner;

    // Simulator must select Merchant B because it offered the lowest price
    expect(winner.sku).toBe('GIFTBOX-CORP-B');
    expect(winner.merchant_name).toContain('Merchant B');
    expect(winner.unit_price_paise).toBe(2635000); // ₹26,350

    // Confirm decision rationale states price was #1 priority
    expect(body.auction.decision_rationale).toContain('price was ranked #1 priority');
    expect(body.auction.decision_rationale).toContain('₹26,350');
  });

  it('selects Merchant A when priorities are weighted toward Extras (Free Custom Logo Engraving)', async () => {
    const res = await server.inject({
      method: 'POST',
      url: '/api/auction/broadcast',
      payload: {
        category: 'Corporate Gift Boxes',
        buyer_constraints: {
          quantity: 20,
          budget_max_paise: 3000000,
          currency: 'INR',
          delivery_deadline: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
          payment_preference: ['upi', 'card'],
          return_preference: 'flexible',
          priorities: ['extras', 'delivery_speed', 'price', 'return_terms'], // Extras Priority #1
        },
      },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    const winner = body.auction.winner;

    // Simulator must select Merchant A because free branding beats standard
    expect(winner.sku).toBe('GIFTBOX-CORP-A');
    expect(winner.merchant_name).toContain('Merchant A');
    expect(winner.unit_price_paise).toBe(2950000);
    expect(body.auction.decision_rationale).toContain('customization and extras were ranked #1 priority');
  });
});
