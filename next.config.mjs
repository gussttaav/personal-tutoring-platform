import { withSentryConfig } from "@sentry/nextjs";
/** @type {import('next').NextConfig} */

const isDev = process.env.NODE_ENV === "development";

const nextConfig = {
  transpilePackages: ["@zoom/videosdk"],

  images: {
    remotePatterns: [
      { protocol: "https", hostname: "lh3.googleusercontent.com" },
    ],
  },

  async headers() {
    // Zoom Video SDK origins:
    //   - zoom.us        : license/session check endpoint (/wc/lsdk) — root domain, NOT covered by *.zoom.us
    //   - *.zoom.us      : media relays, signalling, etc.
    //   - CloudFront CDNs: primary asset CDN + sourcemaps
    //   - source.zoom.us : fallback asset CDN
    const zoomOrigins = "https://zoom.us https://*.zoom.us wss://*.zoom.us https://dmogdx0jrul3u.cloudfront.net https://d1cdksi819e9z7.cloudfront.net https://source.zoom.us";

    // Stripe requires:
    //   script-src  : https://js.stripe.com  (loads Stripe.js)
    //   connect-src : https://api.stripe.com  (payment confirmation XHR)
    //                 https://js.stripe.com   (telemetry / fraud signals)
    //   frame-src   : https://*.stripe.com    (3DS authentication iframes)
    const stripeOrigins = "https://js.stripe.com https://api.stripe.com";
    const stripeFrames  = "https://*.stripe.com";

    const csp = isDev
      ? [
          // Dev: relaxed — allows Next.js HMR, webpack eval, etc.
          "default-src 'self'",
          `script-src 'self' 'unsafe-eval' 'unsafe-inline' https://va.vercel-scripts.com ${zoomOrigins} ${stripeOrigins} blob:`,
          "img-src 'self' https://lh3.googleusercontent.com data: blob:",
          `connect-src 'self' ws://localhost:* wss://localhost:* https://www.googleapis.com https://generativelanguage.googleapis.com https://*.upstash.io https://*.zmtg.com https://*.supabase.co wss://*.supabase.co ${zoomOrigins} ${stripeOrigins}`,
          "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
          "font-src 'self' https://fonts.gstatic.com",
          // Zoom Video SDK loads its WASM engine inside a Web Worker from CloudFront/source.zoom.us
          `worker-src 'self' blob: ${zoomOrigins}`,
          `child-src 'self' blob: ${zoomOrigins}`,
          "media-src 'self' blob: mediastream:",
          `frame-src ${stripeFrames}`,
          "object-src 'none'",
        ]
      : [
          // Production
          // 'unsafe-inline' is required for Next.js hydration scripts.
          // Removing it breaks the app. A nonce-based alternative would
          // require a custom server — not viable on Vercel's edge runtime.
          "default-src 'self'",
          // 'wasm-unsafe-eval' is required by Zoom Video SDK to instantiate its WebAssembly engine.
          // 'unsafe-eval' is additionally required by the Zoom SDK's TensorFlow.js workers, which
          // use new Function() for their codec pipeline (screen share encoding + AI features).
          `script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval' 'unsafe-eval' https://va.vercel-scripts.com ${zoomOrigins} ${stripeOrigins} blob:`,
          "img-src 'self' https://lh3.googleusercontent.com data: blob:",
          `connect-src 'self' https://www.googleapis.com https://generativelanguage.googleapis.com https://*.upstash.io https://*.zmtg.com https://*.supabase.co wss://*.supabase.co ${zoomOrigins} ${stripeOrigins}`,
          "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
          "font-src 'self' https://fonts.gstatic.com",
          // Zoom Video SDK loads its WASM engine inside a Web Worker from CloudFront/source.zoom.us
          `worker-src 'self' blob: ${zoomOrigins}`,
          `child-src 'self' blob: ${zoomOrigins}`,
          "media-src 'self' blob: mediastream:",
          `frame-src ${stripeFrames}`,
          "object-src 'none'",
          "base-uri 'self'",
          "form-action 'self'",
        ];

    return [
      // Global headers — camera/mic denied by default everywhere
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
      // Session page — allow camera/mic + enable SharedArrayBuffer for Zoom SDK.
      // SharedArrayBuffer requires COOP + COEP (Chrome/Firefox block it otherwise).
      // Using COEP "credentialless" (not "require-corp") so Zoom's CDN scripts
      // load without needing explicit CORP headers on those responses.
      {
        source: "/sesion/:token*",
        headers: [
          { key: "Permissions-Policy",             value: "camera=(self), microphone=(self)" },
          { key: "Cross-Origin-Opener-Policy",     value: "same-origin" },
          { key: "Cross-Origin-Embedder-Policy",   value: "credentialless" },
        ],
      },
    ];
  },
};

export default withSentryConfig(nextConfig, {
  // For all available options, see:
  // https://www.npmjs.com/package/@sentry/webpack-plugin#options

  org: "gustavoai",

  project: "javascript-nextjs",

  // Only print logs for uploading source maps in CI
  silent: !process.env.CI,

  // For all available options, see:
  // https://docs.sentry.io/platforms/javascript/guides/nextjs/manual-setup/

  // Upload a larger set of source maps for prettier stack traces (increases build time)
  widenClientFileUpload: true,

  // Route browser requests to Sentry through a Next.js rewrite to circumvent ad-blockers.
  // This can increase your server load as well as your hosting bill.
  // Note: Check that the configured route will not match with your Next.js middleware, otherwise reporting of client-
  // side errors will fail.
  tunnelRoute: "/monitoring",

  webpack: {
    // Enables automatic instrumentation of Vercel Cron Monitors. (Does not yet work with App Router route handlers.)
    // See the following for more information:
    // https://docs.sentry.io/product/crons/
    // https://vercel.com/docs/cron-jobs
    automaticVercelMonitors: true,

    // Tree-shaking options for reducing bundle size
    treeshake: {
      // Automatically tree-shake Sentry logger statements to reduce bundle size
      removeDebugLogging: true,
    },
  },
});
