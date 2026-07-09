// TEST-01: Updated to support separate unit and integration test projects.
const nextJest = require("next/jest");

const createJestConfig = nextJest({ dir: "./" });

const baseUserConfig = {
  testEnvironment: "node",
  moduleNameMapper: { "^@/(.*)$": "<rootDir>/src/$1" },
};

/** @type {import('jest').Config} */
module.exports = async () => {
  // Call the async factory to get the full Next.js-enriched config (transforms, etc.)
  const base = await createJestConfig(baseUserConfig)();

  // next-intl, use-intl and their @formatjs deps are ESM-only packages.
  // Extend next/jest's transformIgnorePatterns so Jest transpiles them via
  // the SWC transform. Scoped names need two spellings: pnpm stores the
  // package dir as `@scope+name@version` while the nested node_modules path
  // keeps `@scope/name` (SEO-01 added the @formatjs packages, pulled in by
  // next-intl's middleware).
  const ESM_PACKAGES = [
    "next-intl",
    "use-intl",
    "@formatjs/intl-localematcher",
    "@formatjs/fast-memoize",
    "@formatjs/icu-messageformat-parser",
    "@formatjs/icu-skeleton-parser",
    "intl-messageformat",
  ];
  const esmRegex = ESM_PACKAGES.join("|");
  const esmPnpmDirRegex = ESM_PACKAGES.map((p) => p.replace("/", "\\+")).join("|");
  const esmNestedRegex = ESM_PACKAGES.map((p) => p.replace("/", "[\\\\/]")).join("|");
  const transformIgnorePatterns = (base.transformIgnorePatterns ?? []).map(
    (/** @type {string} */ pattern) => {
      if (typeof pattern !== "string") return pattern;
      // Regular node_modules pattern (non-pnpm)
      if (pattern.startsWith("/node_modules/(?!.pnpm)")) {
        return pattern.replace("(?!.pnpm)(?!(", `(?!.pnpm)(?!(${esmRegex}|`);
      }
      // pnpm-specific pattern
      if (pattern.includes("\\.pnpm")) {
        return pattern
          .replace(/\(\?!\(([^)]+)\)@\)/, `(?!($1|${esmPnpmDirRegex})@)`)
          .replace(
            /\(\?!.*node_modules\[.*?\]\(([^)]+)\)\[.*?\]\)/,
            (m, inner) => m.replace(inner, `${inner}|${esmNestedRegex}`),
          );
      }
      return pattern;
    },
  );

  return {
    ...base,
    transformIgnorePatterns,
    coverageProvider: "v8",
    collectCoverageFrom: [
      "src/lib/kv.ts",
      "src/lib/calendar.ts",
      "src/lib/validation.ts",
      "src/lib/ip-utils.ts",
      "src/lib/startup-checks.ts",
      "src/constants/errors.ts",
      "src/services/*.ts",
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
    projects: [
      {
        ...base,
        transformIgnorePatterns,
        displayName: "unit",
        testMatch: [
          "<rootDir>/src/**/*.test.ts",
          "<rootDir>/src/**/*.test.tsx",
        ],
        testPathIgnorePatterns: [
          ...(base.testPathIgnorePatterns ?? ["/node_modules/"]),
          "<rootDir>/src/__tests__/integration/",
        ],
      },
      {
        ...base,
        transformIgnorePatterns,
        displayName: "integration",
        testMatch: ["<rootDir>/src/__tests__/integration/**/*.test.ts"],
        testTimeout: 10_000,
      },
    ],
  };
};
