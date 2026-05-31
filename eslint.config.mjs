import nextCoreWebVitals from "eslint-config-next/core-web-vitals";

// Flat config (ESLint 9). Replaces the legacy .eslintrc.json after Next.js 16
// removed `next lint`. Mirrors the previous `extends: ["next/core-web-vitals"]`.
const config = [
  {
    ignores: [".next/**", "coverage/**", "playwright-report/**", "next-env.d.ts"],
  },
  ...nextCoreWebVitals,
];

export default config;
