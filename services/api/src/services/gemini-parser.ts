import {
  type BuyerConstraintsSection,
  type PaymentPreferenceMethod,
  type PriorityFactor,
} from '@razorpay-dealflow/adapters';

export interface ParseIntentResult {
  category?: string;
  buyer_constraints?: Partial<BuyerConstraintsSection>;
  missing_fields: string[];
  is_complete: boolean;
  raw_query: string;
  parsed_by?: 'gemini_1.5_flash' | 'deterministic_rules';
}

export interface ParsePolicyResult {
  policy: {
    minMarginPct?: number;
    maxDiscountPct?: number;
    freeDeliveryAbovePaise?: number;
    noDiscountFastMoving?: boolean;
    clearWithinDays?: number;
    prepaidDiscountOnHighCodRisk?: boolean;
    humanApprovalAbovePaise?: number;
  };
  raw_query: string;
  explanation: string;
}

/**
 * Calculates the next upcoming occurrence of a weekday relative to referenceDate.
 */
export function getUpcomingWeekdayDate(weekdayName: string, referenceDate: Date = new Date()): string {
  const days: Record<string, number> = {
    sunday: 0,
    monday: 1,
    tuesday: 2,
    wednesday: 3,
    thursday: 4,
    friday: 5,
    saturday: 6,
  };

  const targetDay = days[weekdayName.toLowerCase()];
  if (targetDay === undefined) {
    const d = new Date(referenceDate);
    d.setDate(d.getDate() + 3);
    d.setHours(23, 59, 59, 0);
    return d.toISOString();
  }

  const currentDay = referenceDate.getDay();
  let daysToAdd = (targetDay - currentDay + 7) % 7;
  if (daysToAdd === 0) {
    daysToAdd = 7;
  }

  const result = new Date(referenceDate);
  result.setDate(result.getDate() + daysToAdd);
  result.setHours(23, 59, 59, 0);
  return result.toISOString();
}

/**
 * Deterministic rule-based extraction fallback with multilingual (Hinglish/English) parsing.
 */
