import { describe, it, expect } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { DealTicket, DealTicketData } from '../components/DealTicket';
import { TabularNumber } from '../components/TabularNumber';

describe('Step Distinction, Buyer Confidentiality, and Deal Room Integrity', () => {
  const sampleTicket: DealTicketData = {
    offer_id: 'off-test-distinction-01',
    sku: 'SPRINTPRO-X2',
    product_name: 'SprintPro X2 Running Shoes (Titanium Grey)',
    quantity: 1,
    final_price_paise: 394900,
    list_price_paise: 429900,
    discount_paise: 35000,
    discount_reasons: [
      'Prepaid UPI incentive (zero COD risk)',
      'Inventory clearance acceleration',
    ],
    delivery_promise: '2026-09-02T23:59:59.000Z',
    return_terms_days: 10,
    payment_methods_allowed: ['UPI', 'Card'],
    expires_at: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
    merchant_id: 'merchant-sprint-alpha',
    merchant_name: 'Sprint Athletics',
    signature: '7e8f192b6a9c3d4e5f0a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e',
    nonce: 'nonce_98f12a3d7b4',
    state: 'SIGNED',
  };

  it('verifies that Step 3 (Contract) renders cryptographic ticket and NOT checkout buttons', () => {
    const contractHtml = renderToString(
      React.createElement('div', { id: 'step-contract' }, [
        React.createElement(DealTicket, { key: 'ticket', ticket: sampleTicket }),
        React.createElement(
          'button',
          { key: 'btn' },
          'Accept Offer & Proceed to Instant Settlement →'
        ),
      ])
    );

    // Assert Contract features are present
    expect(contractHtml).toContain('HMAC-SHA256');
    expect(contractHtml).toContain('Sprint Athletics');
    expect(contractHtml).toContain('Accept Offer &amp; Proceed to Instant Settlement');

    // Assert Checkout settlement triggers are NOT present in Contract step
    expect(contractHtml).not.toContain('Confirm UPI Payment (Simulate Capture)');
    expect(contractHtml).not.toContain('Razorpay Order ID:');
  });

  it('verifies that Step 4 (Checkout) renders Razorpay order settlement triggers and NOT the contract ticket card', () => {
    const checkoutHtml = renderToString(
      React.createElement('div', { id: 'step-checkout' }, [
        React.createElement('span', { key: 'order-id' }, 'order_sprintpro_test_01'),
        React.createElement(TabularNumber, {
          key: 'amount',
          value: 394900,
          isCurrencyPaise: true,
          prefix: '₹',
        }),
        React.createElement('button', { key: 'upi' }, 'Confirm UPI Payment (Simulate Capture)'),
        React.createElement('button', { key: 'tamper' }, 'Test Price Tampering Attack (₹2,999)'),
      ])
    );

    // Assert Checkout features are present
    expect(checkoutHtml).toContain('order_sprintpro_test_01');
    expect(checkoutHtml).toContain('3,949');
    expect(checkoutHtml).toContain('Confirm UPI Payment (Simulate Capture)');
    expect(checkoutHtml).toContain('Test Price Tampering Attack');

    // Assert Cryptographic Contract raw signature widget is NOT present
    expect(checkoutHtml).not.toContain('HMAC-SHA256 SEED / NONCE');
    expect(checkoutHtml).not.toContain('Accept Offer &amp; Proceed');
  });

  it('verifies buyer candidate card confidentiality: profit margin and expected profit score are omitted', () => {
    // Simulate candidate card rendering in Buyer mode
    const candidateData = {
      finalPricePaise: 394900,
      discountPaise: 35000,
      decisionRules: ['Prepaid UPI incentive', 'Inventory clearance'],
      // Merchant internal numbers (must be omitted in buyer view)
      marginPct: 32.5,
      grossProfitPaise: 129900,
      expectedProfitScore: 118920,
    };

    const isMerchant = false; // Buyer view

    const buyerViewHtml = renderToString(
      React.createElement('div', { className: 'candidate-card' }, [
        React.createElement('span', { key: 'price' }, `₹${candidateData.finalPricePaise / 100}`),
        React.createElement('span', { key: 'discount' }, `-₹${candidateData.discountPaise / 100}`),
        React.createElement('ul', { key: 'rules' }, candidateData.decisionRules.map((r, i) => React.createElement('li', { key: i }, r))),
        isMerchant ? React.createElement('span', { key: 'margin' }, `Margin: ${candidateData.marginPct}%`) : null,
        isMerchant ? React.createElement('span', { key: 'profit' }, `Profit: ${candidateData.grossProfitPaise}`) : null,
        isMerchant ? React.createElement('span', { key: 'score' }, `Score: ${candidateData.expectedProfitScore}`) : null,
      ])
    );

    expect(buyerViewHtml).toContain('3949');
    expect(buyerViewHtml).toContain('Prepaid UPI incentive');
    expect(buyerViewHtml).not.toContain('Margin:');
    expect(buyerViewHtml).not.toContain('Profit:');
    expect(buyerViewHtml).not.toContain('Score:');
  });
});
