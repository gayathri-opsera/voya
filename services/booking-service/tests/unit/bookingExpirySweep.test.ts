import { describe, it, expect, vi } from "vitest";
import { BookingExpirySweep } from "../../src/jobs/BookingExpirySweep.ts";

describe("BookingExpirySweep", () => {
  const makeLifecycle = () => ({
    transition: vi.fn().mockResolvedValue(undefined),
  });
  const makeAudit = () => ({
    recordExpiry: vi.fn().mockResolvedValue(undefined),
  });

  it("expires all pending bookings past TTL", async () => {
    const query = {
      findExpiredPending: vi.fn().mockResolvedValue([{ id: "b1" }, { id: "b2" }]),
    };
    const lifecycle = makeLifecycle();
    const audit = makeAudit();

    const sweep = new BookingExpirySweep(query as any, lifecycle as any, audit);
    const result = await sweep.run();

    expect(result.expired).toBe(2);
    expect(result.errors).toBe(0);
    expect(lifecycle.transition).toHaveBeenCalledTimes(2);
    expect(lifecycle.transition).toHaveBeenCalledWith("b1", "EXPIRED", expect.any(Object), "TTL exceeded");
  });

  it("counts errors when transition fails", async () => {
    const query = {
      findExpiredPending: vi.fn().mockResolvedValue([{ id: "b1" }, { id: "b2" }]),
    };
    const lifecycle = { transition: vi.fn().mockRejectedValueOnce(new Error("locked")).mockResolvedValue(undefined) };
    const audit = makeAudit();

    const sweep = new BookingExpirySweep(query as any, lifecycle as any, audit);
    const result = await sweep.run();

    expect(result.expired).toBe(1);
    expect(result.errors).toBe(1);
  });

  it("does nothing when no bookings need expiring", async () => {
    const query = { findExpiredPending: vi.fn().mockResolvedValue([]) };
    const lifecycle = makeLifecycle();
    const audit = makeAudit();

    const sweep = new BookingExpirySweep(query as any, lifecycle as any, audit);
    const result = await sweep.run();

    expect(result.expired).toBe(0);
    expect(lifecycle.transition).not.toHaveBeenCalled();
  });
});
