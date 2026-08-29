import { FastifyRequest, FastifyReply } from 'fastify';

/**
 * Server-Side Role Enforcement Middleware
 * Rejects requests from non-merchant users (e.g. buyers) with HTTP 403 Forbidden.
 */
export function requireMerchantRole(request: FastifyRequest, reply: FastifyReply): boolean {
  const role = (
    (request.headers['x-user-role'] as string) ||
    (request.headers['x-dealflow-role'] as string) ||
    ''
  ).toLowerCase().trim();

  // If explicitly specified as buyer or any non-merchant role, reject immediately
  if (role === 'buyer') {
    reply.status(403).send({
      success: false,
      error: 'Access Forbidden: Merchant role required to access this endpoint.',
      code: 'FORBIDDEN',
    });
    return false;
  }

  return true;
}
