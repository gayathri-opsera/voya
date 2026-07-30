import { describe, it, expect, beforeEach } from "vitest";
import { InMemoryQueueAdapter } from "../src/InMemoryQueueAdapter.js";

describe("InMemoryQueueAdapter", () => {
  let queue: InMemoryQueueAdapter;

  beforeEach(() => {
    queue = new InMemoryQueueAdapter();
  });

  it("publishes a message and returns a messageId", async () => {
    const id = await queue.publish("bookings", "booking.created", { bookingId: "b1" });
    expect(typeof id).toBe("string");
    expect(id.length).toBeGreaterThan(0);
  });

  it("published messages are retrievable", async () => {
    await queue.publish("bookings", "booking.created", { bookingId: "b1" });
    const messages = queue.getMessages("bookings");
    expect(messages).toHaveLength(1);
    expect(messages[0]!.type).toBe("booking.created");
  });

  it("delivers message to subscribed handler", async () => {
    const received: unknown[] = [];
    await queue.subscribe("bookings", async (msg) => { received.push(msg.payload); });

    await queue.publish("bookings", "booking.created", { bookingId: "b2" });
    expect(received).toHaveLength(1);
    expect((received[0] as Record<string, unknown>).bookingId).toBe("b2");
  });

  it("delivers to multiple subscribers", async () => {
    const r1: unknown[] = [];
    const r2: unknown[] = [];
    await queue.subscribe("events", async (msg) => r1.push(msg));
    await queue.subscribe("events", async (msg) => r2.push(msg));

    await queue.publish("events", "test.event", {});
    expect(r1).toHaveLength(1);
    expect(r2).toHaveLength(1);
  });

  it("unsubscribe stops delivery", async () => {
    const received: unknown[] = [];
    const unsubscribe = await queue.subscribe("q", async (msg) => received.push(msg));

    await queue.publish("q", "t1", {});
    expect(received).toHaveLength(1);

    await unsubscribe();
    await queue.publish("q", "t2", {});
    expect(received).toHaveLength(1); // no new message
  });

  it("propagates correlationId", async () => {
    let correlationId: string | undefined;
    await queue.subscribe("q", async (msg) => { correlationId = msg.correlationId; });

    await queue.publish("q", "t1", {}, { correlationId: "trace_xyz" });
    expect(correlationId).toBe("trace_xyz");
  });

  it("clear removes all messages and handlers", async () => {
    await queue.publish("q", "t1", {});
    queue.clear();
    expect(queue.getMessages("q")).toHaveLength(0);
  });

  it("ping resolves without error", async () => {
    await expect(queue.ping()).resolves.toBeUndefined();
  });

  it("close resolves without error", async () => {
    await expect(queue.close()).resolves.toBeUndefined();
  });
});
