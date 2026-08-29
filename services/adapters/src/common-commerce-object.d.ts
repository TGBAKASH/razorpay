import { z } from 'zod';
export declare const ProtocolSourceSchema: z.ZodEnum<["ACP", "UCP", "AP2", "mock-UAP", "simulator"]>;
export type ProtocolSource = z.infer<typeof ProtocolSourceSchema>;
export declare const PaymentPreferenceMethodSchema: z.ZodEnum<["upi", "card", "netbanking", "cod"]>;
export type PaymentPreferenceMethod = z.infer<typeof PaymentPreferenceMethodSchema>;
export declare const PriorityFactorSchema: z.ZodEnum<["price", "delivery_speed", "return_terms", "extras"]>;
export type PriorityFactor = z.infer<typeof PriorityFactorSchema>;
export declare const IntentSectionSchema: z.ZodObject<{
    id: z.ZodUnion<[z.ZodString, z.ZodString]>;
    buyer_agent_id: z.ZodString;
    protocol_source: z.ZodEnum<["ACP", "UCP", "AP2", "mock-UAP", "simulator"]>;
    category: z.ZodString;
    raw_query: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    created_at: z.ZodUnion<[z.ZodString, z.ZodString]>;
}, "strip", z.ZodTypeAny, {
    id: string;
    buyer_agent_id: string;
    protocol_source: "ACP" | "UCP" | "AP2" | "mock-UAP" | "simulator";
    category: string;
    created_at: string;
    raw_query?: string | null | undefined;
}, {
    id: string;
    buyer_agent_id: string;
    protocol_source: "ACP" | "UCP" | "AP2" | "mock-UAP" | "simulator";
    category: string;
    created_at: string;
    raw_query?: string | null | undefined;
}>;
export type IntentSection = z.infer<typeof IntentSectionSchema>;
export declare const BuyerConstraintsSectionSchema: z.ZodObject<{
    budget_max_paise: z.ZodNumber;
    currency: z.ZodDefault<z.ZodLiteral<"INR">>;
    delivery_deadline: z.ZodString;
    quantity: z.ZodDefault<z.ZodNumber>;
    payment_preference: z.ZodArray<z.ZodEnum<["upi", "card", "netbanking", "cod"]>, "many">;
    return_preference: z.ZodString;
    priorities: z.ZodArray<z.ZodEnum<["price", "delivery_speed", "return_terms", "extras"]>, "many">;
}, "strip", z.ZodTypeAny, {
    budget_max_paise: number;
    currency: "INR";
    delivery_deadline: string;
    quantity: number;
    payment_preference: ("upi" | "card" | "netbanking" | "cod")[];
    return_preference: string;
    priorities: ("price" | "delivery_speed" | "return_terms" | "extras")[];
}, {
    budget_max_paise: number;
    delivery_deadline: string;
    payment_preference: ("upi" | "card" | "netbanking" | "cod")[];
    return_preference: string;
    priorities: ("price" | "delivery_speed" | "return_terms" | "extras")[];
    currency?: "INR" | undefined;
    quantity?: number | undefined;
}>;
export type BuyerConstraintsSection = z.infer<typeof BuyerConstraintsSectionSchema>;
export declare const CartItemSchema: z.ZodObject<{
    sku: z.ZodString;
    qty: z.ZodNumber;
    list_price_paise: z.ZodNumber;
}, "strip", z.ZodTypeAny, {
    sku: string;
    qty: number;
    list_price_paise: number;
}, {
    sku: string;
    qty: number;
    list_price_paise: number;
}>;
export type CartItem = z.infer<typeof CartItemSchema>;
export declare const CartSectionSchema: z.ZodObject<{
    items: z.ZodDefault<z.ZodArray<z.ZodObject<{
        sku: z.ZodString;
        qty: z.ZodNumber;
        list_price_paise: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        sku: string;
        qty: number;
        list_price_paise: number;
    }, {
        sku: string;
        qty: number;
        list_price_paise: number;
    }>, "many">>;
}, "strip", z.ZodTypeAny, {
    items: {
        sku: string;
        qty: number;
        list_price_paise: number;
    }[];
}, {
    items?: {
        sku: string;
        qty: number;
        list_price_paise: number;
    }[] | undefined;
}>;
export type CartSection = z.infer<typeof CartSectionSchema>;
export declare const OfferSectionSchema: z.ZodObject<{
    offer_id: z.ZodUnion<[z.ZodString, z.ZodString]>;
    sku: z.ZodString;
    quantity: z.ZodNumber;
    final_price_paise: z.ZodNumber;
    discount_paise: z.ZodNumber;
    discount_reason: z.ZodArray<z.ZodString, "many">;
    delivery_promise: z.ZodString;
    return_terms_days: z.ZodNumber;
    payment_methods_allowed: z.ZodArray<z.ZodString, "many">;
    expires_at: z.ZodString;
    policy_version: z.ZodString;
}, "strip", z.ZodTypeAny, {
    quantity: number;
    sku: string;
    offer_id: string;
    final_price_paise: number;
    discount_paise: number;
    discount_reason: string[];
    delivery_promise: string;
    return_terms_days: number;
    payment_methods_allowed: string[];
    expires_at: string;
    policy_version: string;
}, {
    quantity: number;
    sku: string;
    offer_id: string;
    final_price_paise: number;
    discount_paise: number;
    discount_reason: string[];
    delivery_promise: string;
    return_terms_days: number;
    payment_methods_allowed: string[];
    expires_at: string;
    policy_version: string;
}>;
export type OfferSection = z.infer<typeof OfferSectionSchema>;
export declare const AuthorizationSectionSchema: z.ZodObject<{
    signature: z.ZodString;
    signing_key_id: z.ZodString;
    nonce: z.ZodString;
    signed_at: z.ZodString;
}, "strip", z.ZodTypeAny, {
    signature: string;
    signing_key_id: string;
    nonce: string;
    signed_at: string;
}, {
    signature: string;
    signing_key_id: string;
    nonce: string;
    signed_at: string;
}>;
export type AuthorizationSection = z.infer<typeof AuthorizationSectionSchema>;
export declare const PaymentStatusSchema: z.ZodEnum<["PENDING", "PAID", "FAILED", "REFUNDED"]>;
export type PaymentStatus = z.infer<typeof PaymentStatusSchema>;
export declare const PaymentSectionSchema: z.ZodObject<{
    razorpay_order_id: z.ZodNullable<z.ZodString>;
    razorpay_payment_id: z.ZodNullable<z.ZodString>;
    status: z.ZodEnum<["PENDING", "PAID", "FAILED", "REFUNDED"]>;
    amount_paise: z.ZodNumber;
    method: z.ZodNullable<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    status: "PENDING" | "PAID" | "FAILED" | "REFUNDED";
    razorpay_order_id: string | null;
    razorpay_payment_id: string | null;
    amount_paise: number;
    method: string | null;
}, {
    status: "PENDING" | "PAID" | "FAILED" | "REFUNDED";
    razorpay_order_id: string | null;
    razorpay_payment_id: string | null;
    amount_paise: number;
    method: string | null;
}>;
export type PaymentSection = z.infer<typeof PaymentSectionSchema>;
export declare const FulfillmentEventSchema: z.ZodObject<{
    at: z.ZodString;
    event: z.ZodString;
    detail: z.ZodRecord<z.ZodString, z.ZodUnknown>;
}, "strip", z.ZodTypeAny, {
    at: string;
    event: string;
    detail: Record<string, unknown>;
}, {
    at: string;
    event: string;
    detail: Record<string, unknown>;
}>;
export type FulfillmentEvent = z.infer<typeof FulfillmentEventSchema>;
export declare const FulfillmentSectionSchema: z.ZodObject<{
    state: z.ZodString;
    events: z.ZodDefault<z.ZodArray<z.ZodObject<{
        at: z.ZodString;
        event: z.ZodString;
        detail: z.ZodRecord<z.ZodString, z.ZodUnknown>;
    }, "strip", z.ZodTypeAny, {
        at: string;
        event: string;
        detail: Record<string, unknown>;
    }, {
        at: string;
        event: string;
        detail: Record<string, unknown>;
    }>, "many">>;
}, "strip", z.ZodTypeAny, {
    state: string;
    events: {
        at: string;
        event: string;
        detail: Record<string, unknown>;
    }[];
}, {
    state: string;
    events?: {
        at: string;
        event: string;
        detail: Record<string, unknown>;
    }[] | undefined;
}>;
export type FulfillmentSection = z.infer<typeof FulfillmentSectionSchema>;
export declare const CommonCommerceObjectSchema: z.ZodObject<{
    intent: z.ZodObject<{
        id: z.ZodUnion<[z.ZodString, z.ZodString]>;
        buyer_agent_id: z.ZodString;
        protocol_source: z.ZodEnum<["ACP", "UCP", "AP2", "mock-UAP", "simulator"]>;
        category: z.ZodString;
        raw_query: z.ZodNullable<z.ZodOptional<z.ZodString>>;
        created_at: z.ZodUnion<[z.ZodString, z.ZodString]>;
    }, "strip", z.ZodTypeAny, {
        id: string;
        buyer_agent_id: string;
        protocol_source: "ACP" | "UCP" | "AP2" | "mock-UAP" | "simulator";
        category: string;
        created_at: string;
        raw_query?: string | null | undefined;
    }, {
        id: string;
        buyer_agent_id: string;
        protocol_source: "ACP" | "UCP" | "AP2" | "mock-UAP" | "simulator";
        category: string;
        created_at: string;
        raw_query?: string | null | undefined;
    }>;
    buyer_constraints: z.ZodObject<{
        budget_max_paise: z.ZodNumber;
        currency: z.ZodDefault<z.ZodLiteral<"INR">>;
        delivery_deadline: z.ZodString;
        quantity: z.ZodDefault<z.ZodNumber>;
        payment_preference: z.ZodArray<z.ZodEnum<["upi", "card", "netbanking", "cod"]>, "many">;
        return_preference: z.ZodString;
        priorities: z.ZodArray<z.ZodEnum<["price", "delivery_speed", "return_terms", "extras"]>, "many">;
    }, "strip", z.ZodTypeAny, {
        budget_max_paise: number;
        currency: "INR";
        delivery_deadline: string;
        quantity: number;
        payment_preference: ("upi" | "card" | "netbanking" | "cod")[];
        return_preference: string;
        priorities: ("price" | "delivery_speed" | "return_terms" | "extras")[];
    }, {
        budget_max_paise: number;
        delivery_deadline: string;
        payment_preference: ("upi" | "card" | "netbanking" | "cod")[];
        return_preference: string;
        priorities: ("price" | "delivery_speed" | "return_terms" | "extras")[];
        currency?: "INR" | undefined;
        quantity?: number | undefined;
    }>;
    cart: z.ZodDefault<z.ZodObject<{
        items: z.ZodDefault<z.ZodArray<z.ZodObject<{
            sku: z.ZodString;
            qty: z.ZodNumber;
            list_price_paise: z.ZodNumber;
        }, "strip", z.ZodTypeAny, {
            sku: string;
            qty: number;
            list_price_paise: number;
        }, {
            sku: string;
            qty: number;
            list_price_paise: number;
        }>, "many">>;
    }, "strip", z.ZodTypeAny, {
        items: {
            sku: string;
            qty: number;
            list_price_paise: number;
        }[];
    }, {
        items?: {
            sku: string;
            qty: number;
            list_price_paise: number;
        }[] | undefined;
    }>>;
    offer: z.ZodNullable<z.ZodOptional<z.ZodObject<{
        offer_id: z.ZodUnion<[z.ZodString, z.ZodString]>;
        sku: z.ZodString;
        quantity: z.ZodNumber;
        final_price_paise: z.ZodNumber;
        discount_paise: z.ZodNumber;
        discount_reason: z.ZodArray<z.ZodString, "many">;
        delivery_promise: z.ZodString;
        return_terms_days: z.ZodNumber;
        payment_methods_allowed: z.ZodArray<z.ZodString, "many">;
        expires_at: z.ZodString;
        policy_version: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        quantity: number;
        sku: string;
        offer_id: string;
        final_price_paise: number;
        discount_paise: number;
        discount_reason: string[];
        delivery_promise: string;
        return_terms_days: number;
        payment_methods_allowed: string[];
        expires_at: string;
        policy_version: string;
    }, {
        quantity: number;
        sku: string;
        offer_id: string;
        final_price_paise: number;
        discount_paise: number;
        discount_reason: string[];
        delivery_promise: string;
        return_terms_days: number;
        payment_methods_allowed: string[];
        expires_at: string;
        policy_version: string;
    }>>>;
    authorization: z.ZodNullable<z.ZodOptional<z.ZodObject<{
        signature: z.ZodString;
        signing_key_id: z.ZodString;
        nonce: z.ZodString;
        signed_at: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        signature: string;
        signing_key_id: string;
        nonce: string;
        signed_at: string;
    }, {
        signature: string;
        signing_key_id: string;
        nonce: string;
        signed_at: string;
    }>>>;
    payment: z.ZodNullable<z.ZodOptional<z.ZodObject<{
        razorpay_order_id: z.ZodNullable<z.ZodString>;
        razorpay_payment_id: z.ZodNullable<z.ZodString>;
        status: z.ZodEnum<["PENDING", "PAID", "FAILED", "REFUNDED"]>;
        amount_paise: z.ZodNumber;
        method: z.ZodNullable<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        status: "PENDING" | "PAID" | "FAILED" | "REFUNDED";
        razorpay_order_id: string | null;
        razorpay_payment_id: string | null;
        amount_paise: number;
        method: string | null;
    }, {
        status: "PENDING" | "PAID" | "FAILED" | "REFUNDED";
        razorpay_order_id: string | null;
        razorpay_payment_id: string | null;
        amount_paise: number;
        method: string | null;
    }>>>;
    fulfillment: z.ZodDefault<z.ZodObject<{
        state: z.ZodString;
        events: z.ZodDefault<z.ZodArray<z.ZodObject<{
            at: z.ZodString;
            event: z.ZodString;
            detail: z.ZodRecord<z.ZodString, z.ZodUnknown>;
        }, "strip", z.ZodTypeAny, {
            at: string;
            event: string;
            detail: Record<string, unknown>;
        }, {
            at: string;
            event: string;
            detail: Record<string, unknown>;
        }>, "many">>;
    }, "strip", z.ZodTypeAny, {
        state: string;
        events: {
            at: string;
            event: string;
            detail: Record<string, unknown>;
        }[];
    }, {
        state: string;
        events?: {
            at: string;
            event: string;
            detail: Record<string, unknown>;
        }[] | undefined;
    }>>;
}, "strip", z.ZodTypeAny, {
    intent: {
        id: string;
        buyer_agent_id: string;
        protocol_source: "ACP" | "UCP" | "AP2" | "mock-UAP" | "simulator";
        category: string;
        created_at: string;
        raw_query?: string | null | undefined;
    };
    buyer_constraints: {
        budget_max_paise: number;
        currency: "INR";
        delivery_deadline: string;
        quantity: number;
        payment_preference: ("upi" | "card" | "netbanking" | "cod")[];
        return_preference: string;
        priorities: ("price" | "delivery_speed" | "return_terms" | "extras")[];
    };
    cart: {
        items: {
            sku: string;
            qty: number;
            list_price_paise: number;
        }[];
    };
    fulfillment: {
        state: string;
        events: {
            at: string;
            event: string;
            detail: Record<string, unknown>;
        }[];
    };
    offer?: {
        quantity: number;
        sku: string;
        offer_id: string;
        final_price_paise: number;
        discount_paise: number;
        discount_reason: string[];
        delivery_promise: string;
        return_terms_days: number;
        payment_methods_allowed: string[];
        expires_at: string;
        policy_version: string;
    } | null | undefined;
    authorization?: {
        signature: string;
        signing_key_id: string;
        nonce: string;
        signed_at: string;
    } | null | undefined;
    payment?: {
        status: "PENDING" | "PAID" | "FAILED" | "REFUNDED";
        razorpay_order_id: string | null;
        razorpay_payment_id: string | null;
        amount_paise: number;
        method: string | null;
    } | null | undefined;
}, {
    intent: {
        id: string;
        buyer_agent_id: string;
        protocol_source: "ACP" | "UCP" | "AP2" | "mock-UAP" | "simulator";
        category: string;
        created_at: string;
        raw_query?: string | null | undefined;
    };
    buyer_constraints: {
        budget_max_paise: number;
        delivery_deadline: string;
        payment_preference: ("upi" | "card" | "netbanking" | "cod")[];
        return_preference: string;
        priorities: ("price" | "delivery_speed" | "return_terms" | "extras")[];
        currency?: "INR" | undefined;
        quantity?: number | undefined;
    };
    cart?: {
        items?: {
            sku: string;
            qty: number;
            list_price_paise: number;
        }[] | undefined;
    } | undefined;
    offer?: {
        quantity: number;
        sku: string;
        offer_id: string;
        final_price_paise: number;
        discount_paise: number;
        discount_reason: string[];
        delivery_promise: string;
        return_terms_days: number;
        payment_methods_allowed: string[];
        expires_at: string;
        policy_version: string;
    } | null | undefined;
    authorization?: {
        signature: string;
        signing_key_id: string;
        nonce: string;
        signed_at: string;
    } | null | undefined;
    payment?: {
        status: "PENDING" | "PAID" | "FAILED" | "REFUNDED";
        razorpay_order_id: string | null;
        razorpay_payment_id: string | null;
        amount_paise: number;
        method: string | null;
    } | null | undefined;
    fulfillment?: {
        state: string;
        events?: {
            at: string;
            event: string;
            detail: Record<string, unknown>;
        }[] | undefined;
    } | undefined;
}>;
export type CommonCommerceObject = z.infer<typeof CommonCommerceObjectSchema>;
export declare const BuyerIntentSubmissionSchema: z.ZodObject<{
    buyer_agent_id: z.ZodDefault<z.ZodOptional<z.ZodString>>;
    protocol_source: z.ZodDefault<z.ZodOptional<z.ZodEnum<["ACP", "UCP", "AP2", "mock-UAP", "simulator"]>>>;
    category: z.ZodString;
    raw_query: z.ZodOptional<z.ZodString>;
    buyer_constraints: z.ZodObject<{
        budget_max_paise: z.ZodNumber;
        currency: z.ZodDefault<z.ZodLiteral<"INR">>;
        delivery_deadline: z.ZodString;
        quantity: z.ZodDefault<z.ZodNumber>;
        payment_preference: z.ZodArray<z.ZodEnum<["upi", "card", "netbanking", "cod"]>, "many">;
        return_preference: z.ZodString;
        priorities: z.ZodArray<z.ZodEnum<["price", "delivery_speed", "return_terms", "extras"]>, "many">;
    }, "strip", z.ZodTypeAny, {
        budget_max_paise: number;
        currency: "INR";
        delivery_deadline: string;
        quantity: number;
        payment_preference: ("upi" | "card" | "netbanking" | "cod")[];
        return_preference: string;
        priorities: ("price" | "delivery_speed" | "return_terms" | "extras")[];
    }, {
        budget_max_paise: number;
        delivery_deadline: string;
        payment_preference: ("upi" | "card" | "netbanking" | "cod")[];
        return_preference: string;
        priorities: ("price" | "delivery_speed" | "return_terms" | "extras")[];
        currency?: "INR" | undefined;
        quantity?: number | undefined;
    }>;
    cart: z.ZodDefault<z.ZodOptional<z.ZodObject<{
        items: z.ZodDefault<z.ZodArray<z.ZodObject<{
            sku: z.ZodString;
            qty: z.ZodNumber;
            list_price_paise: z.ZodNumber;
        }, "strip", z.ZodTypeAny, {
            sku: string;
            qty: number;
            list_price_paise: number;
        }, {
            sku: string;
            qty: number;
            list_price_paise: number;
        }>, "many">>;
    }, "strip", z.ZodTypeAny, {
        items: {
            sku: string;
            qty: number;
            list_price_paise: number;
        }[];
    }, {
        items?: {
            sku: string;
            qty: number;
            list_price_paise: number;
        }[] | undefined;
    }>>>;
}, "strip", z.ZodTypeAny, {
    buyer_agent_id: string;
    protocol_source: "ACP" | "UCP" | "AP2" | "mock-UAP" | "simulator";
    category: string;
    buyer_constraints: {
        budget_max_paise: number;
        currency: "INR";
        delivery_deadline: string;
        quantity: number;
        payment_preference: ("upi" | "card" | "netbanking" | "cod")[];
        return_preference: string;
        priorities: ("price" | "delivery_speed" | "return_terms" | "extras")[];
    };
    cart: {
        items: {
            sku: string;
            qty: number;
            list_price_paise: number;
        }[];
    };
    raw_query?: string | undefined;
}, {
    category: string;
    buyer_constraints: {
        budget_max_paise: number;
        delivery_deadline: string;
        payment_preference: ("upi" | "card" | "netbanking" | "cod")[];
        return_preference: string;
        priorities: ("price" | "delivery_speed" | "return_terms" | "extras")[];
        currency?: "INR" | undefined;
        quantity?: number | undefined;
    };
    buyer_agent_id?: string | undefined;
    protocol_source?: "ACP" | "UCP" | "AP2" | "mock-UAP" | "simulator" | undefined;
    raw_query?: string | undefined;
    cart?: {
        items?: {
            sku: string;
            qty: number;
            list_price_paise: number;
        }[] | undefined;
    } | undefined;
}>;
export type BuyerIntentSubmission = z.infer<typeof BuyerIntentSubmissionSchema>;
//# sourceMappingURL=common-commerce-object.d.ts.map