import {
  type CommonCommerceObject,
} from './common-commerce-object.js';
import { adaptAcpToCCO, type AcpPayload } from './acp.js';
import { adaptUcpToCCO, type UcpPayload } from './ucp.js';
import { adaptAp2ToCCO, type Ap2Payload } from './ap2.js';
import { adaptMockUapToCCO, type MockUapPayload } from './mock-uap.js';

export * from './common-commerce-object.js';
export * from './acp.js';
export * from './ucp.js';
export * from './ap2.js';
export * from './mock-uap.js';

export type SupportedProtocol = 'ACP' | 'UCP' | 'AP2' | 'mock-UAP' | 'simulator';

/**
 * Universal Entrypoint: Adapts any supported external protocol payload
 * into the canonical Common Commerce Object (CCO).
 */
export function adaptToCCO(protocol: SupportedProtocol, rawPayload: any): CommonCommerceObject {
  switch (protocol) {
    case 'ACP':
      return adaptAcpToCCO(rawPayload as AcpPayload);
    case 'UCP':
      return adaptUcpToCCO(rawPayload as UcpPayload);
    case 'AP2':
      return adaptAp2ToCCO(rawPayload as Ap2Payload);
    case 'mock-UAP':
      return adaptMockUapToCCO(rawPayload as MockUapPayload);
    case 'simulator':
    default:
      if (rawPayload.intent && rawPayload.buyer_constraints) {
        return rawPayload as CommonCommerceObject;
      }
      return adaptAcpToCCO(rawPayload as AcpPayload);
  }
}
