import { describe, expect, it } from "vitest";
import { hashPassword, verifyPassword } from "./community.js";

describe("Community password security", () => {
  it("stores a salted scrypt hash and verifies only the original password", async () => {
    const password = "KrishakTest!2026";
    const hash = await hashPassword(password);
    expect(hash).toMatch(/^scrypt\$/);
    expect(hash).not.toContain(password);
    expect(await verifyPassword(password, hash)).toBe(true);
    expect(await verifyPassword("wrong-password", hash)).toBe(false);
  });
});
