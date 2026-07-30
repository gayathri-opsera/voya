export const flightSearchFixture = {
  origin: "JFK",
  destination: "LHR",
  departureDate: "2099-06-15",
  returnDate: "2099-06-22",
  passengers: 2,
  seatClass: "ECONOMY",
  currency: "USD",
};

export const invalidFlightSearchFixture = {
  origin: "JFKK",   // 4-letter — invalid
  destination: "LHR",
  departureDate: "2099-06-15",
  passengers: 2,
  seatClass: "ECONOMY",
  currency: "USD",
};
