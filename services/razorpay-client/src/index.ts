import crypto from 'node:crypto';
import type { SignedOfferContract } from '@razorpay-dealflow/contract-service';

export interface RazorpayClientConfig {
  keyId: string;
  keySecret: string;
  webhookSecret: string;
}

export interface RazorpayOrderResult {
  id: string;
  entity: 'order';
  amount: number; // in integer paise
  amount_paid: number;
  amount_due: number;
  currency: 'INR';
  receipt: string;
  offer_id: string;
  status: 'created' | 'attempted' | 'paid';
  attempts: number;
  notes: Record<string, string>;
  created_at: number;
}

export interface RazorpayRefundResult {
  id: string;
  entity: 'refund';
  amount: number;
  currency: 'INR';
  payment_id: string;
  status: 'processed' | 'pending' | 'failed';
  notes: Record<string, string>;
  created_at: number;
}

export class RazorpayClientWrapper {
  private keyId: string;
  private keySecret: string;
  private webhookSecret: string;

  constructor(config?: Partial<RazorpayClientConfig>) {
    this.keyId = config?.keyId || process.env.RAZORPAY_KEY_ID || 'rzp_test_dealflow_mvp';
    this.keySecret = config?.keySecret || process.env.RAZORPAY_KEY_SECRET || 'rzp_test_secret_mvp';
    this.webhookSecret = config?.webhookSecret || process.env.RAZORPAY_WEBHOOK_SECRET || 'rzp_webhook_secret_mvp';

    // Invariant 6: Safeguard against live keys
    if (this.keyId.startsWith('rzp_live_')) {
      throw new Error('CRITICAL SECURITY VIOLATION: Live Razorpay keys detected. Razorpay DealFlow strictly runs in test mode (Invariant 6).');
    }
  }

  public getKeyId(): string {
    return this.keyId;
  }

  public getKeySecret(): string {
    return this.keySecret;
  }

  public getWebhookSecret(): string {
    return this.webhookSecret;
  }

  /**
   * Creates a Razorpay test mode order 1:1 bound to a verified OfferContract.
   * Invariant 2: amount = contract.final_price_paise * quantity (exact integer paise).
   */
  public async createOrder(
    contract: SignedOfferContract,
    notes?: Record<string, string>
  ): Promise<RazorpayOrderResult> {
    const payload = contract.canonical_payload;
    const amountPaise = payload.final_price_paise * payload.quantity;

    if (!Number.isInteger(amountPaise) || amountPaise <= 0) {
      throw new Error(`Invalid order amount: ${amountPaise} paise. Must be a positive integer.`);
    }

    const orderId = `order_${payload.offer_id.replace(/[^a-zA-Z0-9]/g, '').substring(0, 16)}`;
    const receipt = `rcpt_${payload.offer_id.substring(0, 20)}`;

    const orderResult: RazorpayOrderResult = {
      id: orderId,
      entity: 'order',
      amount: amountPaise,
      amount_paid: 0,
      amount_due: amountPaise,
      currency: 'INR',
      receipt,
      offer_id: payload.offer_id,
      status: 'created',
      attempts: 0,
      notes: {
        offer_id: payload.offer_id,
        sku: payload.sku,
        buyer_agent_id: payload.buyer_agent_id,
        merchant_id: payload.merchant_id,
        nonce: payload.nonce,
        ...notes,
      },
      created_at: Math.floor(Date.now() / 1000),
    };

    return orderResult;
  }

  /**
   * Verifies incoming webhook HMAC-SHA256 signature using raw request body.
   */
  public verifyWebhookSignature(
    rawBody: string,
    signature: string,
    secret?: string
  ): boolean {
    if (!rawBody || !signature) {
      return false;
    }

    const effectiveSecret = secret || this.webhookSecret;
    const expectedSignature = crypto
      .createHmac('sha256', effectiveSecret)
      .update(rawBody, 'utf8')
      .digest('hex');

    const sigBuffer = Buffer.from(signature, 'hex');
    const expectedBuffer = Buffer.from(expectedSignature, 'hex');

    if (sigBuffer.length !== expectedBuffer.length) {
      return false;
    }

    return crypto.timingSafeEqual(sigBuffer, expectedBuffer);
  }

  /**
   * Processes a test refund.
   */
  public async processRefund(
    paymentId: string,
    amountPaise?: number,
    notes?: Record<string, string>
  ): Promise<RazorpayRefundResult> {
    const refundId = `rfnd_${crypto.randomUUID().replace(/[^a-zA-Z0-9]/g, '').substring(0, 14)}`;

    return {
      id: refundId,
      entity: 'refund',
      amount: amountPaise || 0,
      currency: 'INR',
      payment_id: paymentId,
      status: 'processed',
      notes: notes || {},
      created_at: Math.floor(Date.now() / 1000),
    };
  }
}

export const defaultRazorpayClient = new RazorpayClientWrapper();

export function createRazorpayClientWrapper(config?: Partial<RazorpayClientConfig>) {
  return new RazorpayClientWrapper(config);
}
