import { createServer } from "node:http";
import express from "express";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({ execute: vi.fn(), createPool: vi.fn() }));

vi.mock("mysql2/promise", () => ({ default: { createPool: db.createPool } }));

const { registerCommunityRoutes } = await import("./community.js");

let server;
let baseUrl;
let discussions;

beforeAll(async () => {
  db.createPool.mockReturnValue({ execute: db.execute });
  const app = express();
  app.use(express.json());
  registerCommunityRoutes(app);
  server = createServer(app);
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  baseUrl = `http://127.0.0.1:${address.port}/api/community`;
});

afterAll(async () => {
  if (server) await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
});

beforeEach(() => {
  discussions = Array.from({ length: 55 }, (_, index) => ({
    id: 55 - index,
    title: `Discussion ${55 - index}`,
    description: `Field context ${55 - index}`,
    problemType: "Field note",
    createdAt: `2026-08-22T10:${String(55 - index).padStart(2, "0")}:00.000Z`,
    authorName: "Verified Farmer",
  }));
  db.execute.mockReset();
  db.execute.mockImplementation(async (sql) => {
    if (sql.startsWith("SELECT COUNT(*) AS total FROM community_discussions")) return [[{ total: discussions.length }]];
    if (sql.includes("FROM community_discussions d") && sql.includes("ORDER BY d.created_at DESC, d.id DESC")) {
      const match = sql.match(/LIMIT (\d+) OFFSET (\d+)/);
      const [, limit, offset] = match;
      return [discussions.slice(Number(offset), Number(offset) + Number(limit))];
    }
    if (sql.includes("FROM community_discussions d") && sql.includes("WHERE d.id = ?")) {
      return [discussions.filter((discussion) => discussion.id === 1)];
    }
    throw new Error(`Unexpected query: ${sql}`);
  });
});

describe("Community discussion pagination API", () => {
  it("returns deterministic first and second pages with explicit metadata", async () => {
    const first = await fetch(`${baseUrl}/discussions?page=1&limit=2`);
    expect(first.status).toBe(200);
    await expect(first.json()).resolves.toEqual(expect.objectContaining({
      page: 1, limit: 2, total: 55, hasNext: true,
      discussions: [expect.objectContaining({ id: 55 }), expect.objectContaining({ id: 54 })],
    }));

    const second = await fetch(`${baseUrl}/discussions?page=2&limit=2`);
    expect(second.status).toBe(200);
    await expect(second.json()).resolves.toEqual(expect.objectContaining({
      page: 2, limit: 2, hasNext: true,
      discussions: [expect.objectContaining({ id: 53 }), expect.objectContaining({ id: 52 })],
    }));
  });

  it("caps the page size server-side and safely returns an empty later page", async () => {
    const capped = await fetch(`${baseUrl}/discussions?page=1&limit=999`);
    await expect(capped.json()).resolves.toEqual(expect.objectContaining({ page: 1, limit: 50, total: 55, hasNext: true, discussions: expect.any(Array) }));

    const later = await fetch(`${baseUrl}/discussions?page=99&limit=20`);
    await expect(later.json()).resolves.toEqual({ discussions: [], page: 99, limit: 20, total: 55, hasNext: false });
  });

  it("preserves existing public discussion detail retrieval", async () => {
    const response = await fetch(`${baseUrl}/discussions/1`);
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ discussion: expect.objectContaining({ id: 1, title: "Discussion 1" }) });
  });
});
