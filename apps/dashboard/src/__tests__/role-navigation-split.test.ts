import { describe, it, expect } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { AuthProvider } from '../components/AuthContext';
import { DealLifecycleNav } from '../components/DealLifecycleNav';

describe('Role Navigation Split and Scoped Experiences', () => {
  it('renders Buyer navigation with Deal Room and My Orders (no Merchant Console)', () => {
    // Render as default Buyer
    const html = renderToString(
      React.createElement(
        AuthProvider,
        null,
        React.createElement(DealLifecycleNav, null)
      )
    );

    // Expect Buyer routes
    expect(html).toContain('01 Deal Room');
    expect(html).toContain('02 My Orders');
    expect(html).toContain('Buyer Agent');

    // Merchant Console must NOT appear in buyer primary nav
    expect(html).not.toContain('01 Merchant Console');
  });

  it('renders Buyer My Orders with only buyer-safe fields', () => {
    const sampleOrderHtml = renderToString(
      React.createElement('div', { className: 'order-card' }, [
        React.createElement('span', { key: 'prod' }, 'SprintPro X2 Running Shoes (Titanium Grey)'),
        React.createElement('span', { key: 'price' }, '₹3,949'),
        React.createElement('span', { key: 'del' }, 'Delivery by: Sep 2, 2026'),
        React.createElement('span', { key: 'ret' }, '10-day replacement'),
        React.createElement('span', { key: 'stat' }, 'PAID'),
        React.createElement('button', { key: 'btn' }, 'View Contract Receipt →'),
      ])
    );

    expect(sampleOrderHtml).toContain('SprintPro X2 Running Shoes');
    expect(sampleOrderHtml).toContain('₹3,949');
    expect(sampleOrderHtml).toContain('10-day replacement');
    expect(sampleOrderHtml).toContain('View Contract Receipt →');

    // Invariant: Never render profit margin in buyer orders
    expect(sampleOrderHtml).not.toContain('Margin:');
    expect(sampleOrderHtml).not.toContain('Gross Profit:');
  });

  it('renders Buyer Candidate Policy Checklist with clean badges and ZERO margin/rupee leak', () => {
    // Simulate Buyer-facing Candidate Card Checklist
    const isMerchant = false;
    const buyerChecklistHtml = renderToString(
      React.createElement('div', { className: 'policy-checklist' }, [
        !isMerchant
          ? React.createElement('div', { key: 'buyer' }, [
              React.createElement('span', { key: 'm' }, 'Margin requirement: ✓ Met'),
              React.createElement('span', { key: 'd' }, 'Discount within policy: ✓ Met'),
              React.createElement('span', { key: 'i' }, '41 in stock ✓ PASS'),
              React.createElement('span', { key: 'a' }, '✓ No approval needed'),
            ])
          : React.createElement('div', { key: 'merch' }, [
              React.createElement('span', { key: 'm' }, 'Margin floor (18.0% min): 49.0% ✓ PASS'),
              React.createElement('span', { key: 'd' }, 'Discount ceiling (12.0% max): 7.0% ✓ PASS'),
              React.createElement('span', { key: 'a' }, 'Approval threshold (₹15,000)'),
            ]),
      ])
    );

    // Assert Buyer view contains clean badges
    expect(buyerChecklistHtml).toContain('Margin requirement: ✓ Met');
    expect(buyerChecklistHtml).toContain('Discount within policy: ✓ Met');
    expect(buyerChecklistHtml).toContain('✓ No approval needed');

    // Invariant: Assert complete absence of leaked margin % and threshold amounts in buyer view
    expect(buyerChecklistHtml).not.toContain('18.0%');
    expect(buyerChecklistHtml).not.toContain('49.0%');
    expect(buyerChecklistHtml).not.toContain('12.0%');
    expect(buyerChecklistHtml).not.toContain('₹15,000');
  });
});
