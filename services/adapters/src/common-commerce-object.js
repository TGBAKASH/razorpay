"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BuyerIntentSubmissionSchema = exports.CommonCommerceObjectSchema = exports.FulfillmentSectionSchema = exports.FulfillmentEventSchema = exports.PaymentSectionSchema = exports.PaymentStatusSchema = exports.AuthorizationSectionSchema = exports.OfferSectionSchema = exports.CartSectionSchema = exports.CartItemSchema = exports.BuyerConstraintsSectionSchema = exports.IntentSectionSchema = exports.PriorityFactorSchema = exports.PaymentPreferenceMethodSchema = exports.ProtocolSourceSchema = void 0;
const zod_1 = require("zod");
// Protocol sources
exports.ProtocolSourceSchema = zod_1.z.enum(['ACP', 'UCP', 'AP2', 'mock-UAP', 'simulator']);
// Payment method preference
exports.PaymentPreferenceMethodSchema = zod_1.z.enum(['upi', 'card', 'netbanking', 'cod']);
// Priority rankings
exports.PriorityFactorSchema = zod_1.z.enum(['price', 'delivery_speed', 'return_terms', 'extras']);
// 1. Intent section
exports.IntentSectionSchema = zod_1.z.object({
    id: zod_1.z.string().uuid().or(zod_1.z.string().min(1)),
    buyer_agent_id: zod_1.z.string().min(1),
    protocol_source: exports.ProtocolSourceSchema,
    category: zod_1.z.string().min(1),
    raw_query: zod_1.z.string().optional().nullable(),
    created_at: zod_1.z.string().datetime().or(zod_1.z.string()),
});
// 2. Buyer constraints section
exports.BuyerConstraintsSectionSchema = zod_1.z.object({
    budget_max_paise: zod_1.z.number().int().positive('Budget max paise must be a positive integer'),
    currency: zod_1.z.literal('INR').default('INR'),
    delivery_deadline: zod_1.z.string().min(1, 'Delivery deadline is required'), // ISO8601 date string
    quantity: zod_1.z.number().int().positive('Quantity must be at least 1').default(1),
    payment_preference: zod_1.z.array(exports.PaymentPreferenceMethodSchema).min(1, 'At least one payment method preference is required'),
    return_preference: zod_1.z.string().min(1, 'Return preference is required'),
    priorities: zod_1.z.array(exports.PriorityFactorSchema).min(1, 'Priorities must be specified'),
});
// 3. Cart section
exports.CartItemSchema = zod_1.z.object({
    sku: zod_1.z.string().min(1),
    qty: zod_1.z.number().int().positive(),
    list_price_paise: zod_1.z.number().int().positive(),
});
exports.CartSectionSchema = zod_1.z.object({
    items: zod_1.z.array(exports.CartItemSchema).default([]),
});
// 4. Offer section
exports.OfferSectionSchema = zod_1.z.object({
    offer_id: zod_1.z.string().uuid().or(zod_1.z.string().min(1)),
    sku: zod_1.z.string().min(1),
    quantity: zod_1.z.number().int().positive(),
    final_price_paise: zod_1.z.number().int().positive(),
    discount_paise: zod_1.z.number().int().nonnegative(),
    discount_reason: zod_1.z.array(zod_1.z.string()),
    delivery_promise: zod_1.z.string().min(1), // ISO8601 date
    return_terms_days: zod_1.z.number().int().nonnegative(),
    payment_methods_allowed: zod_1.z.array(zod_1.z.string()),
    expires_at: zod_1.z.string().min(1), // ISO8601 timestamp
    policy_version: zod_1.z.string().min(1),
});
// 5. Authorization section
exports.AuthorizationSectionSchema = zod_1.z.object({
    signature: zod_1.z.string().min(1),
    signing_key_id: zod_1.z.string().min(1),
    nonce: zod_1.z.string().min(1),
    signed_at: zod_1.z.string().min(1), // ISO8601 timestamp
});
// 6. Payment section
exports.PaymentStatusSchema = zod_1.z.enum(['PENDING', 'PAID', 'FAILED', 'REFUNDED']);
exports.PaymentSectionSchema = zod_1.z.object({
    razorpay_order_id: zod_1.z.string().nullable(),
    razorpay_payment_id: zod_1.z.string().nullable(),
    status: exports.PaymentStatusSchema,
    amount_paise: zod_1.z.number().int().nonnegative(),
    method: zod_1.z.string().nullable(),
});
// 7. Fulfillment section
exports.FulfillmentEventSchema = zod_1.z.object({
    at: zod_1.z.string().min(1),
    event: zod_1.z.string().min(1),
    detail: zod_1.z.record(zod_1.z.unknown()),
});
exports.FulfillmentSectionSchema = zod_1.z.object({
    state: zod_1.z.string().min(1),
    events: zod_1.z.array(exports.FulfillmentEventSchema).default([]),
});
// Root Common Commerce Object Schema
exports.CommonCommerceObjectSchema = zod_1.z.object({
    intent: exports.IntentSectionSchema,
    buyer_constraints: exports.BuyerConstraintsSectionSchema,
    cart: exports.CartSectionSchema.default({ items: [] }),
    offer: exports.OfferSectionSchema.optional().nullable(),
    authorization: exports.AuthorizationSectionSchema.optional().nullable(),
    payment: exports.PaymentSectionSchema.optional().nullable(),
    fulfillment: exports.FulfillmentSectionSchema.default({ state: 'REQUEST_RECEIVED', events: [] }),
});
// Submission schema for Buyer Agent / Simulator requests
exports.BuyerIntentSubmissionSchema = zod_1.z.object({
    buyer_agent_id: zod_1.z.string().optional().default('buyer-agent-sim-01'),
    protocol_source: exports.ProtocolSourceSchema.optional().default('simulator'),
    category: zod_1.z.string().min(1, 'Category is required'),
    raw_query: zod_1.z.string().optional(),
    buyer_constraints: exports.BuyerConstraintsSectionSchema,
    cart: exports.CartSectionSchema.optional().default({ items: [] }),
});
//# sourceMappingURL=common-commerce-object.js.map