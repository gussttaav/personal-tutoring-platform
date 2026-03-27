/** @type {import('next').NextConfig} */

const isDev = process.env.NODE_ENV === "development";

const nextConfig = {
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "lh3.googleusercontent.com" },
    ],
  },

  experimental: {
    instrumentationHook: true,
  },

  async headers() {
    const csp = isDev
      ? [
          // Dev: relaxed — allows Next.js HMR, webpack eval, etc.
          "default-src 'self'",
          "script-src 'self' 'unsafe-eval' 'unsafe-inline' https://va.vercel-scripts.com",
          "img-src 'self' https://lh3.googleusercontent.com data: blob:",
          "connect-src 'self' ws://localhost:* wss://localhost:* https://www.googleapis.com https://generativelanguage.googleapis.com https://*.upstash.io",
          "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
          "font-src 'self' https://fonts.gstatic.com",
          "object-src 'none'",
        ]
      : [
          // Production
          // 'unsafe-inline' is required for Next.js hydration scripts.
          // Removing it breaks the app. A nonce-based alternative would
          // require a custom server — not viable on Vercel's edge runtime.
          "default-src 'self'",
          "script-src 'self' 'unsafe-inline' https://va.vercel-scripts.com",
          "img-src 'self' https://lh3.googleusercontent.com data: blob:",
          "connect-src 'self' https://www.googleapis.com https://generativelanguage.googleapis.com https://*.upstash.io",
          "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
          "font-src 'self' https://fonts.gstatic.com",
          "object-src 'none'",
          "base-uri 'self'",
          "form-action 'self'",
        ];

    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Content-Type-Options",   value: "nosniff" },
          { key: "X-Frame-Options",           value: "DENY" },
          { key: "X-XSS-Protection",          value: "1; mode=block" },
          { key: "Referrer-Policy",           value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy",        value: "camera=(), microphone=(), geolocation=()" },
          { key: "Content-Security-Policy",   value: csp.join("; ") },
        ],
      },
    ];
  },
};

export default nextConfig;
