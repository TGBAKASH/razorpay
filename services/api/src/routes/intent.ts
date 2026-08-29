import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import crypto from 'node:crypto';
import {
  BuyerIntentSubmissionSchema,
  CommonCommerceObjectSchema,
  adaptToCCO,
  type SupportedProtocol,
  type CommonCommerceObject,
} from '@razorpay-dealflow/adapters';
import { parseBuyerIntent } from '../services/gemini-parser.js';

export async function registerIntentRoutes(fastify: FastifyInstance) {
  // 1. Natural Language Intent Parsing endpoint
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
