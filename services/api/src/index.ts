import Fastify, { FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import { registerIntentRoutes } from './routes/intent.js';
import { registerOfferRoutes } from './routes/offers.js';
import { registerRazorpayRoutes } from './routes/razorpay.js';
import { registerAuctionRoutes } from './routes/auction.js';
import { registerScenarioRoutes } from './routes/scenarios.js';

export function buildServer(): FastifyInstance {
  const server = Fastify({
    logger: {
      level: process.env.LOG_LEVEL || 'info',
    },
  });

  // Requirement 3: Capture RAW request body before JSON parser touches it for HMAC webhook signature verification
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

  // Requirement 4: CORS driven by ALLOWED_ORIGIN env var (never hardcoded)
  const allowedOrigin = process.env.ALLOWED_ORIGIN;
  server.register(cors, {
    origin: allowedOrigin ? allowedOrigin.split(',').map((o) => o.trim()) : true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    credentials: true,
  });

  // Requirement 2: Health check endpoint for Render deployments
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

  // Register domain routes
  server.register(registerIntentRoutes);
  server.register(registerOfferRoutes);
  server.register(registerRazorpayRoutes);
  server.register(registerAuctionRoutes);
  server.register(registerScenarioRoutes);

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
