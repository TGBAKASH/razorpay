import { z } from 'zod';

// Protocol sources
export const ProtocolSourceSchema = z.enum(['ACP', 'UCP', 'AP2', 'mock-UAP', 'x402', 'simulator']);
export type ProtocolSource = z.infer<typeof ProtocolSourceSchema>;

// Payment method preference
export const PaymentPreferenceMethodSchema = z.enum(['upi', 'card', 'netbanking', 'cod']);
export type PaymentPreferenceMethod = z.infer<typeof PaymentPreferenceMethodSchema>;

// Priority rankings
export const PriorityFactorSchema = z.enum(['price', 'delivery_speed', 'return_terms', 'extras']);
export type PriorityFactor = z.infer<typeof PriorityFactorSchema>;

// 1. Intent section
export const IntentSectionSchema = z.object({
  id: z.string().uuid().or(z.string().min(1)),
  buyer_agent_id: z.string().min(1),
  protocol_source: ProtocolSourceSchema,
  category: z.string().min(1),
  raw_query: z.string().optional().nullable(),
  created_at: z.string().datetime().or(z.string()),
});
export type IntentSection = z.infer<typeof IntentSectionSchema>;

// 2. Buyer constraints section
export const BuyerConstraintsSectionSchema = z.object({
  budget_max_paise: z.number().int().positive('Budget max paise must be a positive integer'),
  currency: z.literal('INR').default('INR'),
  delivery_deadline: z.string().min(1, 'Delivery deadline is required'), // ISO8601 date string
  quantity: z.number().int().positive('Quantity must be at least 1').default(1),
  payment_preference: z.array(PaymentPreferenceMethodSchema).min(1, 'At least one payment method preference is required'),
  return_preference: z.string().min(1, 'Return preference is required'),
  priorities: z.array(PriorityFactorSchema).min(1, 'Priorities must be specified'),
});
export type BuyerConstraintsSection = z.infer<typeof BuyerConstraintsSectionSchema>;

// 3. Cart section
export const CartItemSchema = z.object({
  sku: z.string().min(1),
  qty: z.number().int().positive(),
  list_price_paise: z.number().int().positive(),
});
export type CartItem = z.infer<typeof CartItemSchema>;

export const CartSectionSchema = z.object({
  items: z.array(CartItemSchema).default([]),
});
export type CartSection = z.infer<typeof CartSectionSchema>;

// 4. Offer section
export const OfferSectionSchema = z.object({
  offer_id: z.string().uuid().or(z.string().min(1)),
  sku: z.string().min(1),
  quantity: z.number().int().positive(),
  final_price_paise: z.number().int().positive(),
  discount_paise: z.number().int().nonnegative(),
  discount_reason: z.array(z.string()),
  delivery_promise: z.string().min(1), // ISO8601 date
  return_terms_days: z.number().int().nonnegative(),
  payment_methods_allowed: z.array(z.string()),
  expires_at: z.string().min(1), // ISO8601 timestamp
  policy_version: z.string().min(1),
});
export type OfferSection = z.infer<typeof OfferSectionSchema>;

// 5. Authorization section
export const AuthorizationSectionSchema = z.object({
  signature: z.string().min(1),
  signing_key_id: z.string().min(1),
  nonce: z.string().min(1),
  signed_at: z.string().min(1), // ISO8601 timestamp
});
export type AuthorizationSection = z.infer<typeof AuthorizationSectionSchema>;

// 6. Payment section
export const PaymentStatusSchema = z.enum(['PENDING', 'PAID', 'FAILED', 'REFUNDED']);
export type PaymentStatus = z.infer<typeof PaymentStatusSchema>;

export const PaymentSectionSchema = z.object({
  razorpay_order_id: z.string().nullable(),
  razorpay_payment_id: z.string().nullable(),
  status: PaymentStatusSchema,
  amount_paise: z.number().int().nonnegative(),
  method: z.string().nullable(),
});
export type PaymentSection = z.infer<typeof PaymentSectionSchema>;

// 7. Fulfillment section
export const FulfillmentEventSchema = z.object({
  at: z.string().min(1),
  event: z.string().min(1),
  detail: z.record(z.unknown()),
});
export type FulfillmentEvent = z.infer<typeof FulfillmentEventSchema>;

export const FulfillmentSectionSchema = z.object({
  state: z.string().min(1),
  events: z.array(FulfillmentEventSchema).default([]),
});
export type FulfillmentSection = z.infer<typeof FulfillmentSectionSchema>;

// Root Common Commerce Object Schema
export const CommonCommerceObjectSchema = z.object({
  intent: IntentSectionSchema,
  buyer_constraints: BuyerConstraintsSectionSchema,
  cart: CartSectionSchema.default({ items: [] }),
  offer: OfferSectionSchema.optional().nullable(),
  authorization: AuthorizationSectionSchema.optional().nullable(),
  payment: PaymentSectionSchema.optional().nullable(),
  fulfillment: FulfillmentSectionSchema.default({ state: 'REQUEST_RECEIVED', events: [] }),
});
export type CommonCommerceObject = z.infer<typeof CommonCommerceObjectSchema>;

// Submission schema for Buyer Agent / Simulator requests
export const BuyerIntentSubmissionSchema = z.object({
  buyer_agent_id: z.string().optional().default('buyer-agent-sim-01'),
  protocol_source: ProtocolSourceSchema.optional().default('simulator'),
  category: z.string().min(1, 'Category is required'),
  raw_query: z.string().optional(),
  buyer_constraints: BuyerConstraintsSectionSchema,
  cart: CartSectionSchema.optional().default({ items: [] }),
});
export type BuyerIntentSubmission = z.infer<typeof BuyerIntentSubmissionSchema>;
