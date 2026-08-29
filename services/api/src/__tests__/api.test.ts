import { describe, it, expect } from 'vitest';
import { buildServer } from '../index.js';

describe('services/api', () => {
  it('builds fastify server and responds to /health', async () => {
    const server = buildServer();
    const response = await server.inject({
      method: 'GET',
      url: '/health',
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.status).toBe('ok');
    expect(body.service).toBe('razorpay-dealflow-api');
  });
});
