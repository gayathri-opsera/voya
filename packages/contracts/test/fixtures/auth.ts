export const rawRegisterPayload = {
  email: "jane.doe@example.com",
  password: "SecurePass1!",
  firstName: "Jane",
  lastName: "Doe",
};

export const rawLoginPayload = {
  email: "jane.doe@example.com",
  password: "SecurePass1!",
};

export const rawLoginResponse = {
  accessToken: "eyJhbGciOiJSUzI1NiJ9.eyJ1c2VySWQiOiJ1c3JfMDEifQ.signature",
  refreshToken: "rt_01J9X0Y2Z3A4B5C6D7E8F9G0",
  expiresIn: 900,
  tokenType: "Bearer" as const,
  userId: "usr_01J9X0Y2Z3A4B5C6D7E8F9G0",
  role: "traveler" as const,
};

export const rawActorContext = {
  userId: "usr_01J9X0Y2Z3A4B5C6D7E8F9G0",
  role: "traveler" as const,
  sessionId: "sess_01J9X0Y2Z3A4B5C6D7E8F9G0",
  email: "jane.doe@example.com",
  iat: 1720000000,
  exp: 1720003600,
};

export const invalidAuthPayloads = {
  shortPassword: { ...rawRegisterPayload, password: "short" },
  noUppercase: { ...rawRegisterPayload, password: "nouppercase1!" },
  noDigit: { ...rawRegisterPayload, password: "NoDigitPass!" },
  invalidEmail: { ...rawRegisterPayload, email: "not-an-email" },
  missingFirstName: { ...rawRegisterPayload, firstName: "" },
  missingLastName: { ...rawRegisterPayload, lastName: "" },
};
