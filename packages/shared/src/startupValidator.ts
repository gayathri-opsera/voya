/**
 * StartupSecretValidator — WO-012: Fail-fast startup secret validation.
 *
 * Validates that all required secrets are present and non-empty BEFORE
 * the service starts accepting traffic. If any secret is missing, the
 * process exits with code 1 (fail-fast).
 *
 * This prevents silent misconfiguration in production where a missing
 * secret would only be discovered when that code path is exercised.
 */

export interface SecretValidationResult {
  valid: boolean;
  missing: string[];
  invalid: string[];
}

export type SecretSpec = {
  key: string;
  minLength?: number;
  pattern?: RegExp;
  description?: string;
};

/**
 * Validate that all required secrets are present in the environment.
 * Does NOT log the actual secret values.
 */
export function validateSecrets(
  env: NodeJS.ProcessEnv,
  required: SecretSpec[],
): SecretValidationResult {
  const missing: string[] = [];
  const invalid: string[] = [];

  for (const spec of required) {
    const value = env[spec.key];
    if (!value) {
      missing.push(spec.key);
      continue;
    }
    if (spec.minLength !== undefined && value.length < spec.minLength) {
      invalid.push(`${spec.key} (too short: ${value.length} < ${spec.minLength})`);
      continue;
    }
    if (spec.pattern !== undefined && !spec.pattern.test(value)) {
      invalid.push(`${spec.key} (does not match expected format)`);
    }
  }

  return { valid: missing.length === 0 && invalid.length === 0, missing, invalid };
}

/**
 * Fail-fast startup validator. Calls process.exit(1) if any secrets are missing.
 * Use at the very top of service entry points.
 */
export function requireSecrets(
  env: NodeJS.ProcessEnv,
  required: SecretSpec[],
  _exit = process.exit,
): void {
  const result = validateSecrets(env, required);
  if (!result.valid) {
    const lines: string[] = ["[FATAL] Service startup aborted: secret validation failed"];
    if (result.missing.length > 0) {
      lines.push(`  Missing: ${result.missing.join(", ")}`);
    }
    if (result.invalid.length > 0) {
      lines.push(`  Invalid: ${result.invalid.join(", ")}`);
    }
    console.error(lines.join("\n"));
    _exit(1);
  }
}
