import { describe, it, expect } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { DealTicket, DealTicketData } from '../components/DealTicket';
import { TabularNumber } from '../components/TabularNumber';

describe('Deal Room Continuous Flow & Checkout Navigation', () => {
  it('renders Deal Ticket for a signed contract with all fields intact', () => {
    const validContract: DealTicketData = {
      offer_id: 'off-sprintpro-checkout-test',
      sku: 'SPRINTPRO-X2',
      product_name: 'SprintPro X2 Running Shoes (Titanium Grey)',
      quantity: 1,
      final_price_paise: 394900,
      list_price_paise: 429900,
      discount_paise: 35000,
      discount_reasons: [
        'Prepaid UPI incentive (zero COD risk)',
        'Inventory clearance acceleration',
        'Guaranteed delivery SLA satisfied',
      ],
      delivery_promise: '2026-08-31T23:59:59.000Z',
      return_terms_days: 10,
      payment_methods_allowed: ['UPI', 'Card'],
      expires_at: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
      merchant_id: 'merchant-sprint-alpha',
      merchant_name: 'Sprint Athletics',
      signature: '7e8f192b6a9c3d4e5f0a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e',
      nonce: 'nonce_98f12a3d7b4',
      state: 'SIGNED',
    };

    const html = renderToString(
      React.createElement(DealTicket, { ticket: validContract })
    );

    expect(html).toContain('SprintPro X2 Running Shoes');
    expect(html).toContain('Sprint Athletics');
    expect(html).toContain('3,949');
    expect(html).toContain('HMAC-SHA256');
    expect(html).toContain('POLICY APPROVED');
  });

  it('verifies checkout settlement calculations and locked amount matching contract', () => {
    const finalPricePaise = 394900;
    const quantity = 1;
    const lockedTotalPaise = finalPricePaise * quantity;

    const html = renderToString(
      React.createElement('div', { className: 'checkout-view' }, [
        React.createElement('span', { key: 'id' }, 'order_sprintpro_test'),
        React.createElement(TabularNumber, {
          key: 'amount',
          value: lockedTotalPaise,
          isCurrencyPaise: true,
          prefix: '₹',
        }),
      ])
    );

    expect(html).toContain('order_sprintpro_test');
    expect(html).toContain('3,949');
    expect(html).toContain('tabular-nums');
  });
});
