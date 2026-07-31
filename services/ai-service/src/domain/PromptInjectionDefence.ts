/**
 * PromptInjectionDefence — WO-061: Prompt injection defence and output sanitisation.
 *
 * Defence layers:
 * 1. Input scanning: detect common injection patterns before sending to LLM
 * 2. Role separator detection: catch attempts to inject system/assistant roles
 * 3. Output sanitisation: strip instruction leakage and dangerous content
 * 4. PII scanning in output: ensure model doesn't echo back PII
 *
 * Uses allow-list approach: known-safe patterns pass; everything else is inspected.
 */

export type ScanResult =
  | { safe: true }
  | { safe: false; reason: InjectionReason; fragment: string };

export type InjectionReason =
  | "role_injection"
  | "instruction_override"
  | "prompt_leakage"
  | "jailbreak_attempt"
  | "pii_echo";

const INJECTION_PATTERNS: { reason: InjectionReason; pattern: RegExp }[] = [
  { reason: "role_injection", pattern: /\b(system|assistant|human):/i },
  { reason: "role_injection", pattern: /<\|?(im_start|im_end|system|user|assistant)\|?>/i },
  { reason: "instruction_override", pattern: /ignore\s+(all\s+)?previous\s+instructions/i },
  { reason: "instruction_override", pattern: /disregard\s+(your\s+)?(previous\s+)?instructions/i },
  { reason: "jailbreak_attempt", pattern: /\bDAN\b|\bdo anything now\b/i },
  { reason: "jailbreak_attempt", pattern: /pretend\s+(you are|to be)\s+(an?\s+)?(?!Voya)/i },
  { reason: "prompt_leakage", pattern: /repeat\s+(your\s+)?system\s+prompt/i },
  { reason: "prompt_leakage", pattern: /print\s+(your\s+)?(instructions|prompt|system)/i },
];

const PII_PATTERNS: RegExp[] = [
  /\b[A-Z]{1,2}\d{6,9}\b/, // Passport numbers
  /\b\d{3}-\d{2}-\d{4}\b/, // SSN
  /\b\d{16}\b/, // Credit card numbers
];

export class PromptInjectionDefence {
  scanInput(text: string): ScanResult {
    for (const { reason, pattern } of INJECTION_PATTERNS) {
      const match = text.match(pattern);
      if (match) {
        return { safe: false, reason, fragment: match[0] };
      }
    }
    return { safe: true };
  }

  sanitiseOutput(text: string): { sanitised: string; issues: InjectionReason[] } {
    const issues: InjectionReason[] = [];
    let sanitised = text;

    // Strip role markers that might have leaked
    for (const { reason, pattern } of INJECTION_PATTERNS.filter((p) =>
      ["role_injection", "prompt_leakage"].includes(p.reason),
    )) {
      if (pattern.test(sanitised)) {
        sanitised = sanitised.replace(pattern, "[redacted]");
        issues.push(reason);
      }
    }

    // Scan for PII in output
    for (const pattern of PII_PATTERNS) {
      if (pattern.test(sanitised)) {
        sanitised = sanitised.replace(pattern, "[PII redacted]");
        issues.push("pii_echo");
      }
    }

    return { sanitised, issues };
  }
}
