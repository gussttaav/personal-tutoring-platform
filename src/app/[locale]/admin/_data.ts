/**
 * ADMIN-01: Admin-only data fetching utilities.
 *
 * Uses the Supabase service-role client directly (bypasses RLS) for aggregate
 * queries that have no equivalent on existing repository interfaces.
 * All functions are server-only — never call these from client components.
 */

import { supabase } from "@/infrastructure/supabase/client";
import { supabaseAuditRepository } from "@/infrastructure/supabase";
import type { AuditEntry } from "@/domain/types";

// ─── Dashboard stats ──────────────────────────────────────────────────────────

export async function countUpcomingBookings(): Promise<number> {
  const { count } = await supabase
    .from("bookings")
    .select("id", { count: "exact", head: true })
    .eq("status", "confirmed")
    .gt("starts_at", new Date().toISOString());
  return count ?? 0;
}

export async function countStudentsWithLowCredits(): Promise<number> {
  const now = new Date().toISOString();

  const [usersRes, packsRes] = await Promise.all([
    supabase.from("users").select("id", { count: "exact", head: true }),
    supabase
      .from("credit_packs")
      .select("user_id, credits_remaining")
      .gt("credits_remaining", 0)
      .gt("expires_at", now),
  ]);

  const totalUsers = usersRes.count ?? 0;

  // Sum credits per user from active packs
  const creditByUser = new Map<string, number>();
  for (const p of packsRes.data ?? []) {
    creditByUser.set(p.user_id, (creditByUser.get(p.user_id) ?? 0) + p.credits_remaining);
  }

  // Users with > 1 credit are "healthy"; everyone else is low
  const healthyUsers = Array.from(creditByUser.values()).filter(c => c > 1).length;
  return totalUsers - healthyUsers;
}

export async function countFailedBookings(): Promise<number> {
  const { count } = await supabase
    .from("failed_bookings")
    .select("stripe_session_id", { count: "exact", head: true });
  return count ?? 0;
}

export async function sumRevenueLast30Days(): Promise<number> {
  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const { data } = await supabase
    .from("payments")
    .select("amount_cents")
    .eq("status", "succeeded")
    .gt("created_at", since);
  return (data ?? []).reduce((sum, p) => sum + p.amount_cents, 0);
}

// ─── Student list ─────────────────────────────────────────────────────────────

export interface StudentSummary {
  email:          string;
  name:           string;
  totalCredits:   number;
  earliestExpiry: string | null;
  nextSession:    string | null;
}

export async function fetchStudents(filter?: string): Promise<StudentSummary[]> {
  const now = new Date().toISOString();

  const [usersRes, packsRes, bookingsRes] = await Promise.all([
    supabase
      .from("users")
      .select("id, email, name")
      .order("email")
      .limit(100),
    supabase
      .from("credit_packs")
      .select("user_id, credits_remaining, expires_at")
      .gt("credits_remaining", 0)
      .gt("expires_at", now),
    supabase
      .from("bookings")
      .select("user_id, starts_at")
      .eq("status", "confirmed")
      .gt("starts_at", now)
      .order("starts_at"),
  ]);

  const users = usersRes.data ?? [];

  // Build lookup maps
  const creditsByUser = new Map<string, { total: number; expiry: string | null }>();
  for (const p of packsRes.data ?? []) {
    const cur = creditsByUser.get(p.user_id) ?? { total: 0, expiry: null };
    creditsByUser.set(p.user_id, {
      total:  cur.total + p.credits_remaining,
      expiry: cur.expiry === null || p.expires_at < cur.expiry ? p.expires_at : cur.expiry,
    });
  }

  const nextSessionByUser = new Map<string, string>();
  for (const b of bookingsRes.data ?? []) {
    if (!nextSessionByUser.has(b.user_id)) {
      nextSessionByUser.set(b.user_id, b.starts_at);
    }
  }

  let students: StudentSummary[] = users.map(u => {
    const credits = creditsByUser.get(u.id);
    return {
      email:          u.email,
      name:           u.name ?? u.email,
      totalCredits:   credits?.total ?? 0,
      earliestExpiry: credits?.expiry ?? null,
      nextSession:    nextSessionByUser.get(u.id) ?? null,
    };
  });

  if (filter === "low-credit") {
    students = students.filter(s => s.totalCredits <= 1);
  }

  return students;
}

