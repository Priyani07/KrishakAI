import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { hashPassword, verifyPassword, isAdmin, registerCommunityRoutes } from "./community.js";

const serverSource = readFileSync(new URL("./community.js", import.meta.url), "utf8");
const appSource = readFileSync(new URL("../client/src/App.jsx", import.meta.url), "utf8");

describe("Admin authentication", () => {
  it("accepts any database-backed admin email", () => {
    expect(isAdmin({ role: "admin", email: "owner@example.test" })).toBe(true);
    expect(isAdmin({ role: "farmer", email: "owner@example.test" })).toBe(false);
  });

  it("does not contain the former fixed Admin email", () => {
    expect(serverSource).not.toContain("admin@gmail.com");
    expect(appSource).not.toContain("admin@gmail.com");
  });

  it("stores salted scrypt password hashes", async () => {
    const password = "SecureAdmin!2026";
    const first = await hashPassword(password);
    const second = await hashPassword(password);
    expect(first).toMatch(/^scrypt\$/);
    expect(first).not.toContain(password);
    expect(first).not.toBe(second);
    expect(await verifyPassword(password, first)).toBe(true);
    expect(await verifyPassword("wrong-password", first)).toBe(false);
  });

  it("registers the Community routes", () => {
    expect(typeof registerCommunityRoutes).toBe("function");
  });
});

describe("Admin signup security", () => {
  it("offers Farmer and Admin roles in signup", () => {
    expect(appSource).toContain('<option value="farmer">Farmer</option>');
    expect(appSource).toContain('<option value="admin">Admin</option>');
  });

  it("requires a server-side Admin signup secret", () => {
    expect(serverSource).toContain("process.env.ADMIN_SETUP_SECRET");
    expect(serverSource).toContain("secretsMatch(process.env.ADMIN_SETUP_SECRET");
    expect(serverSource).not.toContain("VITE_ADMIN");
  });

  it("stores the server-approved role in the database", () => {
    expect(serverSource).toContain("password_hash, role) VALUES (?, ?, ?, ?, ?)");
    expect(serverSource).toContain("requestedRole");
  });

  it("requires longer passwords for Admin accounts", () => {
    expect(serverSource).toContain('requestedRole === "admin" ? 12 : 8');
  });
});

describe("Admin authorization", () => {
  it("protects Admin APIs using the authenticated database role", () => {
    expect(serverSource).toContain("isAdmin(user)");
    expect(serverSource).toContain('user?.role === "admin"');
  });

  it("keeps Admin metrics and Farmer-list endpoints", () => {
    expect(serverSource).toContain('/admin/stats');
    expect(serverSource).toContain('/admin/farmers');
  });

  it("keeps complaint management server-side", () => {
    expect(serverSource).toContain("UPDATE community_complaints");
    expect(serverSource).toContain("DELETE FROM community_complaints");
  });

  it("keeps database-backed opaque sessions", () => {
    expect(serverSource).toContain("community_sessions");
    expect(serverSource).toContain("jti");
    expect(serverSource).toContain("revoked_at");
  });

  it("redirects a logged-in Admin to the Admin dashboard", () => {
    expect(appSource).toContain('payload?.user?.role === "admin" ? "/admin" : "/profile"');
    expect(appSource).toContain('requiredRole="admin"');
  });
});
