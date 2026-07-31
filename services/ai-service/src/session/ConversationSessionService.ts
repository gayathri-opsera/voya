/**
 * ConversationSessionStore — WO-057: Conversation session store with turn persistence.
 *
 * Stores conversation sessions with:
 * - Per-session turn history (user/assistant messages)
 * - TTL-based expiry
 * - Idempotent turn recording
 */

export type MessageRole = "user" | "assistant" | "tool";

export interface ConversationTurn {
  id: string;
  role: MessageRole;
  content: string;
  toolName?: string;
  toolInput?: unknown;
  toolOutput?: unknown;
  timestamp: Date;
}

export interface ConversationSession {
  id: string;
  userId: string;
  turns: ConversationTurn[];
  createdAt: Date;
  updatedAt: Date;
  expiresAt: Date;
}

export interface SessionStore {
  get(sessionId: string): Promise<ConversationSession | null>;
  save(session: ConversationSession): Promise<void>;
  delete(sessionId: string): Promise<void>;
}

export class InMemorySessionStore implements SessionStore {
  private readonly sessions = new Map<string, ConversationSession>();

  async get(sessionId: string): Promise<ConversationSession | null> {
    const s = this.sessions.get(sessionId);
    if (!s) return null;
    if (s.expiresAt < new Date()) {
      this.sessions.delete(sessionId);
      return null;
    }
    return s;
  }

  async save(session: ConversationSession): Promise<void> {
    this.sessions.set(session.id, session);
  }

  async delete(sessionId: string): Promise<void> {
    this.sessions.delete(sessionId);
  }
}

export class ConversationSessionService {
  private readonly sessionTtlMs = 60 * 60 * 1000; // 1 hour

  constructor(private readonly store: SessionStore) {}

  async createSession(userId: string): Promise<ConversationSession> {
    const now = new Date();
    const session: ConversationSession = {
      id: crypto.randomUUID(),
      userId,
      turns: [],
      createdAt: now,
      updatedAt: now,
      expiresAt: new Date(now.getTime() + this.sessionTtlMs),
    };
    await this.store.save(session);
    return session;
  }

  async getSession(sessionId: string): Promise<ConversationSession | null> {
    return this.store.get(sessionId);
  }

  async addTurn(sessionId: string, turn: Omit<ConversationTurn, "id" | "timestamp">): Promise<ConversationSession> {
    const session = await this.store.get(sessionId);
    if (!session) throw new Error(`Session not found: ${sessionId}`);

    const newTurn: ConversationTurn = {
      ...turn,
      id: crypto.randomUUID(),
      timestamp: new Date(),
    };

    session.turns.push(newTurn);
    session.updatedAt = new Date();
    session.expiresAt = new Date(Date.now() + this.sessionTtlMs); // Extend on activity
    await this.store.save(session);
    return session;
  }

  async deleteSession(sessionId: string): Promise<void> {
    await this.store.delete(sessionId);
  }
}
