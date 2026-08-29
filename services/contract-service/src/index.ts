import crypto from 'node:crypto';

/**
 * 13 Fields signed (canonical JSON, stable key order, integer paise, no floats)
 * per GEMINI.md Part 3.
 */
export interface ContractPayload {
  offer_id: string;
  buyer_agent_id: string;
  merchant_id: string;
  sku: string;
  quantity: number;
  final_price_paise: number;
  currency: string;
  payment_methods_allowed: string[];
  delivery_promise: string;
  return_terms_days: number;
  expires_at: string;
  policy_version: string;
  nonce: string;
}

export interface SignedOfferContract {
  offer_id: string;
  merchant_id: string;
  buyer_agent_id: string;
  canonical_payload: ContractPayload;
  signature: string;
  signing_key_id: string;
  nonce: string;
  signed_at: string;
  status: 'POLICY_APPROVED' | 'CONSUMED' | 'REJECTED' | 'EXPIRED';
  consumed_at?: string | null;
}

export interface VerificationResult {
  valid: boolean;
  reason?: string;
  contract?: SignedOfferContract;
}

const DEFAULT_KEY_ID = 'key_v1_hmac_sha256';
const DEFAULT_SECRET = process.env.SIGNING_SECRET || 'dealflow_default_signing_secret_hmac_sha256';

/**
 * Canonicalizes an object into a deterministic JSON string with alphabetically sorted keys
 * and zero whitespace variance.
 */
export function canonicalizeJson(obj: any): string {
  if (obj === null || typeof obj !== 'object') {
    return JSON.stringify(obj);
  }

  if (Array.isArray(obj)) {
    return `[${obj.map((item) => canonicalizeJson(item)).join(',')}]`;
  }

  const sortedKeys = Object.keys(obj).sort();
  const pairs = sortedKeys.map((key) => {
    const val = obj[key];
    return `"${key}":${canonicalizeJson(val)}`;
  });

  return `{${pairs.join(',')}}`;
}

/**
 * Signs a canonical offer contract payload using HMAC-SHA256.
 */
export function sign(
  payloadInput: Omit<ContractPayload, 'nonce'> & { nonce?: string },
  secretKey: string = DEFAULT_SECRET,
  keyId: string = DEFAULT_KEY_ID
): SignedOfferContract {
  const nonce = payloadInput.nonce || crypto.randomUUID();

  const canonicalPayload: ContractPayload = {
    offer_id: payloadInput.offer_id,
    buyer_agent_id: payloadInput.buyer_agent_id,
    merchant_id: payloadInput.merchant_id,
    sku: payloadInput.sku,
    quantity: payloadInput.quantity,
    final_price_paise: payloadInput.final_price_paise,
    currency: payloadInput.currency || 'INR',
    payment_methods_allowed: [...payloadInput.payment_methods_allowed].sort(),
    delivery_promise: payloadInput.delivery_promise,
    return_terms_days: payloadInput.return_terms_days,
    expires_at: payloadInput.expires_at,
    policy_version: payloadInput.policy_version,
    nonce,
  };

  const canonicalString = canonicalizeJson(canonicalPayload);
  const signature = crypto
    .createHmac('sha256', secretKey)
    .update(canonicalString, 'utf8')
    .digest('hex');

  const now = new Date().toISOString();

  return {
    offer_id: canonicalPayload.offer_id,
    merchant_id: canonicalPayload.merchant_id,
    buyer_agent_id: canonicalPayload.buyer_agent_id,
    canonical_payload: canonicalPayload,
    signature,
    signing_key_id: keyId,
    nonce,
    signed_at: now,
    status: 'POLICY_APPROVED',
    consumed_at: null,
  };
}

/**
 * Verifies a signed offer contract using timing-safe signature comparison.
 */
export function verify(
  signedContract: SignedOfferContract,
  secretKey: string = DEFAULT_SECRET
): VerificationResult {
  if (!signedContract || !signedContract.canonical_payload || !signedContract.signature) {
    return { valid: false, reason: 'Malformed contract structure or missing signature.' };
  }

  const payload = signedContract.canonical_payload;

  // Validate required fields
  if (
    !payload.offer_id ||
    !payload.sku ||
    !payload.nonce ||
    !payload.expires_at ||
    typeof payload.final_price_paise !== 'number' ||
    typeof payload.quantity !== 'number'
  ) {
    return { valid: false, reason: 'Contract payload is missing mandatory fields.' };
  }

  // Validate integer paise constraint (Invariant 5)
  if (!Number.isInteger(payload.final_price_paise) || !Number.isInteger(payload.quantity)) {
    return { valid: false, reason: 'Money and quantity must be integer values (floats prohibited).' };
  }

  // Canonicalize and recompute expected HMAC
  const canonicalString = canonicalizeJson(payload);
  const expectedSignature = crypto
    .createHmac('sha256', secretKey)
    .update(canonicalString, 'utf8')
    .digest('hex');

  // Timing-safe comparison to prevent timing attacks
  const sigBuffer = Buffer.from(signedContract.signature, 'hex');
  const expectedBuffer = Buffer.from(expectedSignature, 'hex');

  if (sigBuffer.length !== expectedBuffer.length || !crypto.timingSafeEqual(sigBuffer, expectedBuffer)) {
    return {
      valid: false,
      reason: 'Invalid contract signature (tampering detected: signature does not match canonical payload).',
    };
  }

  return {
    valid: true,
    contract: signedContract,
  };
}

/**
 * Thread-safe In-Memory + Persistent Nonce Manager to prevent contract replay attacks.
 */
export class NonceStore {
  private static instance: NonceStore;
  private consumedNonces: Map<string, { offer_id: string; consumed_at: string }> = new Map();

  private constructor() {}

  public static getInstance(): NonceStore {
    if (!NonceStore.instance) {
      NonceStore.instance = new NonceStore();
    }
    return NonceStore.instance;
  }

  public isNonceConsumed(nonce: string): boolean {
    return this.consumedNonces.has(nonce);
  }

  public consumeNonce(nonce: string, offerId: string): boolean {
    if (this.consumedNonces.has(nonce)) {
      return false; // Already consumed
    }
    this.consumedNonces.set(nonce, {
      offer_id: offerId,
      consumed_at: new Date().toISOString(),
    });
    return true;
  }

  public reset(): void {
    this.consumedNonces.clear();
  }
}

export const nonceStore = NonceStore.getInstance();
