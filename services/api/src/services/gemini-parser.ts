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
}

/**
 * Calculates the next upcoming occurrence of a weekday (e.g. "Tuesday") relative to referenceDate.
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
    // Default to 3 days from now
    const d = new Date(referenceDate);
    d.setDate(d.getDate() + 3);
    d.setHours(23, 59, 59, 0);
    return d.toISOString();
  }

  const currentDay = referenceDate.getDay();
  let daysToAdd = (targetDay - currentDay + 7) % 7;
  if (daysToAdd === 0) {
    daysToAdd = 7; // Next week's occurrence if today is that day
  }

  const result = new Date(referenceDate);
  result.setDate(result.getDate() + daysToAdd);
  result.setHours(23, 59, 59, 0);
  return result.toISOString();
}

/**
 * Deterministic rule-based extraction fallback (guarantees offline reliability and unit test determinism).
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

  // 1. Category extraction
  let category: string | undefined;
  if (lower.includes('running shoe') || lower.includes('shoes') || lower.includes('footwear') || lower.includes('sneakers')) {
    category = 'running shoes';
  } else if (lower.includes('gift box') || lower.includes('gift') || lower.includes('corporate gift')) {
    category = 'corporate gift box';
  } else if (lower.includes('electronics') || lower.includes('phone') || lower.includes('laptop')) {
    category = 'electronics';
  } else if (lower.includes('apparel') || lower.includes('clothing') || lower.includes('shirt')) {
    category = 'apparel';
  }

  // 2. Budget extraction (in paise)
  let budget_max_paise: number | undefined;
  const budgetMatch = query.match(/(?:under|below|max|budget of|within)?\s*(?:₹|rs\.?|inr)?\s*([0-9,]+(?:\.[0-9]+)?)\s*(k|thousand|rupees|rs|paise)?/i);
  if (budgetMatch && budgetMatch[1]) {
    let numStr = budgetMatch[1].replace(/,/g, '');
    let num = parseFloat(numStr);
    const unit = budgetMatch[2]?.toLowerCase();

    if (!isNaN(num) && num > 0) {
      if (unit === 'k' || unit === 'thousand') {
        num = num * 1000;
      }
      // If the query specified paise or rupees:
      if (unit === 'paise') {
        budget_max_paise = Math.round(num);
      } else {
        budget_max_paise = Math.round(num * 100);
      }
    }
  }

  // 3. Delivery deadline
  let delivery_deadline: string | undefined;
  const weekdayMatch = lower.match(/(?:by|before|on|delivered by)\s+(monday|tuesday|wednesday|thursday|friday|saturday|sunday)/i);
  if (weekdayMatch && weekdayMatch[1]) {
    delivery_deadline = getUpcomingWeekdayDate(weekdayMatch[1], referenceDate);
  } else if (lower.includes('tomorrow')) {
    const d = new Date(referenceDate);
    d.setDate(d.getDate() + 1);
    d.setHours(23, 59, 59, 0);
    delivery_deadline = d.toISOString();
  } else if (lower.includes('today')) {
    const d = new Date(referenceDate);
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
  if (lower.includes('upi')) {
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
  if (lower.includes('prepaid') && payment_preference.length === 0) {
    payment_preference.push('upi', 'card', 'netbanking');
  }

  // 6. Return preference
  let return_preference: string | undefined;
  if (lower.includes('easy return') || lower.includes('easy returns')) {
    return_preference = 'easy returns';
  } else if (lower.includes('15-day') || lower.includes('15 day replacement')) {
    return_preference = '15-day replacement';
  } else if (lower.includes('7-day') || lower.includes('7 day')) {
    return_preference = '7-day return';
  } else if (lower.includes('no return') || lower.includes('non-returnable')) {
    return_preference = 'none';
  } else if (lower.includes('return')) {
    return_preference = 'standard returns';
  }

  // 7. Priorities
  const priorities: PriorityFactor[] = [];
  if (lower.includes('cheap') || lower.includes('budget') || lower.includes('price') || lower.includes('under') || lower.includes('discount')) {
    priorities.push('price');
  }
  if (lower.includes('fast') || lower.includes('express') || lower.includes('speed') || lower.includes('tuesday') || lower.includes('friday') || lower.includes('tomorrow') || lower.includes('delivered by')) {
    if (!priorities.includes('delivery_speed')) priorities.push('delivery_speed');
  }
  if (lower.includes('return') || lower.includes('replacement')) {
    if (!priorities.includes('return_terms')) priorities.push('return_terms');
  }
  // Fill remaining standard priorities
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
 * Parses natural language buyer intent into validated fields and detects missing mandatory fields.
 */
export async function parseBuyerIntent(
  rawQuery: string,
  referenceDateString?: string
): Promise<ParseIntentResult> {
  const refDate = referenceDateString ? new Date(referenceDateString) : new Date();

  // Try Gemini API if key is available
  let extracted: ReturnType<typeof extractIntentDeterministically> | null = null;
  const apiKey = process.env.GEMINI_API_KEY;

  if (apiKey && apiKey.trim() !== '') {
    try {
      const prompt = `You are an AI intent parser for commerce negotiation.
Analyze the following buyer query and extract the structured intent fields in JSON format.
Buyer Query: "${rawQuery}"
Reference Date: ${refDate.toISOString()}

JSON Format Required:
{
  "category": string | null,
  "budget_max_paise": integer (e.g. ₹4000 = 400000) | null,
  "delivery_deadline": ISO8601 date string | null,
  "quantity": integer,
  "payment_preference": ["upi" | "card" | "netbanking" | "cod"],
  "return_preference": string | null,
  "priorities": ["price" | "delivery_speed" | "return_terms" | "extras"]
}

Important Rules:
- Money MUST be integer paise (1 Rupee = 100 paise). NEVER output floats.
- Return ONLY valid JSON, no markdown code fence or commentary.`;

      console.log(`[Gemini Intent Parser] Sending query: "${rawQuery}" to gemini-1.5-flash (API Key: REDACTED)`);
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { responseMimeType: 'application/json' },
        }),
      });

      if (response.ok) {
        const data: any = await response.json();
        const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
        if (text) {
          console.log(`[Gemini Intent Parser] Received structured response: ${text.substring(0, 120)}...`);
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
        }
      }
    } catch {
      // Fallback to deterministic extraction on network or API failure
      extracted = null;
    }
  }

  // Use deterministic extraction if Gemini was not used or failed
  if (!extracted) {
    extracted = extractIntentDeterministically(rawQuery, refDate);
  }

  // Detect missing fields
  const missing_fields: string[] = [];
  if (!extracted.category) missing_fields.push('category');
  if (!extracted.budget_max_paise) missing_fields.push('budget_max_paise');
  if (!extracted.delivery_deadline) missing_fields.push('delivery_deadline');
  if (!extracted.payment_preference || extracted.payment_preference.length === 0) missing_fields.push('payment_preference');
  if (!extracted.return_preference) missing_fields.push('return_preference');

  const buyerConstraintsPartial: Partial<BuyerConstraintsSection> = {
    budget_max_paise: extracted.budget_max_paise,
    currency: 'INR',
    delivery_deadline: extracted.delivery_deadline,
    quantity: extracted.quantity || 1,
    payment_preference: extracted.payment_preference,
    return_preference: extracted.return_preference,
    priorities: extracted.priorities || ['price', 'delivery_speed', 'return_terms', 'extras'],
  };

  const is_complete = missing_fields.length === 0;

  return {
    category: extracted.category,
    buyer_constraints: buyerConstraintsPartial,
    missing_fields,
    is_complete,
    raw_query: rawQuery,
  };
}