export function extractIntentDeterministically(
  query: string,
  referenceDate: Date = new Date()
): {
  category?: string;
  budget_max_paise?: number;
  delivery_deadline?: string;
  quantity?: number;
  payment_preference?: PaymentPreferenceMethod[];
  return_preference?: string;
  priorities?: PriorityFactor[];
} {
  const lower = query.toLowerCase();

  // 1. Category extraction (English & Hindi/Hinglish terms)
  let category: string | undefined;
  if (
    lower.includes('running shoe') ||
    lower.includes('shoes') ||
    lower.includes('footwear') ||
    lower.includes('sneakers') ||
    lower.includes('jootey') ||
    lower.includes('joote') ||
    lower.includes('sprintpro')
  ) {
    category = 'running shoes';
  } else if (
    lower.includes('gift box') ||
    lower.includes('gift') ||
    lower.includes('corporate gift') ||
    lower.includes('hamper')
  ) {
    category = 'corporate gift box';
  } else if (lower.includes('electronics') || lower.includes('phone') || lower.includes('laptop')) {
    category = 'electronics';
  } else if (lower.includes('apparel') || lower.includes('clothing') || lower.includes('shirt')) {
    category = 'apparel';
  }

  // 2. Budget extraction (Paise, Numbers, and Hindi number words)
  let budget_max_paise: number | undefined;

  // Check Hindi number phrases first: e.g. "teen hazar", "do hazar", "ek hazar", "char hazar", "panch hazar"
  const hindiNumberMap: Record<string, number> = {
    'ek hazar': 1000,
    'do hazar': 2000,
    'teen hazar': 3000,
    'char hazar': 4000,
    'panch hazar': 5000,
    'dus hazar': 10000,
    'bees hazar': 20000,
  };

  for (const [phrase, value] of Object.entries(hindiNumberMap)) {
    if (lower.includes(phrase)) {
      budget_max_paise = value * 100;
      break;
    }
  }

  if (!budget_max_paise) {
    const budgetMatch = query.match(
      /(?:under|below|max|budget of|within|se zyada nahi|kam)?\s*(?:₹|rs\.?|inr)?\s*([0-9,]+(?:\.[0-9]+)?)\s*(k|thousand|rupees|rs|paise)?/i
    );
    if (budgetMatch && budgetMatch[1]) {
      const numStr = budgetMatch[1].replace(/,/g, '');
      let num = parseFloat(numStr);
      const unit = budgetMatch[2]?.toLowerCase();

      if (!isNaN(num) && num > 0) {
        if (unit === 'k' || unit === 'thousand') {
          num = num * 1000;
        }
        if (unit === 'paise') {
          budget_max_paise = Math.round(num);
        } else {
          budget_max_paise = Math.round(num * 100);
        }
      }
    }
  }

  // 3. Delivery deadline (English days, "jaldi", "turant", "tomorrow")
  let delivery_deadline: string | undefined;
  const weekdayMatch = lower.match(/(?:by|before|on|delivered by)\s+(monday|tuesday|wednesday|thursday|friday|saturday|sunday)/i);
  if (weekdayMatch && weekdayMatch[1]) {
    delivery_deadline = getUpcomingWeekdayDate(weekdayMatch[1], referenceDate);
  } else if (lower.includes('tomorrow') || lower.includes('kal')) {
    const d = new Date(referenceDate);
    d.setDate(d.getDate() + 1);
    d.setHours(23, 59, 59, 0);
    delivery_deadline = d.toISOString();
  } else if (lower.includes('today') || lower.includes('aaj')) {
    const d = new Date(referenceDate);
    d.setHours(23, 59, 59, 0);
    delivery_deadline = d.toISOString();
  } else if (lower.includes('jaldi') || lower.includes('turant') || lower.includes('fast') || lower.includes('urgent')) {
    const d = new Date(referenceDate);
    d.setDate(d.getDate() + 2); // 2-day express SLA
    d.setHours(23, 59, 59, 0);
    delivery_deadline = d.toISOString();
  }

  // 4. Quantity
  let quantity = 1;
  const qtyMatch = lower.match(/(?:^|\s)(\d+)\s+(?:units|items|pieces|pairs|boxes|running shoes|gift boxes)/i);
  if (qtyMatch && qtyMatch[1]) {
    quantity = parseInt(qtyMatch[1], 10);
  }

  // 5. Payment preference
  const payment_preference: PaymentPreferenceMethod[] = [];
  if (lower.includes('upi') || lower.includes('gpay') || lower.includes('phonepe') || lower.includes('paytm')) {
    payment_preference.push('upi');
  }
  if (lower.includes('card') || lower.includes('credit') || lower.includes('debit')) {
    payment_preference.push('card');
  }
  if (lower.includes('netbanking') || lower.includes('net banking')) {
    payment_preference.push('netbanking');
  }
  if (lower.includes('cod') || lower.includes('cash on delivery')) {
    payment_preference.push('cod');
  }

  // 6. Return preference
  let return_preference: string | undefined;
  if (lower.includes('no return') || lower.includes('final sale')) {
    return_preference = 'none';
  } else if (lower.includes('easy return') || lower.includes('easy returns')) {
    return_preference = 'easy returns';
  } else if (lower.includes('standard return')) {
    return_preference = 'standard returns';
  } else if (lower.includes('return')) {
    return_preference = 'easy returns';
  }

  // 7. Priorities (including order of occurrence and Hindi terms: "saste", "sasta", "kam daam", "jaldi", "turant")
  const priceIndex = lower.search(/\b(cheap|cheapest|lowest price|best price|saste|sasta|kam daam|bachat|discount)\b/);
  const fastIndex = lower.search(/\b(fast|fastest|quick|express|speed|jaldi|turant|urgent|same day|next day|delivered by)\b/);
  const returnIndex = lower.search(/\b(return|returns|replacement|easy return)\b/);
  const budgetWordIndex = lower.search(/\b(budget|under|below|max)\b/);

  const detectedPriorities: { type: PriorityFactor; index: number }[] = [];

  if (priceIndex !== -1) {
    detectedPriorities.push({ type: 'price', index: priceIndex });
  } else if (budgetWordIndex !== -1 && fastIndex === -1) {
    // "budget 3000" alone without fast delivery mentioned defaults to price priority
    detectedPriorities.push({ type: 'price', index: budgetWordIndex });
  }

  if (fastIndex !== -1) {
    detectedPriorities.push({ type: 'delivery_speed', index: fastIndex });
  }

  if (returnIndex !== -1) {
    detectedPriorities.push({ type: 'return_terms', index: returnIndex });
  }

  // Sort by first occurrence in query to respect user precedence (e.g. "fastest and cheapest" vs "cheapest and fastest")
  detectedPriorities.sort((a, b) => a.index - b.index);

  const priorities: PriorityFactor[] = detectedPriorities.map((p) => p.type);
  const allPriorities: PriorityFactor[] = ['price', 'delivery_speed', 'return_terms', 'extras'];
  allPriorities.forEach((p) => {
    if (!priorities.includes(p)) priorities.push(p);
  });

  return {
    category,
    budget_max_paise,
    delivery_deadline,
    quantity,
    payment_preference: payment_preference.length > 0 ? payment_preference : undefined,
    return_preference,
    priorities,
  };
}

