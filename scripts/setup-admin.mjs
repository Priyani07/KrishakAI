#!/usr/bin/env node
/** Provision the single Krishak administrator through the hardened HTTP bootstrap. */
import "dotenv/config";
import { createInterface } from "node:readline";
import mysql from "mysql2/promise";

const ADMIN_EMAIL = String(process.env.ADMIN_EMAIL || "").trim().toLowerCase();
const BASE = (process.env.SERVER_URL || "http://localhost:3000").replace(/\/$/, "");

function promptHidden(label) {
  if (!process.stdin.isTTY) throw new Error("Set ADMIN_PASSWORD in the local process environment for non-interactive provisioning.");
  return new Promise((resolve) => {
    process.stdout.write(label);
    process.stdin.setRawMode(true);
    let value = "";
    const onData = (chunk) => {
      const char = chunk.toString();
      if (char === "\r" || char === "\n") { process.stdin.setRawMode(false); process.stdin.off("data", onData); process.stdout.write("\n"); resolve(value); }
      else if (char === "\u0003") process.exit(1);
      else if (char === "\u007f") value = value.slice(0, -1);
      else { value += char; process.stdout.write("*"); }
    };
    process.stdin.on("data", onData);
  });
}

async function main() {
  if (!ADMIN_EMAIL) throw new Error("Set ADMIN_EMAIL to the Admin account email; it is never hardcoded.");
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required so the resulting row can be verified.");
  if (!process.env.ADMIN_SETUP_SECRET) throw new Error("ADMIN_SETUP_SECRET is not configured.");
  const password = process.env.ADMIN_PASSWORD || await promptHidden("Admin password (hidden, 12+ characters): ");
  if (password.length < 12) throw new Error("Admin password must be at least 12 characters.");
  const connection = await mysql.createConnection(process.env.DATABASE_URL);
  try {
    const [before] = await connection.execute("SELECT id, email, role FROM community_users WHERE email = ? LIMIT 1", [ADMIN_EMAIL]);
    if (before.length) {
      if (before[0].role === "admin") {
        console.log("An administrator row for this email already exists; no account was created.");
        return;
      }
      throw new Error("This email already belongs to a Farmer account; use a different email or resolve it manually.");
    }
    const response = await fetch(`${BASE}/api/community/auth/admin-bootstrap`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ setupSecret: process.env.ADMIN_SETUP_SECRET, name: process.env.ADMIN_NAME || "Administrator", email: ADMIN_EMAIL, password }),
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.message || `Admin bootstrap failed with HTTP ${response.status}.`);
    const [rows] = await connection.execute("SELECT id, email, role FROM community_users WHERE email = ? LIMIT 1", [ADMIN_EMAIL]);
    if (rows.length !== 1 || String(rows[0].email).toLowerCase() !== ADMIN_EMAIL || rows[0].role !== "admin") {
      throw new Error("Bootstrap returned success, but the administrator database row could not be verified.");
    }
    console.log("Administrator provisioned and database row verified.");
  } finally { await connection.end(); }
}

main().catch((error) => { console.error(`Admin provisioning failed: ${error.message}`); process.exit(1); });
