/**
 * StreamingChatService — WO-058: Streaming chat endpoint with backpressure and cancellation.
 *
 * Features:
 * - Server-sent events (SSE) streaming for AI responses
 * - Backpressure via async generator pattern
 * - Cancellation via AbortController
 * - Structured chunk format with type discriminant
 * - Error handling with graceful termination
 */

export type ChatChunkType = "text" | "tool_use" | "tool_result" | "error" | "done";

export interface ChatChunk {
  type: ChatChunkType;
  content?: string;
  toolName?: string;
  toolInput?: unknown;
  toolResult?: unknown;
  error?: string;
  finishReason?: "stop" | "max_tokens" | "tool_use" | "error" | "cancelled";
}

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export interface LlmStreamPort {
  stream(input: {
    messages: ChatMessage[];
    systemPrompt: string;
    maxTokens: number;
    signal?: AbortSignal;
  }): AsyncGenerator<ChatChunk>;
}

export interface StreamingChatInput {
  conversationId: string;
  userId: string;
  messages: ChatMessage[];
  signal?: AbortSignal;
}

const SYSTEM_PROMPT = `You are Voya, an AI travel assistant. 
Help travelers find flights, hotels, and car rentals. 
Only recommend bookable offers with verified provenance.
Never fabricate prices, availability, or booking details.
Always cite the offer source when recommending options.`;

export class StreamingChatService {
  constructor(
    private readonly llm: LlmStreamPort,
    private readonly maxTokens: number = 2048,
  ) {}

  async *chat(input: StreamingChatInput): AsyncGenerator<ChatChunk> {
    if (!input.messages.length) {
      yield { type: "error", error: "No messages provided" };
      yield { type: "done", finishReason: "error" };
      return;
    }

    try {
      for await (const chunk of this.llm.stream({
        messages: input.messages,
        systemPrompt: SYSTEM_PROMPT,
        maxTokens: this.maxTokens,
        signal: input.signal,
      })) {
        if (input.signal?.aborted) {
          yield { type: "done", finishReason: "cancelled" };
          return;
        }
        yield chunk;
        if (chunk.type === "done") return;
      }
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") {
        yield { type: "done", finishReason: "cancelled" };
      } else {
        yield { type: "error", error: err instanceof Error ? err.message : "LLM error" };
        yield { type: "done", finishReason: "error" };
      }
    }
  }
}
