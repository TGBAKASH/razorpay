import crypto from 'node:crypto';

export type DealFlowState =
  | 'REQUEST_RECEIVED'
  | 'OFFER_GENERATED'
  | 'APPROVAL_PENDING'
  | 'POLICY_APPROVED'
  | 'OFFER_ACCEPTED'
  | 'ORDER_CREATED'
  | 'PAYMENT_ATTEMPTED'
  | 'FLAGGED'
  | 'PAID'
  | 'FAILED'
  | 'EXPIRED'
  | 'REFUNDED';

export const ALLOWED_TRANSITIONS: Record<DealFlowState, DealFlowState[]> = {
  REQUEST_RECEIVED: ['OFFER_GENERATED', 'FAILED'],
  OFFER_GENERATED: ['POLICY_APPROVED', 'APPROVAL_PENDING', 'FAILED', 'EXPIRED'],
  APPROVAL_PENDING: ['POLICY_APPROVED', 'FAILED', 'EXPIRED'],
  POLICY_APPROVED: ['OFFER_ACCEPTED', 'FAILED', 'EXPIRED'],
  OFFER_ACCEPTED: ['ORDER_CREATED', 'FAILED', 'EXPIRED'],
  ORDER_CREATED: ['PAYMENT_ATTEMPTED', 'FAILED', 'EXPIRED'],
  PAYMENT_ATTEMPTED: ['PAID', 'FLAGGED', 'FAILED', 'EXPIRED'],
  FLAGGED: ['REFUNDED', 'FAILED'],
  PAID: ['REFUNDED'],
  FAILED: [],
  EXPIRED: [],
  REFUNDED: [],
};

export interface AuditLogEntry {
  id: string;
  offer_id: string;
  from_state: DealFlowState | null;
  to_state: DealFlowState;
  action: string; // What happened
  actor: string; // Who/what initiated it
  input_data: Record<string, any>; // What data was used
  policy_version: string; // Which policy_version approved it
  policy_checked: string; // Which specific rule was checked
  reason: string; // Why this particular offer/decision was selected over alternatives
  razorpay_request?: any | null; // Raw Razorpay API request if applicable
  razorpay_response?: any | null; // Raw Razorpay API response if applicable
  timestamp: string; // ISO 8601 timestamp
}

export interface TransitionContext {
  action: string;
  actor: string;
  input_data: Record<string, any>;
  policy_version?: string;
  policy_checked?: string;
  reason: string;
  razorpay_request?: any;
  razorpay_response?: any;
}

export class StateMachineManager {
  private static instance: StateMachineManager;
  private offerStates: Map<string, DealFlowState> = new Map();
  private auditEntries: AuditLogEntry[] = [];

  private constructor() {}

  public static getInstance(): StateMachineManager {
    if (!StateMachineManager.instance) {
      StateMachineManager.instance = new StateMachineManager();
    }
    return StateMachineManager.instance;
  }

  public getCurrentState(offerId: string): DealFlowState | null {
    return this.offerStates.get(offerId) || null;
  }

  public setCurrentState(offerId: string, state: DealFlowState): void {
    this.offerStates.set(offerId, state);
  }

  /**
   * Enforces valid state transitions and writes immutable audit entry.
   * Throws an error if an illegal state jump is attempted.
   */
  public transition(
    offerId: string,
    toState: DealFlowState,
    context: TransitionContext
  ): AuditLogEntry {
    const fromState = this.offerStates.get(offerId) || null;

    // Validate transition
    if (fromState !== null && fromState !== toState) {
      const allowedNextStates = ALLOWED_TRANSITIONS[fromState];
      if (!allowedNextStates || !allowedNextStates.includes(toState)) {
        const errorReason = `Illegal state transition rejected: Cannot jump from "${fromState}" to "${toState}". Allowed transitions: [${allowedNextStates?.join(', ') || 'none'}].`;

        // Record failed attempt in audit log
        const failureEntry: AuditLogEntry = {
          id: crypto.randomUUID(),
          offer_id: offerId,
          from_state: fromState,
          to_state: toState,
          action: `REJECTED_TRANSITION_${context.action}`,
          actor: context.actor,
          input_data: context.input_data || {},
          policy_version: context.policy_version || 'v1',
          policy_checked: context.policy_checked || 'STATE_TRANSITION_ENFORCER',
          reason: errorReason,
          razorpay_request: context.razorpay_request || null,
          razorpay_response: context.razorpay_response || null,
          timestamp: new Date().toISOString(),
        };
        this.auditEntries.push(failureEntry);

        throw new Error(errorReason);
      }
    }

    // Apply state transition
    this.offerStates.set(offerId, toState);

    // Create immutable audit log entry
    const entry: AuditLogEntry = {
      id: crypto.randomUUID(),
      offer_id: offerId,
      from_state: fromState,
      to_state: toState,
      action: context.action,
      actor: context.actor,
      input_data: context.input_data || {},
      policy_version: context.policy_version || 'v1',
      policy_checked: context.policy_checked || 'RULE_STATE_MACHINE_TRANSITION',
      reason: context.reason,
      razorpay_request: context.razorpay_request || null,
      razorpay_response: context.razorpay_response || null,
      timestamp: new Date().toISOString(),
    };

    this.auditEntries.push(entry);
    return entry;
  }

  public getAuditTrail(offerId?: string): AuditLogEntry[] {
    if (offerId) {
      return this.auditEntries.filter((e) => e.offer_id === offerId);
    }
    return [...this.auditEntries];
  }

  public reset(): void {
    this.offerStates.clear();
    this.auditEntries = [];
  }
}

export const stateMachine = StateMachineManager.getInstance();
