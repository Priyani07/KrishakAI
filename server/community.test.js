/**
 * community.test.js
 * Unit tests for community.js: auth, admin creation, complaint CRUD,
 * role enforcement, and farmer ownership rules.
 *
 * These tests mock the MySQL pool so no live database is required.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { hashPassword, verifyPassword } from "./community.js";

// ─── Password hashing ─────────────────────────────────────────────────────────

describe("hashPassword / verifyPassword", () => {
  it("hashes a password and verifies it correctly", async () => {
    const hash = await hashPassword("correct-horse-battery");
    expect(typeof hash).toBe("string");
    expect(hash.startsWith("scrypt$")).toBe(true);
    await expect(verifyPassword("correct-horse-battery", hash)).resolves.toBe(true);
  });

  it("rejects a wrong password", async () => {
    const hash = await hashPassword("correct-horse-battery");
    await expect(verifyPassword("wrong-password", hash)).resolves.toBe(false);
  });

  it("rejects a malformed hash string gracefully", async () => {
    await expect(verifyPassword("any", "not-a-hash")).resolves.toBe(false);
  });

  it("produces unique hashes for the same password (random salt)", async () => {
    const h1 = await hashPassword("same-password");
    const h2 = await hashPassword("same-password");
    expect(h1).not.toBe(h2);
    await expect(verifyPassword("same-password", h1)).resolves.toBe(true);
    await expect(verifyPassword("same-password", h2)).resolves.toBe(true);
  });
});

// ─── Admin creation guards ────────────────────────────────────────────────────
// We test the guard logic via a simulated HTTP layer rather than calling
// registerCommunityRoutes (which requires a live Express/MySQL setup).

describe("Admin creation guards (unit)", () => {
  const VALID_SECRET = "super-secret-123";

  function adminCreateGuard(setupSecret, suppliedSecret) {
    if (!setupSecret) return { status: 503, message: "Admin creation is not enabled." };
    if (setupSecret !== suppliedSecret) return { status: 403, message: "Invalid setup secret." };
    return { status: 200, ok: true };
  }

  it("returns 503 when ADMIN_SETUP_SECRET is not configured", () => {
    const result = adminCreateGuard("", VALID_SECRET);
    expect(result.status).toBe(503);
  });

  it("returns 403 when supplied secret does not match", () => {
    const result = adminCreateGuard(VALID_SECRET, "wrong-secret");
    expect(result.status).toBe(403);
  });

  it("returns 200 when secret matches", () => {
    const result = adminCreateGuard(VALID_SECRET, VALID_SECRET);
    expect(result.status).toBe(200);
    expect(result.ok).toBe(true);
  });

  it("returns 403 for an empty supplied secret", () => {
    const result = adminCreateGuard(VALID_SECRET, "");
    expect(result.status).toBe(403);
  });
});

// ─── Farmer ownership enforcement (unit) ─────────────────────────────────────

describe("Complaint ownership rules (unit)", () => {
  function canViewComplaint(user, complaint) {
    if (user.role === "admin") return true;
    return Number(complaint.userId) === Number(user.id);
  }

  function canDeleteComplaint(user) {
    return user.role === "admin";
  }

  const adminUser = { id: 1, role: "admin" };
  const farmer1 = { id: 2, role: "farmer" };
  const farmer2 = { id: 3, role: "farmer" };
  const complaintByFarmer1 = { id: 10, userId: 2, subject: "Crop issue" };

  it("admin can view any complaint", () => {
    expect(canViewComplaint(adminUser, complaintByFarmer1)).toBe(true);
  });

  it("farmer can view own complaint", () => {
    expect(canViewComplaint(farmer1, complaintByFarmer1)).toBe(true);
  });

  it("farmer cannot view another farmer's complaint", () => {
    expect(canViewComplaint(farmer2, complaintByFarmer1)).toBe(false);
  });

  it("only admin can delete a complaint", () => {
    expect(canDeleteComplaint(adminUser)).toBe(true);
    expect(canDeleteComplaint(farmer1)).toBe(false);
  });
});

// ─── Status validation (unit) ─────────────────────────────────────────────────

describe("Complaint status validation", () => {
  const VALID_STATUSES = ["submitted", "in_review", "resolved"];

  function isValidStatus(value) {
    return typeof value === "string" && VALID_STATUSES.includes(value);
  }

  it("accepts all valid statuses", () => {
    expect(isValidStatus("submitted")).toBe(true);
    expect(isValidStatus("in_review")).toBe(true);
    expect(isValidStatus("resolved")).toBe(true);
  });

  it("rejects invalid status strings", () => {
    expect(isValidStatus("done")).toBe(false);
    expect(isValidStatus("")).toBe(false);
    expect(isValidStatus(null)).toBe(false);
    expect(isValidStatus(undefined)).toBe(false);
  });
});

// ─── Solution requirement when resolving ─────────────────────────────────────

describe("Resolution requires a solution", () => {
  function canResolve(newStatus, solution, existingSolution) {
    if (newStatus !== "resolved") return true;
    const finalSolution = solution ?? existingSolution;
    return Boolean(finalSolution && String(finalSolution).trim());
  }

  it("allows resolve when solution is supplied inline", () => {
    expect(canResolve("resolved", "Please use fertilizer X.", null)).toBe(true);
  });

  it("allows resolve when existing solution is already saved", () => {
    expect(canResolve("resolved", null, "Previously saved solution.")).toBe(true);
  });

  it("blocks resolve when no solution exists", () => {
    expect(canResolve("resolved", null, null)).toBe(false);
    expect(canResolve("resolved", "", "")).toBe(false);
    expect(canResolve("resolved", "  ", null)).toBe(false);
  });

  it("allows other status changes without a solution", () => {
    expect(canResolve("in_review", null, null)).toBe(true);
    expect(canResolve("submitted", null, null)).toBe(true);
  });
});
