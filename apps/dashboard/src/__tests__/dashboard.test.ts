import { describe, it, expect } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { TabularNumber } from '../components/TabularNumber';
import { DealTicket, DealTicketData } from '../components/DealTicket';
import { DealLifecycleNav } from '../components/DealLifecycleNav';

describe('apps/dashboard - 5 Canonical Views & Stepper Stepper Navigation', () => {
  it('renders TabularNumber with strict tabular-nums and INR currency formatting', () => {
    const html = renderToString(
      React.createElement(TabularNumber, {
        value: 394900,
        isCurrencyPaise: true,
        prefix: '₹',
      })
    );

    expect(html).toContain('tabular-nums');
    expect(html).toContain('₹');
    expect(html).toContain('3,949');
  });

  it('renders DealTicket with physical perforated styling, cryptographic digest, and status stamp', () => {
    const sampleTicket: DealTicketData = {
      offer_id: 'test-offer-001',
      sku: 'SPRINTPRO-X2',
      product_name: 'SprintPro X2 Running Shoes',
      quantity: 1,
      final_price_paise: 394900,
      list_price_paise: 429900,
      discount_paise: 35000,
      discount_reasons: ['Prepaid UPI discount', 'Warehouse SLA satisfied'],
      merchant_name: 'Apex Athletic Goods',
      signature: 'hmac_sha256_mock_signature_hex_digest_9981',
      nonce: 'nonce_test_001',
      state: 'SIGNED',
    };

    const html = renderToString(
      React.createElement(DealTicket, {
        ticket: sampleTicket,
      })
    );

    expect(html).toContain('ticket-perforated');
    expect(html).toContain('Apex Athletic Goods');
    expect(html).toContain('SprintPro X2 Running Shoes');
    expect(html).toContain('3,949');
    expect(html).toContain('POLICY APPROVED');
    expect(html).toContain('HMAC-SHA256');
  });

  it('renders the 4 canonical primary route links in DealLifecycleNav', () => {
    const html = renderToString(
      React.createElement(DealLifecycleNav)
    );

    expect(html).toContain('01 Overview');
    expect(html).toContain('02 Merchant Console');
    expect(html).toContain('03 Deal Room');
    expect(html).toContain('04 Audit Ledger');
  });
});