/**
 * Parses natural language buyer intent into structured CCO fields using Gemini or multilingual fallback.
 */
export async function parseBuyerIntent(
  rawQuery: string,
  referenceDateString?: string
): Promise<ParseIntentResult> {
  const refDate = referenceDateString ? new Date(referenceDateString) : new Date();
  let extracted: ReturnType<typeof extractIntentDeterministically> | null = null;
  let parsedBy: 'gemini_1.5_flash' | 'deterministic_rules' = 'deterministic_rules';
  const apiKey = process.env.GEMINI_API_KEY;

  if (apiKey && apiKey.trim() !== '') {
    try {
      const prompt = `You are an AI intent parser for an agentic commerce negotiation engine.
Analyze the buyer's query (which may be in English, Hindi, or mixed Hinglish) and extract structured constraints in JSON format.
Buyer Query: "${rawQuery}"
Reference Date: ${refDate.toISOString()}

JSON Schema:
{
  "category": string | null (e.g. "running shoes", "corporate gift box"),
  "budget_max_paise": integer | null (e.g. ₹3,000 / teen hazar = 300000),
  "delivery_deadline": ISO8601 date string | null,
  "quantity": integer,
  "payment_preference": ["upi" | "card" | "netbanking" | "cod"],
  "return_preference": string | null,
  "priorities": ["price" | "delivery_speed" | "return_terms" | "extras"]
}

Important Rules:
- Hindi words like "teen hazar" = 3000 INR = 300000 paise.
- If the user explicitly asks for "fast delivery", "fastest delivery", "express", "urgent", "jaldi", "turant", or specifies a delivery date priority, put "delivery_speed" first in priorities: ["delivery_speed", ...] (even if a budget number like "budget 3000" is also present).
- A budget ceiling like "budget 3000" or "under 4000" sets "budget_max_paise", but is NOT priority = price unless words like "cheap", "cheapest", "lowest price", "saste", or "sasta" are explicitly requested as a priority.
- If both price and speed are mentioned, follow their exact order of occurrence:
  - "cheapest and fastest" -> ["price", "delivery_speed", "return_terms", "extras"]
  - "fastest and cheapest" -> ["delivery_speed", "price", "return_terms", "extras"]
- Return ONLY valid JSON, no markdown formatting.`;

      console.log(`[Gemini Outbound] POST https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent with query: "${rawQuery}"`);

      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: { responseMimeType: 'application/json' },
          }),
        }
      );

      if (response.ok) {
        const data: any = await response.json();
        const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
        if (text) {
          console.log(`[Gemini Response] Successful structured extraction: ${text.substring(0, 120)}...`);
          const parsed = JSON.parse(text);
          extracted = {
            category: parsed.category || undefined,
            budget_max_paise: typeof parsed.budget_max_paise === 'number' ? Math.round(parsed.budget_max_paise) : undefined,
            delivery_deadline: parsed.delivery_deadline || undefined,
            quantity: parsed.quantity || 1,
            payment_preference: Array.isArray(parsed.payment_preference) && parsed.payment_preference.length > 0 ? parsed.payment_preference : undefined,
            return_preference: parsed.return_preference || undefined,
            priorities: Array.isArray(parsed.priorities) && parsed.priorities.length > 0 ? parsed.priorities : ['price', 'delivery_speed', 'return_terms', 'extras'],
          };
          parsedBy = 'gemini_1.5_flash';
        }
      }
    } catch (apiErr) {
      console.warn('[Gemini Outbound] Request failed, engaging deterministic fallback:', apiErr);
      extracted = null;
    }
  }

  if (!extracted) {
    extracted = extractIntentDeterministically(rawQuery, refDate);
    parsedBy = 'deterministic_rules';
  }

  const missing_fields: string[] = [];
  if (!extracted.category) missing_fields.push('category');
  if (!extracted.budget_max_paise) missing_fields.push('budget_max_paise');
  if (!extracted.delivery_deadline) missing_fields.push('delivery_deadline');
  if (!extracted.payment_preference || extracted.payment_preference.length === 0) missing_fields.push('payment_preference');

  const buyerConstraintsPartial: Partial<BuyerConstraintsSection> = {
    budget_max_paise: extracted.budget_max_paise,
    currency: 'INR',
    delivery_deadline: extracted.delivery_deadline,
    quantity: extracted.quantity || 1,
    payment_preference: extracted.payment_preference,
    return_preference: extracted.return_preference,
    priorities: extracted.priorities || ['price', 'delivery_speed', 'return_terms', 'extras'],
  };

  return {
    category: extracted.category,
    buyer_constraints: buyerConstraintsPartial,
    missing_fields,
    is_complete: missing_fields.length === 0,
    raw_query: rawQuery,
    parsed_by: parsedBy,
  };
}

