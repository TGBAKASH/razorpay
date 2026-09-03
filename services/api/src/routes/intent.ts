import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import crypto from 'node:crypto';
import {
  BuyerIntentSubmissionSchema,
  CommonCommerceObjectSchema,
  adaptToCCO,
  type SupportedProtocol,
  type CommonCommerceObject,
} from '@razorpay-dealflow/adapters';
import { parseBuyerIntent, parseMerchantPolicy } from '../services/gemini-parser.js';
import { geminiKeyPool } from '../services/gemini-key-pool.js';

export async function registerIntentRoutes(fastify: FastifyInstance) {
  // 1. Natural Language Intent Parsing endpoint (Buyer)
  fastify.post('/api/intent/parse', async (request: FastifyRequest, reply: FastifyReply) => {
    const body = request.body as { query?: string; reference_date?: string };
    if (!body || typeof body.query !== 'string' || body.query.trim() === '') {
      return reply.status(400).send({
        success: false,
        error: 'Query string is required in request body',
      });
    }

    try {
      const result = await parseBuyerIntent(body.query, body.reference_date);
      return reply.status(200).send({
        success: true,
        ...result,
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unknown parsing error';
      return reply.status(500).send({
        success: false,
        error: `Failed to parse intent: ${message}`,
      });
    }
  });

  // 1a. Gemini API Key Status Check
  fastify.get('/api/debug/gemini-status', async () => {
    const rawKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || process.env.GEMINI_KEY || '';
    const key = rawKey.trim();
    if (!key) {
      return {
        configured: false,
        message: 'No GEMINI_API_KEY found in process.env',
        env_keys_checked: ['GEMINI_API_KEY', 'GOOGLE_API_KEY', 'GEMINI_KEY'],
      };
    }

    try {
      // 1. List available models
      const listRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${key}`);
      let availableModels: string[] = [];
      if (listRes.ok) {
        const listData: any = await listRes.json();
        availableModels = (listData.models || []).map((m: any) => m.name.replace(/^models\//, ''));
      }

      // 2. Try candidate models: gemini-2.0-flash, gemini-1.5-flash-latest, gemini-1.5-pro, gemini-pro
      const candidateModels = availableModels.length > 0 
        ? availableModels.filter(m => m.includes('flash') || m.includes('pro'))
        : ['gemini-2.0-flash', 'gemini-1.5-flash-latest', 'gemini-1.5-pro', 'gemini-pro'];

      let workingModel: string | null = null;
      let workingResponse: string | null = null;
      let lastErrStatus: number | null = null;
      let lastErrText: string | null = null;

      for (const model of candidateModels) {
        try {
          const testRes = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`,
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                contents: [{ parts: [{ text: 'Respond with JSON {"ping": "pong"}' }] }],
                generationConfig: { responseMimeType: 'application/json' },
              }),
            }
          );
          if (testRes.ok) {
            workingModel = model;
            workingResponse = await testRes.text();
            break;
          } else {
            lastErrStatus = testRes.status;
            lastErrText = await testRes.text();
          }
        } catch {}
      }

      return {
        configured: true,
        key_prefix: key.substring(0, 8) + '...',
        available_models_count: availableModels.length,
        available_models: availableModels.slice(0, 10),
        working_model: workingModel,
        working_response: workingResponse,
        last_error_status: lastErrStatus,
        last_error_text: lastErrText ? lastErrText.substring(0, 200) : null,
        pool_status: geminiKeyPool.getPoolStatus(),
      };
    } catch (err: any) {
      return {
        configured: true,
        key_prefix: key.substring(0, 8) + '...',
        network_error: err.message,
      };
    }
  });

  // 1b. Natural Language Policy Rules Parsing endpoint (Merchant)
  fastify.post('/api/policy/interpret-nl', async (request: FastifyRequest, reply: FastifyReply) => {
    const body = request.body as { prompt?: string };
    if (!body || typeof body.prompt !== 'string' || body.prompt.trim() === '') {
      return reply.status(400).send({
        success: false,
        error: 'Prompt string is required in request body',
      });
    }

    try {
      const result = await parseMerchantPolicy(body.prompt);
      return reply.status(200).send({
        success: true,
        ...result,
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unknown policy parsing error';
      return reply.status(500).send({
        success: false,
        error: `Failed to parse merchant policy: ${message}`,
      });
    }
  });

  // 2. Protocol Adapter Ingestion endpoint (Maps ACP, UCP, AP2, MockUAP into CCO)
  fastify.post('/api/intent/adapt', async (request: FastifyRequest, reply: FastifyReply) => {
    const body = request.body as { protocol?: SupportedProtocol; raw_payload?: any };
    if (!body || !body.protocol || !body.raw_payload) {
      return reply.status(400).send({
        success: false,
        error: 'Both protocol and raw_payload are required in request body',
      });
    }

    try {
      const cco = adaptToCCO(body.protocol, body.raw_payload);
      return reply.status(200).send({
        success: true,
        protocol: body.protocol,
        cco,
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unknown adapter mapping error';
      return reply.status(422).send({
        success: false,
        error: `Failed to adapt protocol payload: ${message}`,
      });
    }
  });

  // 3. Intent Ingestion endpoint
  fastify.post('/api/intent', async (request: FastifyRequest, reply: FastifyReply) => {
    const body = request.body;

    // Check if body is full CommonCommerceObject or BuyerIntentSubmission
    const directCCOParsed = CommonCommerceObjectSchema.safeParse(body);
    if (directCCOParsed.success) {
      return reply.status(201).send({
        success: true,
        intent_id: directCCOParsed.data.intent.id,
        cco: directCCOParsed.data,
      });
    }

    const submissionParsed = BuyerIntentSubmissionSchema.safeParse(body);
    if (!submissionParsed.success) {
      return reply.status(400).send({
        success: false,
        error: 'Invalid intent submission payload',
        details: submissionParsed.error.errors,
      });
    }

    const data = submissionParsed.data;
    const intentId = crypto.randomUUID();

    const cco: CommonCommerceObject = {
      intent: {
        id: intentId,
        buyer_agent_id: data.buyer_agent_id || 'buyer-agent-sim-01',
        protocol_source: data.protocol_source || 'simulator',
        category: data.category,
        raw_query: data.raw_query || null,
        created_at: new Date().toISOString(),
      },
      buyer_constraints: data.buyer_constraints,
      cart: data.cart || { items: [] },
      offer: null,
      authorization: null,
      payment: null,
      fulfillment: {
        state: 'REQUEST_RECEIVED',
        events: [],
      },
    };

    return reply.status(201).send({
      success: true,
      intent_id: intentId,
      cco,
    });
  });
}
