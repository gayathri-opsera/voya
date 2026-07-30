/**
 * @voya/domain-model — Conversation Checkpoint Domain Types
 *
 * Enums, validators, and helpers for Path B assistant conversation checkpoints.
 * LLM provider details and raw prompt transcripts are deliberately absent —
 * only model-neutral orchestration state is persisted.
 */

// ---------------------------------------------------------------------------
// Enums
// ---------------------------------------------------------------------------

/** Phase of the Path B orchestrator state machine. */
export enum OrchestratorPhase {
  INTENT_CAPTURE = 'INTENT_CAPTURE',
  CLARIFICATION  = 'CLARIFICATION',
  SOURCING       = 'SOURCING',
  VERIFICATION   = 'VERIFICATION',
  PRESENTING     = 'PRESENTING',
  COMPLETE       = 'COMPLETE',
  EXPIRED        = 'EXPIRED',
}

/** Status of a single per-domain agent step. */
export enum AgentStepStatus {
  PENDING  = 'PENDING',
  RUNNING  = 'RUNNING',
  COMPLETE = 'COMPLETE',
  /** Partial result — user-visible degraded state in the progress spine. */
  DEGRADED = 'DEGRADED',
  /** No result available — terminal failure state. */
  FAILED   = 'FAILED',
  SKIPPED  = 'SKIPPED',
}

/** Overall lifecycle outcome of a conversation checkpoint. */
export enum CheckpointOutcome {
  ACTIVE          = 'ACTIVE',
  INTENT_COMPLETE = 'INTENT_COMPLETE',
  DEGRADED        = 'DEGRADED',
  EXPIRED         = 'EXPIRED',
}

// ---------------------------------------------------------------------------
// Data minimization — sensitive field name rejection
// ---------------------------------------------------------------------------

// Field names (normalised to lowercase, stripped of separators) that indicate
// personal data or raw prompt content that must never appear in checkpoints.
const SENSITIVE_NORMALIZED_NAMES: ReadonlySet<string> = new Set([
  // Identity
  'name', 'firstname', 'lastname', 'fullname', 'displayname',
  // Contact
  'email', 'emailaddress', 'emailaddr',
  'phonenumber', 'phone', 'mobilephone', 'mobile', 'telephone',
  'address', 'streetaddress', 'postalcode', 'zipcode', 'city', 'country',
  // Loyalty / membership
  'bonvoyid', 'bonvoynumber', 'loyaltyid', 'memberid', 'membernumber',
  // Travel documents
  'passportnumber', 'passport', 'passportno', 'nationalid',
  // Payment
  'cardnumber', 'pan', 'cvv', 'cvv2', 'cvc', 'paymenttoken', 'creditcard',
  'accountnumber', 'bankaccount', 'iban', 'routingnumber',
  // Government IDs
  'ssn', 'socialsecurity', 'socialsecuritynumber', 'taxid', 'nationalinsurance',
  // Biographic
  'dateofbirth', 'dob', 'birthdate', 'gender', 'nationality',
  // Raw LLM content
  'rawprompt', 'prompttext', 'systemprompt', 'usermessage', 'assistantmessage',
  'conversationhistory', 'chathistory', 'messagehistory', 'promptcontent',
  'llmresponse', 'modeloutput', 'rawresponse', 'fullresponse',
]);

export interface DataMinimizationResult {
  readonly valid: boolean;
  readonly violations: readonly string[];
}

/**
 * Recursively validates a JSON payload for sensitive field names.
 * Comparison is case-insensitive and separator-agnostic (_, -, camelCase).
 *
 * Fails closed: an unexpected error returns invalid.
 */
export function validateCheckpointPayload(
  payload: Record<string, unknown>,
  path = '',
): DataMinimizationResult {
  const violations: string[] = [];

  for (const [key, value] of Object.entries(payload)) {
    const fullPath = path ? `${path}.${key}` : key;
    const normalized = key.toLowerCase().replace(/[-_]/g, '');

    if (SENSITIVE_NORMALIZED_NAMES.has(normalized)) {
      violations.push(`Sensitive field "${fullPath}" must not appear in checkpoint payload`);
    }

    if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
      const nested = validateCheckpointPayload(value as Record<string, unknown>, fullPath);
      violations.push(...nested.violations);
    } else if (Array.isArray(value)) {
      for (let i = 0; i < value.length; i++) {
        const item = value[i];
        if (item !== null && typeof item === 'object' && !Array.isArray(item)) {
          const nested = validateCheckpointPayload(
            item as Record<string, unknown>,
            `${fullPath}[${i}]`,
          );
          violations.push(...nested.violations);
        }
      }
    }
  }

  return { valid: violations.length === 0, violations };
}

// ---------------------------------------------------------------------------
// Orchestrator phase transition helpers
// ---------------------------------------------------------------------------

const VALID_ORCHESTRATOR_TRANSITIONS: ReadonlyMap<OrchestratorPhase, readonly OrchestratorPhase[]> =
  new Map([
    [
      OrchestratorPhase.INTENT_CAPTURE,
      [OrchestratorPhase.CLARIFICATION, OrchestratorPhase.SOURCING, OrchestratorPhase.EXPIRED],
    ],
    [
      OrchestratorPhase.CLARIFICATION,
      [OrchestratorPhase.INTENT_CAPTURE, OrchestratorPhase.SOURCING, OrchestratorPhase.EXPIRED],
    ],
    [
      OrchestratorPhase.SOURCING,
      [OrchestratorPhase.VERIFICATION, OrchestratorPhase.EXPIRED],
    ],
    [
      OrchestratorPhase.VERIFICATION,
      [OrchestratorPhase.PRESENTING, OrchestratorPhase.SOURCING, OrchestratorPhase.EXPIRED],
    ],
    [
      OrchestratorPhase.PRESENTING,
      [OrchestratorPhase.COMPLETE, OrchestratorPhase.EXPIRED],
    ],
    [OrchestratorPhase.COMPLETE, []],
    [OrchestratorPhase.EXPIRED, []],
  ]);

export function isValidOrchestratorTransition(
  from: OrchestratorPhase,
  to: OrchestratorPhase,
): boolean {
  return VALID_ORCHESTRATOR_TRANSITIONS.get(from)?.includes(to) ?? false;
}

export function isTerminalCheckpointOutcome(outcome: CheckpointOutcome): boolean {
  return outcome === CheckpointOutcome.EXPIRED || outcome === CheckpointOutcome.INTENT_COMPLETE;
}

export function isDegradedAgentStep(status: AgentStepStatus): boolean {
  return status === AgentStepStatus.DEGRADED;
}

export function isTerminalAgentStepStatus(status: AgentStepStatus): boolean {
  return (
    status === AgentStepStatus.COMPLETE ||
    status === AgentStepStatus.DEGRADED ||
    status === AgentStepStatus.FAILED ||
    status === AgentStepStatus.SKIPPED
  );
}