/**
 * Parses natural language merchant negotiation rules into structured policy configuration.
 */
export async function parseMerchantPolicy(rawQuery: string): Promise<ParsePolicyResult> {
  const lower = rawQuery.toLowerCase();
  let policyResult: ParsePolicyResult['policy'] = {};
  const apiKey = process.env.GEMINI_API_KEY;

  if (apiKey && apiKey.trim() !== '') {
    try {
      const prompt = `You are an AI policy rules extractor for an autonomous merchant commerce agent.
Extract merchant boundary configuration values from this natural language policy specification into JSON:
Merchant Text: "${rawQuery}"

JSON Schema:
{
  "minMarginPct": number | null (e.g. 18.0 for 18%),
  "maxDiscountPct": number | null (e.g. 12.0 for 12%),
  "freeDeliveryAbovePaise": integer | null (e.g. ₹1,499 = 149900),
  "noDiscountFastMoving": boolean | null,
  "clearWithinDays": integer | null (e.g. 30),
  "prepaidDiscountOnHighCodRisk": boolean | null,
  "humanApprovalAbovePaise": integer | null (e.g. ₹15,000 = 1500000)
}

Important Rules:
- Return ONLY valid JSON, no commentary.`;

      console.log(`[Gemini Outbound] POST https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent for Merchant Policy`);

      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: { responseMimeType: 'application/json' },
          }),
        }
      );

      if (response.ok) {
        const data: any = await response.json();
        const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
        if (text) {
          policyResult = JSON.parse(text);
        }
      }
    } catch (err) {
      console.warn('[Gemini Policy Parser] Falling back to deterministic policy extractor:', err);
    }
  }

  // Deterministic fallback regex extraction
  if (Object.keys(policyResult).length === 0) {
    const marginMatch = lower.match(/(?:margin|keep|at least|floor)\s*(?:of)?\s*(\d+(?:\.\d+)?)\s*%/i) ||
      lower.match(/(\d+(?:\.\d+)?)\s*%\s*(?:min|margin)/i);
    if (marginMatch && marginMatch[1]) {
      policyResult.minMarginPct = parseFloat(marginMatch[1]);
    }

    const discountMatch = lower.match(/(?:discount|ceiling|max discount|more than|up to)\s*(?:of)?\s*(\d+(?:\.\d+)?)\s*%/i) ||
      lower.match(/(\d+(?:\.\d+)?)\s*%\s*(?:max|discount)/i);
    if (discountMatch && discountMatch[1]) {
      policyResult.maxDiscountPct = parseFloat(discountMatch[1]);
    }

    const approvalMatch = lower.match(/(?:approval|review|flag)\s*(?:above|over|exceeding)?\s*(?:₹|rs\.?|inr)?\s*([0-9,]+)/i);
    if (approvalMatch && approvalMatch[1]) {
      const amt = parseInt(approvalMatch[1].replace(/,/g, ''), 10);
      if (!isNaN(amt)) policyResult.humanApprovalAbovePaise = amt * 100;
    }

    const deliveryMatch = lower.match(/(?:free delivery|shipping)\s*(?:above|over)?\s*(?:₹|rs\.?|inr)?\s*([0-9,]+)/i);
    if (deliveryMatch && deliveryMatch[1]) {
      const amt = parseInt(deliveryMatch[1].replace(/,/g, ''), 10);
      if (!isNaN(amt)) policyResult.freeDeliveryAbovePaise = amt * 100;
    }

    const clearDaysMatch = lower.match(/(?:clear|clearance|expiring)\s*(?:within)?\s*(\d+)\s*days/i);
    if (clearDaysMatch && clearDaysMatch[1]) {
      policyResult.clearWithinDays = parseInt(clearDaysMatch[1], 10);
    }

    if (lower.includes('no discount') && lower.includes('fast')) {
      policyResult.noDiscountFastMoving = true;
    }
  }

  return {
    policy: policyResult,
    raw_query: rawQuery,
    explanation: 'Successfully parsed natural language merchant policy rules into structured guardrails.',
  };
}
