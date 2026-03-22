const nextJest = require("next/jest");

const createJestConfig = nextJest({ dir: "./" });

/** @type {import('jest').Config} */
const config = {
  testEnvironment: "node",
  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/src/$1",
  },
  coverageProvider: "v8",
  collectCoverageFrom: [
    "src/lib/kv.ts",
    "src/lib/calendar.ts",
    "src/lib/validation.ts",
    "src/lib/ip-utils.ts",
    "src/lib/startup-checks.ts",
    "src/constants/errors.ts",
  ],
  // Coverage thresholds — tighten as the suite grows.
  //
  // calendar.ts threshold notes:
  //   getAvailableSlots, createCalendarEvent, deleteCalendarEvent require a
  //   live Google Calendar API client and cannot be unit tested. They account
  //   for ~36% of lines and 4 of 13 functions. The thresholds below reflect
  //   what is genuinely testable (token logic + slot lock) without lowering
  //   the bar on kv.ts which is fully unit-testable.
  coverageThreshold: {
    "src/lib/kv.ts": {
      lines:     90,
      functions: 90,
      branches:  85,
    },
    "src/lib/calendar.ts": {
      lines:     60,   // Google API fns excluded — raises to ~95% once mocked
      functions: 50,   // 4 Google API fns not covered; remaining 9 are 100%
      branches:  75,
    },
  },
};

module.exports = createJestConfig(config);
