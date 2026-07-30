/**
 * Synthetic PII test fixtures — no real data.
 * Used by redaction tests so no external dependency or real traveler data is needed.
 */

export const syntheticTraveler = {
  id: "traveler_01J9X0Y2Z3A4B5C6D7E8F9G0H1",
  firstName: "Test",
  lastName: "Person",
  email: "test.person@example-travel.com",
  dateOfBirth: "1985-03-22",
  passportNumber: "A12345678",
  nationality: "US",
};

export const syntheticHeaderSet = {
  "content-type": "application/json",
  authorization: "Bearer eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9.fakejwt.signature",
  "stripe-signature": "t=1234567890,v1=abc123def456ghi789,v0=xyz",
  "x-correlation-id": "corr_01J9X0Y2Z3A4B5C6D7E8F9G0H2",
};

export const syntheticPiiError = (() => {
  const err = new Error(
    "User test.person@example-travel.com failed login. Passport: A12345678, DOB: 1985-03-22",
  );
  err.stack = [
    "Error: User test.person@example-travel.com failed login. Passport: A12345678",
    "    at authService.login (auth-service/src/services/AuthService.ts:42:11)",
    "    at handler (auth-service/src/routes/login.ts:18:5)",
  ].join("\n");
  return err;
})();

export const syntheticPassengers = [
  {
    firstName: "Alice",
    lastName: "Smith",
    email: "alice.smith@example-travel.com",
    dateOfBirth: "1990-07-15",
    passportNumber: "B98765432",
  },
  {
    firstName: "Bob",
    lastName: "Jones",
    email: "bob.jones@example-travel.com",
    dateOfBirth: "1988-02-28",
    passportNumber: "C11223344",
  },
];

export const deeplyNestedPii = {
  booking: {
    offer: {
      traveler: {
        email: "deep.nested@example-travel.com",
        passportNumber: "D99887766",
        dateOfBirth: "1992-11-01",
      },
    },
  },
};