// ─── Student detail ───────────────────────────────────────────────────────────

export interface StudentDetail {
  id:    string;
  email: string;
  name:  string;
}

export interface CreditPackRow {
  id:                string;
  pack_size:         number;
  credits_remaining: number;
  expires_at:        string;
  created_at:        string;
  stripe_payment_id: string;
}

export interface BookingRow {
  id:           string;
  session_type: string;
  starts_at:    string;
  ends_at:      string;
  status:       string;
}

export async function fetchStudent(email: string): Promise<StudentDetail | null> {
  const { data } = await supabase
    .from("users")
    .select("id, email, name")
    .eq("email", email)
    .single();
  return data ?? null;
}

export async function fetchCreditPacks(email: string): Promise<CreditPackRow[]> {
  const user = await fetchStudent(email);
  if (!user) return [];

  const { data } = await supabase
    .from("credit_packs")
    .select("id, pack_size, credits_remaining, expires_at, created_at, stripe_payment_id")
    .eq("user_id", user.id)
    .order("expires_at");
  return data ?? [];
}

export async function fetchStudentBookings(email: string): Promise<BookingRow[]> {
  const user = await fetchStudent(email);
  if (!user) return [];

  const { data } = await supabase
    .from("bookings")
    .select("id, session_type, starts_at, ends_at, status")
    .eq("user_id", user.id)
    .order("starts_at", { ascending: false })
    .limit(50);
  return data ?? [];
}

export async function fetchAuditLog(email: string): Promise<AuditEntry[]> {
  return supabaseAuditRepository.list(email, 50);
}

// ─── Admin bookings list ──────────────────────────────────────────────────────

export interface AdminBookingRow {
  id:           string;
  join_token:   string;
  session_type: string;
  starts_at:    string;
  ends_at:      string;
  status:       string;
  email:        string;
  name:         string;
}

export async function fetchAllBookings(): Promise<AdminBookingRow[]> {
  const { data } = await supabase
    .from("bookings")
    .select("id, join_token, session_type, starts_at, ends_at, status, users(email, name)")
    .order("starts_at", { ascending: false })
    .limit(100);

  return (data ?? []).map(b => {
    const user = Array.isArray(b.users) ? b.users[0] : b.users;
    return {
      id:           b.id,
      join_token:   (b as { join_token?: string | null }).join_token ?? "",
      session_type: b.session_type,
      starts_at:    b.starts_at,
      ends_at:      b.ends_at,
      status:       b.status,
      email:        (user as { email: string } | null)?.email ?? "—",
      name:         (user as { name: string } | null)?.name ?? "—",
    };
  });
}

// ─── Admin payments list ──────────────────────────────────────────────────────

export interface AdminPaymentRow {
  id:                string;
  amount_cents:      number;
  currency:          string;
  status:            string;
  checkout_type:     string;
  created_at:        string;
  stripe_payment_id: string;
  email:             string;
  name:              string;
}

export async function fetchPayments(): Promise<AdminPaymentRow[]> {
  const { data } = await supabase
    .from("payments")
    .select("id, amount_cents, currency, status, checkout_type, created_at, stripe_payment_id, users(email, name)")
    .order("created_at", { ascending: false })
    .limit(100);

  return (data ?? []).map(p => {
    const user = Array.isArray(p.users) ? p.users[0] : p.users;
    return {
      id:                p.id,
      amount_cents:      p.amount_cents,
      currency:          p.currency,
      status:            p.status,
      checkout_type:     p.checkout_type,
      created_at:        p.created_at,
      stripe_payment_id: p.stripe_payment_id,
      email:             (user as { email: string } | null)?.email ?? "—",
      name:              (user as { name: string } | null)?.name ?? "—",
    };
  });
}
