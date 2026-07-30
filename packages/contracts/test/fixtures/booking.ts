import { rawFlightOfferPayload } from "./search.js";

export const rawPassenger = {
  firstName: "Jane",
  lastName: "Doe",
  dateOfBirth: "1990-05-15",
  passportNumber: "AB123456",
  nationality: "US",
};

export const rawCreateBookingPayload = {
  offerId: "offer_01J9X0Y2Z3A4B5C6D7E8F9G0H1",
  bookingType: "FLIGHT",
  passengers: [rawPassenger],
  contactEmail: "jane.doe@example.com",
  contactPhone: "+1-555-0100",
  currency: "USD",
  idempotencyKey: "idem_01J9X0Y2Z3A4B5C6D7E8F9G0H2",
};

export const rawBookingResponse = {
  bookingId: "book_01J9X0Y2Z3A4B5C6D7E8F9G0H3",
  bookingReference: "VOYA-ABC123",
  status: "PENDING",
  bookingType: "FLIGHT",
  offer: rawFlightOfferPayload,
  passengers: [rawPassenger],
  contactEmail: "jane.doe@example.com",
  totalAmount: "450.00",
  currency: "USD",
  expiresAt: "2099-06-15T01:00:00.000Z",
  createdAt: "2099-06-14T20:00:00.000Z",
  updatedAt: "2099-06-14T20:00:00.000Z",
};

export const invalidBookingPayloads = {
  noPassengers: { ...rawCreateBookingPayload, passengers: [] },
  tenPassengers: {
    ...rawCreateBookingPayload,
    passengers: Array(10).fill(rawPassenger),
  },
  invalidEmail: { ...rawCreateBookingPayload, contactEmail: "not-an-email" },
  invalidBookingType: { ...rawCreateBookingPayload, bookingType: "CRUISE" },
  missingOfferId: { ...rawCreateBookingPayload, offerId: undefined },
};
