import { describe, it, expect } from "vitest";
import { GroundedResponseAssembler } from "../../src/domain/GroundedResponseAssembler.js";

const OFFER_INDEX = new Map([
  ["offer_001", {
    offerId: "offer_001",
    provenance: "AMADEUS",
    title: "Flight NYC-LAX",
    price: 299,
    currency: "USD",
    bookable: true,
  }],
  ["offer_002", {
    offerId: "offer_002",
    provenance: "ILLUSTRATIVE",
    title: "Sample Hotel",
    price: 150,
    currency: "USD",
    bookable: false,
  }],
]);

describe("GroundedResponseAssembler", () => {
  const assembler = new GroundedResponseAssembler({
    async lookup(id) { return OFFER_INDEX.get(id) ?? null; },
  });

  it("passes through text with no offer citations", async () => {
    const result = await assembler.assemble("The weather is nice today.");
    expect(result.text).toBe("The weather is nice today.");
    expect(result.citations).toHaveLength(0);
    expect(result.hallucinationsStripped).toBe(0);
  });

  it("resolves valid offer citations", async () => {
    const result = await assembler.assemble("I recommend [OFFER:offer_001] for your trip.");
    expect(result.citations).toHaveLength(1);
    expect(result.citations[0]!.offerId).toBe("offer_001");
    expect(result.citations[0]!.provenance).toBe("AMADEUS");
  });

  it("strips hallucinated offers and increments counter", async () => {
    const result = await assembler.assemble("Book [OFFER:fake_offer_999] now!");
    expect(result.text).toContain("[unavailable offer]");
    expect(result.hallucinationsStripped).toBe(1);
    expect(result.citations).toHaveLength(0);
  });

  it("marks ILLUSTRATIVE offers as not bookable", async () => {
    const result = await assembler.assemble("Check out [OFFER:offer_002].");
    expect(result.citations[0]!.bookable).toBe(false);
  });

  it("handles multiple citations including mix of real and hallucinated", async () => {
    const result = await assembler.assemble("[OFFER:offer_001] and [OFFER:made_up]");
    expect(result.citations).toHaveLength(1);
    expect(result.hallucinationsStripped).toBe(1);
  });
});
