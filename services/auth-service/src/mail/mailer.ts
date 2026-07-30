/**
 * Mailer abstraction — keeps all email concerns behind a single interface.
 * Inject the concrete implementation; use InMemoryMailer in tests.
 */

export interface VerificationEmailOptions {
  to: string;
  verificationToken: string;
  displayName?: string;
  expiresInHours: number;
}

export interface SecurityNoticeOptions {
  to: string;
  displayName?: string;
}

export interface Mailer {
  sendVerificationEmail(options: VerificationEmailOptions): Promise<void>;
  sendRegistrationAttemptNotice(options: SecurityNoticeOptions): Promise<void>;
}

// ─── Console mailer (local development) ──────────────────────────────────────

export class ConsoleMailer implements Mailer {
  async sendVerificationEmail(options: VerificationEmailOptions): Promise<void> {
    process.stdout.write(
      `[ConsoleMailer] Verification email → ${options.to}\n` +
      `  Token: ${options.verificationToken}\n` +
      `  Expires in: ${options.expiresInHours}h\n`,
    );
  }

  async sendRegistrationAttemptNotice(options: SecurityNoticeOptions): Promise<void> {
    process.stdout.write(
      `[ConsoleMailer] Security notice → ${options.to}\n`,
    );
  }
}

// ─── In-memory mailer (tests) ─────────────────────────────────────────────────

export interface CapturedEmail {
  kind: "verification" | "notice";
  to: string;
  token?: string;
}

export class InMemoryMailer implements Mailer {
  private readonly _sent: CapturedEmail[] = [];

  get sent(): Readonly<CapturedEmail[]> {
    return this._sent;
  }

  clear(): void {
    this._sent.length = 0;
  }

  async sendVerificationEmail(options: VerificationEmailOptions): Promise<void> {
    this._sent.push({ kind: "verification", to: options.to, token: options.verificationToken });
  }

  async sendRegistrationAttemptNotice(options: SecurityNoticeOptions): Promise<void> {
    this._sent.push({ kind: "notice", to: options.to });
  }
}
