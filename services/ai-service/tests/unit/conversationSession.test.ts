import { describe, it, expect } from "vitest";
import {
  ConversationSessionService,
  InMemorySessionStore,
} from "../../src/session/ConversationSessionService.ts";

describe("ConversationSessionService", () => {
  const makeService = () => new ConversationSessionService(new InMemorySessionStore());

  it("creates a new session", async () => {
    const svc = makeService();
    const session = await svc.createSession("user_1");
    expect(session.userId).toBe("user_1");
    expect(session.turns).toHaveLength(0);
    expect(session.id).toBeTruthy();
  });

  it("retrieves an existing session", async () => {
    const svc = makeService();
    const session = await svc.createSession("user_2");
    const retrieved = await svc.getSession(session.id);
    expect(retrieved?.id).toBe(session.id);
  });

  it("returns null for unknown session", async () => {
    const svc = makeService();
    const result = await svc.getSession("nonexistent");
    expect(result).toBeNull();
  });

  it("adds turns and persists them", async () => {
    const svc = makeService();
    const session = await svc.createSession("user_3");
    const updated = await svc.addTurn(session.id, { role: "user", content: "Hello" });
    expect(updated.turns).toHaveLength(1);
    expect(updated.turns[0].content).toBe("Hello");
  });

  it("deletes a session", async () => {
    const svc = makeService();
    const session = await svc.createSession("user_4");
    await svc.deleteSession(session.id);
    const result = await svc.getSession(session.id);
    expect(result).toBeNull();
  });
});
