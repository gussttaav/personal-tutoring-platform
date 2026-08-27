/**
 * BUILD-03 (TEMPORARY DIAGNOSTIC — revert once the cause is known)
 *
 * Vercel builds fail during static prerender with PostgREST
 * `PGRST303 "JWT issued at future"`, while the SAME code, key and project work
 * fine from a laptop, from curl, and from the deployed Vercel runtime
 * (`/api/pricing` returns live prices). The app never signs a Supabase JWT
 * itself — it sends the `sb_secret_` key and Supabase's gateway mints the token
 * — so the future `iat` is produced on Supabase's side. This script measures,
 * from inside the Vercel build container, the things that would explain it:
 *
 *   1. Clock skew between this container and Supabase (their `Date` header).
 *   2. Which edge/gateway node serves us (resolved IPs + response headers).
 *   3. Whether the failure is per-connection: 3 probes, each forced onto a
 *      NEW TCP connection (keepAlive:false), plus one supabase-js call that
 *      mirrors exactly what the build does.
 *   4. Whether it is specific to the secret key, via an anon-key control probe.
 *
 * Never prints secrets — only key prefix and length. Always exits 0 so it can
 * never fail the build on its own.
 */
import https from "node:https";
import dns from "node:dns/promises";
import fs from "node:fs";

const TAG = "[SB-DIAG]";
const log = (...a) => console.log(TAG, ...a);

/** process.env wins; fall back to .env files so this is runnable locally too. */
function loadEnv() {
  const out = {};
  for (const f of [".env", ".env.local"]) {
    try {
      for (const line of fs.readFileSync(f, "utf8").split(/\r?\n/)) {
        const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/);
        if (m) out[m[1]] = m[2].trim().replace(/^["']|["']$/g, "");
      }
    } catch { /* file absent — fine */ }
  }
  return { ...out, ...process.env };
}

/** One REST GET on a guaranteed-fresh TCP connection. */
function probe({ host, path, key, label }) {
  return new Promise((resolve) => {
    const sentAt = Date.now();
    const req = https.request(
      {
        host,
        path,
        method: "GET",
        // keepAlive:false + a private agent ⇒ this probe cannot reuse a socket.
        agent: new https.Agent({ keepAlive: false }),
        headers: { apikey: key, Authorization: `Bearer ${key}`, Accept: "application/json" },
      },
      (res) => {
        const recvAt = Date.now();
        let body = "";
        res.on("data", (c) => (body += c));
        res.on("end", () => {
          const rtt = recvAt - sentAt;
          // Midpoint estimate removes ~half the RTT from the skew measurement.
          const localMid = sentAt + rtt / 2;
          const serverMs = res.headers.date ? Date.parse(res.headers.date) : null;
          const skew = serverMs !== null ? Math.round((serverMs - localMid) / 1000) : null;
          resolve({
            label, status: res.statusCode, rtt, skewSeconds: skew,
            serverDate: res.headers.date ?? null,
            headers: {
              server: res.headers.server,
              "cf-ray": res.headers["cf-ray"],
              "x-served-by": res.headers["x-served-by"],
              "sb-gateway-version": res.headers["sb-gateway-version"],
              "sb-project-ref": res.headers["sb-project-ref"],
            },
            body: body.slice(0, 240),
          });
        });
      },
    );
    req.on("error", (e) => resolve({ label, error: e.message }));
    req.setTimeout(15000, () => { req.destroy(); resolve({ label, error: "timeout" }); });
    req.end();
  });
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function main() {
  const env = loadEnv();
  const url = env.NEXT_PUBLIC_SUPABASE_URL;
  const secret = env.SUPABASE_SERVICE_ROLE_KEY;
  const anon = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  log("=========== BUILD-03 Supabase diagnostic ===========");
  log("container time :", new Date().toISOString(), "epoch=", Date.now());
  log("TZ             :", Intl.DateTimeFormat().resolvedOptions().timeZone, "offsetMin=", new Date().getTimezoneOffset());
  log("node           :", process.version, process.platform, process.arch);
  log("vercel region  :", process.env.VERCEL_REGION ?? "(n/a)", "env=", process.env.VERCEL_ENV ?? "(n/a)");
  log("supabase url   :", url ?? "(MISSING)");
  log("secret key     :", secret ? `${secret.slice(0, 10)}… len=${secret.length}` : "(MISSING)");
  log("anon key       :", anon ? `${anon.slice(0, 14)}… len=${anon.length}` : "(MISSING)");

  if (!url || !secret) { log("missing url/key — nothing to probe"); return; }
  const host = new URL(url).host;

  try {
    log("DNS A records  :", (await dns.resolve4(host)).join(", "));
  } catch (e) { log("DNS failed     :", e.message); }

  const path = "/rest/v1/pricing?select=product_key&limit=1";

  // Three fresh-connection probes. If some pass and some fail, the bad node is
  // per-connection; if all fail, the whole build network path is affected.
  for (let i = 1; i <= 3; i++) {
    const r = await probe({ host, path, key: secret, label: `secret#${i}` });
    log(`probe ${r.label} ->`, JSON.stringify(r));
    if (i < 3) await sleep(2000);
  }

  // Control: anon key down the same gateway. A clean 200 here while the secret
  // key gets PGRST303 would point at secret-key resolution, not the clock.
  if (anon) {
    const r = await probe({ host, path, key: anon, label: "anon#1" });
    log(`probe ${r.label} ->`, JSON.stringify(r));
  }

  // Mirror the real build path: supabase-js, same client options as
  // src/infrastructure/supabase/client.ts.
  try {
    const { createClient } = await import("@supabase/supabase-js");
    const sb = createClient(url, secret, { auth: { persistSession: false, autoRefreshToken: false } });
    const { data, error } = await sb.from("pricing").select("product_key").limit(1);
    log("supabase-js    :", error ? `ERROR ${JSON.stringify(error)}` : `OK ${JSON.stringify(data)}`);
  } catch (e) {
    log("supabase-js    : threw", e.message);
  }

  log("=========== end diagnostic ===========");
}

main().catch((e) => log("diagnostic crashed:", e?.message)).finally(() => process.exit(0));
