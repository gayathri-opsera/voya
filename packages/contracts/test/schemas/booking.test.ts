import { describe, it, expect } from "vitest";
import {
  CreateBookingRequestSchema,
  PassengerInfoSchema,
  BookingResponseSchema,
} from "../../src/booking/index.js";
import {
  rawCreateBookingPayload,
  rawPassenger,
  rawBookingResponse,
  invalidBookingPayloads,
} from "../fixtures/booking.js";

describe("PassengerInfoSchema", () => {
  it("parses a valid passenger", () => {
    const result = PassengerInfoSchema.safeParse(rawPassenger);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.firstName).toBe("Jane");
      expect(result.data.dateOfBirth).toBeInstanceOf(Date);
    }
  });

  it("rejects an invalid passport number", () => {
    const result = PassengerInfoSchema.safeParse({
      ...rawPassenger,
      passportNumber: "A1",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const issue = result.error.issues.find((i) => i.path.includes("passportNumber"));
      expect(issue).toBeDefined();
    }
  });

  it("rejects an invalid nationality code (3 letters)", () => {
    const result = PassengerInfoSchema.safeParse({
      ...rawPassenger,
      nationality: "USA",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const issue = result.error.issues.find((i) => i.path.includes("nationality"));
      expect(issue).toBeDefined();
    }
  });
});

describe("CreateBookingRequestSchema", () => {
  it("parses a valid booking request", () => {
    const result = CreateBookingRequestSchema.safeParse(rawCreateBookingPayload);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.bookingType).toBe("FLIGHT");
      expect(result.data.passengers).toHaveLength(1);
      expect(result.data.contactEmail).toBe("jane.doe@example.com");
    }
  });

  it("rejects empty passengers array", () => {
    const result = CreateBookingRequestSchema.safeParse(invalidBookingPayloads.noPassengers);
    expect(result.success).toBe(false);
    if (!result.success) {
      const issue = result.error.issues.find((i) => i.path.includes("passengers"));
      expect(issue?.message).toMatch(/at least one passenger/i);
    }
  });

  it("rejects 10 passengers (exceeds maximum of 9)", () => {
    const result = CreateBookingRequestSchema.safeParse(invalidBookingPayloads.tenPassengers);
    expect(result.success).toBe(false);
    if (!result.success) {
      const issue = result.error.issues.find((i) => i.path.includes("passengers"));
      expect(issue).toBeDefined();
    }
  });

  it("rejects an invalid contact email", () => {
    const result = CreateBookingRequestSchema.safeParse(
      invalidBookingPayloads.invalidEmail,
    );
    expect(result.success).toBe(false);
    if (!result.success) {
      const issue = result.error.issues.find((i) => i.path.includes("contactEmail"));
      expect(issue?.message).toMatch(/valid contact email/i);
    }
  });

  it("rejects an invalid booking type", () => {
    const result = CreateBookingRequestSchema.safeParse(
      invalidBookingPayloads.invalidBookingType,
    );
    expect(result.success).toBe(false);
  });
});

describe("BookingResponseSchema", () => {
  it("parses a valid booking response", () => {
    const result = BookingResponseSchema.safeParse(rawBookingResponse);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.status).toBe("PENDING");
      expect(result.data.bookingReference).toBe("VOYA-ABC123");
    }
  });
});
