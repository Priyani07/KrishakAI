#!/usr/bin/env node
/** End-to-end administrator, authorization, complaint, IDOR, and logout verifier. */
import "dotenv/config";
import mysql from "mysql2/promise";

const BASE = (process.env.SERVER_URL || "http://localhost:3000").replace(/\/$/, "");
const API = `${BASE}/api/community`;
const ADMIN_EMAIL = String(process.env.ADMIN_EMAIL || "").trim().toLowerCase();
const password = process.env.ADMIN_PASSWORD || "";
let passed = 0;

function check(condition, label, detail = "") {
  if (!condition) throw new Error(`${label}${detail ? ` (${detail})` : ""}`);
  passed += 1; console.log(`PASS ${String(passed).padStart(2, "0")} — ${label}`);
}
async function request(method, path, body, token) {
  const response = await fetch(`${API}${path}`, { method, headers: { Accept: "application/json", "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: body === undefined ? undefined : JSON.stringify(body) });
  const payload = await response.json().catch(() => ({}));
  return { status: response.status, payload };
}

async function main() {
  if (!ADMIN_EMAIL) throw new Error("Set ADMIN_EMAIL to the Admin account email; it is never hardcoded.");
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required for direct administrator-row verification.");
  if (password.length < 12) throw new Error("Set ADMIN_PASSWORD in the local process environment; it is never printed.");
  const db = await mysql.createConnection(process.env.DATABASE_URL);
  try {
    const [admins] = await db.execute("SELECT id, email, role FROM community_users WHERE email = ? LIMIT 1", [ADMIN_EMAIL]);
    check(admins.length === 1 && admins[0].role === "admin", "configured Admin row exists");
  } finally { await db.end(); }

  const login = await request("POST", "/auth/login", { email: ADMIN_EMAIL, password });
  const adminToken = login.payload.token;
  check(login.status === 200 && adminToken && login.payload.user?.role === "admin", "Admin login returns an authenticated session");
  const me = await request("GET", "/users/me", undefined, adminToken);
  check(me.status === 200 && me.payload.user?.email?.toLowerCase() === ADMIN_EMAIL, "Admin session resolves through /users/me");
  const page = await fetch(`${BASE}/admin`);
  check(page.ok, "/admin application route is served");
  const stats = await request("GET", "/admin/stats", undefined, adminToken);
  check(stats.status === 200 && Number.isFinite(Number(stats.payload.totalComplaints)), "Admin dashboard metrics load");
  const farmers = await request("GET", "/admin/farmers", undefined, adminToken);
  check(farmers.status === 200 && Array.isArray(farmers.payload.farmers), "Admin Farmer list loads");
  const queue = await request("GET", "/complaints", undefined, adminToken);
  check(queue.status === 200 && Array.isArray(queue.payload.complaints), "Admin complaint queue loads");

  const suffix = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const farmerPassword = "FarmerVerify!123";
  const spoof = await request("POST", "/auth/signup", { name: "Spoof Attempt", email: `spoof-${suffix}@example.invalid`, password: "SecureAdmin!2026", role: "admin" });
  check(spoof.status === 403, "Admin role without the server-issued signup code is denied");
  const signup = await request("POST", "/auth/signup", { name: "Verification Farmer", farmName: "Verification Farm", email: `verify-${suffix}@example.invalid`, password: farmerPassword, role: "farmer" });
  const farmerToken = signup.payload.token;
  check(signup.status === 201 && signup.payload.user?.role === "farmer", "Farmer signup returns a Farmer session");
  const denied = await request("GET", "/admin/stats", undefined, farmerToken);
  check(denied.status === 403, "Farmer is denied Admin APIs");
  const complaint = await request("POST", "/complaints", { subject: "Verification complaint", category: "Other", description: "Temporary complaint used by the local verification script.", location: "" }, farmerToken);
  const complaintId = complaint.payload.complaint?.id;
  check(complaint.status === 201 && complaintId, "Farmer creates a complaint");

  const second = await request("POST", "/auth/signup", { name: "Second Verification Farmer", email: `verify-second-${suffix}@example.invalid`, password: farmerPassword });
  const idor = await request("GET", `/complaints/${complaintId}`, undefined, second.payload.token);
  check(idor.status === 403, "Farmer complaint IDOR is denied");
  const detail = await request("GET", `/complaints/${complaintId}`, undefined, adminToken);
  check(detail.status === 200 && detail.payload.complaint?.id === complaintId, "Admin opens complaint details");
  const solution = await request("PATCH", `/complaints/${complaintId}`, { solution: "Verified response from the administrator workflow." }, adminToken);
  check(solution.status === 200 && solution.payload.complaint?.solution, "Admin saves a solution");
  const resolved = await request("PATCH", `/complaints/${complaintId}`, { status: "resolved" }, adminToken);
  check(resolved.status === 200 && resolved.payload.complaint?.status === "resolved", "Admin resolves the complaint");
  const persisted = await request("GET", `/complaints/${complaintId}`, undefined, adminToken);
  check(persisted.payload.complaint?.status === "resolved", "resolution persists after re-fetch");
  const removed = await request("DELETE", `/complaints/${complaintId}`, undefined, adminToken);
  check(removed.status === 200, "Admin deletes the temporary complaint");
  const logout = await request("POST", "/auth/logout", {}, adminToken);
  check(logout.status === 200, "Admin logout succeeds");
  const revoked = await request("GET", "/admin/stats", undefined, adminToken);
  check(revoked.status === 401, "logged-out Admin session is revoked");
  console.log(`All ${passed} verification checks passed.`);
}

main().catch((error) => { console.error(`Admin verification failed after ${passed} checks: ${error.message}`); process.exit(1); });
