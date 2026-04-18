/**
 * lib/qstash.ts — QStash singleton
 *
 * REL-01: Replaces setTimeout in serverless handlers with reliable delayed
 * message delivery. setTimeout does not fire reliably on Vercel because
 * function instances are recycled before long timers elapse.
 */

import { Client } from "@upstash/qstash";

function createQStashClient(): Client {
  const token = process.env.QSTASH_TOKEN;
  if (!token) throw new Error("QSTASH_TOKEN is not set");
  return new Client({ token });
}

export const qstash = createQStashClient();
