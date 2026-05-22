import nextCoreWebVitals from "eslint-config-next/core-web-vitals";

// Flat config (ESLint 9). Replaces the legacy .eslintrc.json after Next.js 16
// removed `next lint`. Mirrors the previous `extends: ["next/core-web-vitals"]`.
const config = [
  {
    ignores: [".next/**", "coverage/**", "playwright-report/**", "next-env.d.ts"],
  },
  ...nextCoreWebVitals,
  {
    // eslint-config-next@16 ships eslint-plugin-react-hooks v6, which newly
    // enables these rules at error level. They were not enforced under Next 15,
    // so they are kept as warnings here to avoid scope-creep in the v16 upgrade.
    // Addressing them is tracked as separate follow-up work.
    rules: {
      "react-hooks/set-state-in-effect": "warn",
      "react-hooks/refs": "warn",
      "react-hooks/purity": "warn",
    },
  },
];

export default config;
