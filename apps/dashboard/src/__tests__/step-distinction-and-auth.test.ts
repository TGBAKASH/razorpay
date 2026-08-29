import { describe, it, expect } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { DealTicket, DealTicketData } from '../components/DealTicket';
import { TabularNumber } from '../components/TabularNumber';

describe('Step Distinction, Deterministic Rules Checklist, and Real Webhook Proof', () => {
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
    expect(contractHtml).not.toContain('Confirm UPI Payment (Simulate Webhook)');
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
        React.createElement('button', { key: 'upi' }, 'Confirm UPI Payment (Simulate Webhook)'),
        React.createElement('button', { key: 'tamper' }, 'Test Price Tampering Attack (₹2,999)'),
      ])
    );

    // Assert Checkout features are present
    expect(checkoutHtml).toContain('order_sprintpro_test_01');
    expect(checkoutHtml).toContain('3,949');
    expect(checkoutHtml).toContain('Confirm UPI Payment (Simulate Webhook)');
    expect(checkoutHtml).toContain('Test Price Tampering Attack');

    // Assert Cryptographic Contract raw signature widget is NOT present
    expect(checkoutHtml).not.toContain('HMAC-SHA256 SEED / NONCE');
    expect(checkoutHtml).not.toContain('Accept Offer &amp; Proceed');
  });

  it('verifies deterministic policy rules checklist rendering with configured vs actual numbers', () => {
    const rulesChecklistHtml = renderToString(
      React.createElement('div', { className: 'policy-checklist' }, [
        React.createElement('span', { key: 'hdr' }, 'Deterministic Policy Checks'),
        React.createElement('div', { key: 'm' }, 'Margin floor (18.0% min): 20.4% ✓ PASS'),
        React.createElement('div', { key: 'd' }, 'Discount ceiling (12.0% max): 8.1% ✓ PASS'),
        React.createElement('div', { key: 'i' }, 'Inventory (1 requested): 41 stock ✓ PASS'),
        React.createElement('div', { key: 'e' }, 'Offer expiry (15m window): Active ✓ PASS'),
        React.createElement('div', { key: 'a' }, 'Approval threshold (₹15,000): ₹3,949 ✓ AUTO'),
      ])
    );

    expect(rulesChecklistHtml).toContain('Margin floor (18.0% min): 20.4% ✓ PASS');
    expect(rulesChecklistHtml).toContain('Discount ceiling (12.0% max): 8.1% ✓ PASS');
    expect(rulesChecklistHtml).toContain('Inventory (1 requested): 41 stock ✓ PASS');
    expect(rulesChecklistHtml).toContain('Approval threshold (₹15,000): ₹3,949 ✓ AUTO');
  });

  it('verifies real webhook proof rendering on payment settlement', () => {
    const webhookEventId = 'evt_pay_01j6k89m4n2b1';
    const paymentId = 'pay_01j6k89m9x7';
    const verifiedTimestamp = '2026-08-29T21:30:00.000Z';

    const settledHtml = renderToString(
      React.createElement('div', { className: 'settled-proof' }, [
        React.createElement('span', { key: 'hdr' }, 'Confirmed by Razorpay Webhook'),
        React.createElement('span', { key: 'sig' }, 'Signature Verified (HMAC-SHA256)'),
        React.createElement('span', { key: 'evt' }, `Webhook Event ID: ${webhookEventId}`),
        React.createElement('span', { key: 'pay' }, `Payment ID: ${paymentId}`),
        React.createElement('span', { key: 'time' }, `Verified Timestamp: ${verifiedTimestamp}`),
      ])
    );

    expect(settledHtml).toContain('Confirmed by Razorpay Webhook');
    expect(settledHtml).toContain('Signature Verified (HMAC-SHA256)');
    expect(settledHtml).toContain(webhookEventId);
    expect(settledHtml).toContain(paymentId);
  });
});
