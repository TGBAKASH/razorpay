import Fastify, { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import cors from '@fastify/cors';
import { registerIntentRoutes } from './routes/intent.js';
import { registerOfferRoutes } from './routes/offers.js';
import { registerRazorpayRoutes } from './routes/razorpay.js';
import { registerAuctionRoutes } from './routes/auction.js';
import { registerScenarioRoutes } from './routes/scenarios.js';
import { registerBuyerOrderRoutes } from './routes/buyer-orders.js';
import { registerMandateRoutes } from './routes/mandates.js';
import { stateMachine } from './services/state-machine.js';
import { prisma } from './db.js';

export function buildServer(): FastifyInstance {
  const server = Fastify({
    logger: {
      level: process.env.LOG_LEVEL || 'info',
    },
  });

  // Capture RAW request body before JSON parser touches it for HMAC webhook signature verification
  server.addContentTypeParser('application/json', { parseAs: 'string' }, (req, body, done) => {
    try {
      const rawString = typeof body === 'string' ? body : (body ? body.toString() : '');
      (req as any).rawBody = rawString;
      if (!rawString || rawString.trim().length === 0) {
        done(null, {});
        return;
      }
      const json = JSON.parse(rawString);
      done(null, json);
    } catch (err: any) {
      err.statusCode = 400;
      done(err, undefined);
    }
  });

  // CORS driven by ALLOWED_ORIGIN env var
  const allowedOrigin = process.env.ALLOWED_ORIGIN;
  server.register(cors, {
    origin: allowedOrigin ? allowedOrigin.split(',').map((o) => o.trim()) : true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    credentials: true,
  });

  // Health check endpoint for Render deployments
  server.get('/api/healthz', async () => {
    return {
      status: 'ok',
    };
  });

  // Standard health endpoint
  server.get('/health', async () => {
    return {
      status: 'ok',
      service: 'razorpay-dealflow-api',
      timestamp: new Date().toISOString(),
    };
  });

  // Audit Logs Endpoint: Reads live rows from PostgreSQL & state machine
  server.get('/api/audit-logs', async (request: FastifyRequest, reply: FastifyReply) => {
    const query = request.query as { offer_id?: string };
    const offerId = query?.offer_id;

    // Fetch memory logs
    const memoryLogs = stateMachine.getAuditTrail(offerId);

    // Fetch Postgres logs
    if (process.env.NODE_ENV !== 'test') {
      try {
        const dbEntries = await prisma.auditLogEntry.findMany({
          where: offerId ? { offerId } : {},
          orderBy: { timestamp: 'desc' },
          take: 100,
        });

      if (dbEntries.length > 0) {
        const formattedDbLogs = dbEntries.map((e) => {
          const inputData = (e.inputData as any) || {};
          return {
            id: e.id,
            offer_id: e.offerId || '',
            from_state: null,
            to_state: e.result === 'FAIL' ? 'FAILED' : 'POLICY_APPROVED',
            action: e.action,
            actor: e.actor,
            input_data: inputData,
            decision_record: inputData.decision_record || undefined,
            policy_version: e.policyVersion || 'v1',
            policy_checked: e.policyChecked || 'STATE_MACHINE_RULE',
            reason: e.reason,
            timestamp: e.timestamp.toISOString(),
          };
        });

        // Merge and deduplicate by id
        const map = new Map<string, any>();
        for (const log of [...memoryLogs, ...formattedDbLogs]) {
          map.set(log.id, log);
        }
        return reply.status(200).send({
          success: true,
          logs: Array.from(map.values()),
        });
      }
    } catch {}
  }

    return reply.status(200).send({
      success: true,
      logs: memoryLogs,
    });
  });

  // Register domain routes
  server.register(registerIntentRoutes);
  server.register(registerOfferRoutes);
  server.register(registerRazorpayRoutes);
  server.register(registerAuctionRoutes);
  server.register(registerScenarioRoutes);
  server.register(registerBuyerOrderRoutes);
  server.register(registerMandateRoutes);

  return server;
}

if (process.env.NODE_ENV !== 'test' && require.main === module) {
  const server = buildServer();
  const port = parseInt(process.env.PORT || '4000', 10);
  server.listen({ port, host: '0.0.0.0' }, (err, address) => {
    if (err) {
      server.log.error(err);
      process.exit(1);
    }
    server.log.info(`Razorpay DealFlow API running at ${address}`);
  });
}
