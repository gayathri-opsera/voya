import { describe, it, expect } from "vitest";
import {
  StreamingChatService,
  type LlmStreamPort,
  type ChatChunk,
} from "../../src/streaming/StreamingChatService.js";

function makeLlm(chunks: ChatChunk[]): LlmStreamPort {
  return {
    async *stream() {
      for (const chunk of chunks) yield chunk;
    },
  };
}

async function collectChunks(gen: AsyncGenerator<ChatChunk>): Promise<ChatChunk[]> {
  const result: ChatChunk[] = [];
  for await (const chunk of gen) result.push(chunk);
  return result;
}

describe("StreamingChatService", () => {
  it("yields text chunks from LLM", async () => {
    const svc = new StreamingChatService(
      makeLlm([
        { type: "text", content: "Hello" },
        { type: "text", content: " world" },
        { type: "done", finishReason: "stop" },
      ]),
    );

    const chunks = await collectChunks(
      svc.chat({ conversationId: "c1", userId: "u1", messages: [{ role: "user", content: "Hi" }] }),
    );
    expect(chunks.filter((c) => c.type === "text")).toHaveLength(2);
    expect(chunks.find((c) => c.type === "done")?.finishReason).toBe("stop");
  });

  it("returns error for empty messages", async () => {
    const svc = new StreamingChatService(makeLlm([]));
    const chunks = await collectChunks(
      svc.chat({ conversationId: "c1", userId: "u1", messages: [] }),
    );
    expect(chunks[0]?.type).toBe("error");
    expect(chunks[1]?.finishReason).toBe("error");
  });

  it("handles cancellation via AbortSignal", async () => {
    const controller = new AbortController();
    const svc = new StreamingChatService(
      makeLlm([
        { type: "text", content: "start" },
        { type: "done", finishReason: "stop" },
      ]),
    );
    controller.abort();
    const chunks = await collectChunks(
      svc.chat({
        conversationId: "c1",
        userId: "u1",
        messages: [{ role: "user", content: "Hi" }],
        signal: controller.signal,
      }),
    );
    const doneChunk = chunks.find((c) => c.type === "done");
    expect(doneChunk?.finishReason).toBe("cancelled");
  });

  it("handles LLM errors gracefully", async () => {
    const failingLlm: LlmStreamPort = {
      async *stream() {
        throw new Error("LLM unavailable");
      },
    };
    const svc = new StreamingChatService(failingLlm);
    const chunks = await collectChunks(
      svc.chat({ conversationId: "c1", userId: "u1", messages: [{ role: "user", content: "Hi" }] }),
    );
    expect(chunks.some((c) => c.type === "error")).toBe(true);
  });
});
