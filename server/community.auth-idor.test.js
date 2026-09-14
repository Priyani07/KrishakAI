/**
 * community.auth-idor.test.js
 *
 * Endpoint-level security tests for community auth, IDOR prevention,
 * and role enforcement.
 *
 * These tests exercise the ACTUAL HTTP route handlers in community.js via a
 * real in-process Express server with a mocked MySQL pool. No live database
 * is required.
 *
 * WHY these tests exist:
 *   community.test.js tests locally-defined helper functions (adminCreateGuard,
 *   canViewComplaint, canDeleteComplaint) that mirror production logic but do
 *   not call the real route handlers. Those tests confirm the logic is sound
 *   but do NOT detect a bug introduced at the HTTP layer. These tests close
 *   that gap by sending real HTTP requests to the real route handlers.
 *
 * WHY the existing unit tests are KEPT:
 *   They are faster and catch logic errors in isolation. These tests complement
 *   them, not replace them.
 */
import { vi, describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import express from "express";
import { createServer } from "node:http";

// ─── Mock mysql2/promise ──────────────────────────────────────────────────────
// vi.mock is hoisted by vitest to run before imports, so the mock is in place
// when community.js initialises its mysql import.

const executeMock = vi.hoisted(() => vi.fn());

vi.mock("mysql2/promise", () => ({
  default: {
    createPool: () => ({ execute: executeMock }),
  },
}));

// Import registerCommunityRoutes AFTER the mock is registered.
import { registerCommunityRoutes } from "./community.js";

// ─── Test personas ────────────────────────────────────────────────────────────

const FARMER_A_TOKEN = "token-farmer-a";
const FARMER_B_TOKEN = "token-farmer-b";
const ADMIN_TOKEN = "token-admin";
const WRONG_ADMIN_TOKEN = "token-wrong-admin";

const FARMER_A = { id: 1, name: "Farmer A", farm_name: "", email: "a@farm.test", role: "farmer" };
const FARMER_B = { id: 2, name: "Farmer B", farm_name: "", email: "b@farm.test", role: "farmer" };
const ADMIN_USER = { id: 3, name: "Admin", farm_name: "", email: "owner@example.test", role: "admin" };
const WRONG_ADMIN_USER = { id: 4, name: "Second Admin", farm_name: "", email: "other@example.test", role: "admin" };

// A complaint created by Farmer B (user_id = 2).
const COMPLAINT_10 = {
  id: 10,
  user_id: 2,
  subject: "Crop failure",
  category: "Crop issue",
  description: "Wheat is failing.",
  location: "Field 3",
  status: "submitted",
  solution: null,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  farmerName: "Farmer B",
  farmerEmail: "b@farm.test",
};

// ─── DB mock ──────────────────────────────────────────────────────────────────
// The execute mock returns [rows, fields] matching mysql2's real return shape.
// community.js does:  const [rows] = await getPool().execute(sql, values)

function setupExecuteMock() {
  executeMock.mockImplementation((sql, values = []) => {
    const v = Array.isArray(values) ? values : [];

    // 1. Session authentication: community_sessions JOIN community_users WHERE jti = ?
    if (sql.includes("community_sessions") && sql.includes("jti")) {
      const token = v[0];
      if (token === FARMER_A_TOKEN) return [[FARMER_A], []];
      if (token === FARMER_B_TOKEN) return [[FARMER_B], []];
      if (token === ADMIN_TOKEN) return [[ADMIN_USER], []];
      if (token === WRONG_ADMIN_TOKEN) return [[WRONG_ADMIN_USER], []];
      return [[], []]; // unknown token → unauthenticated
    }

    // 2. Admin: GET all complaints (JOIN, no WHERE c.id)
    if (
      sql.includes("FROM community_complaints c JOIN community_users u") &&
      !sql.includes("WHERE c.id")
    ) {
      return [[COMPLAINT_10], []];
    }

    // 3. Admin: GET single complaint (JOIN with WHERE c.id = ?)
    if (
      sql.includes("FROM community_complaints c JOIN community_users u") &&
      sql.includes("WHERE c.id")
    ) {
      const id = Number(v[0]);
      return [id === 10 ? [COMPLAINT_10] : [], []];
    }

    // 4. Farmer: GET own complaint (WHERE id = ? AND user_id = ?)
    if (sql.includes("WHERE id = ? AND user_id = ?")) {
      const [id, userId] = v;
      const match = Number(id) === 10 && Number(userId) === FARMER_B.id;
      return [match ? [COMPLAINT_10] : [], []];
    }

    // 5. Admin: existence check before DELETE
    if (
      sql.includes("community_complaints") &&
      sql.includes("WHERE id = ? LIMIT 1")
    ) {
      const id = Number(v[0]);
      return [id === 10 ? [{ id: 10 }] : [], []];
    }

    // 6. Signup – duplicate email check
    if (sql.includes("community_users WHERE email")) {
      return [[], []]; // no duplicate
    }

    // 7. Signup – INSERT user (role is NOT taken from request body)
    if (sql.includes("INSERT INTO community_users")) {
      return [{ insertId: 99 }, []];
    }

    // 8. Signup – SELECT newly inserted user
    if (sql.includes("FROM community_users WHERE id")) {
      return [
        [{ id: 99, name: "New Farmer", farm_name: "", email: "new@farm.test", role: "farmer" }],
        [],
      ];
    }

    // 9. Signup / login – INSERT session token
    if (sql.includes("INSERT INTO community_sessions")) {
      return [{ insertId: 1 }, []];
    }

    // 10. Admin – UPDATE complaint
    if (sql.includes("UPDATE community_complaints")) {
      return [{ affectedRows: 1 }, []];
    }

    // 11. Admin – DELETE complaint
    if (sql.includes("DELETE FROM community_complaints")) {
      return [{ affectedRows: 1 }, []];
    }

    return [[], []];
  });
}

// ─── Server lifecycle ─────────────────────────────────────────────────────────

let server;
let port;

beforeAll(async () => {
  // Set env vars before the first request so getPool() receives DATABASE_URL.
  process.env.DATABASE_URL = "mock://localhost/krishak_test";
  process.env.ADMIN_SETUP_SECRET = "test-secret-8ch";

  const app = express();
  app.use(express.json());
  registerCommunityRoutes(app);

  server = createServer(app);
  await new Promise((resolve) => server.listen(0, resolve));
  port = server.address().port;
});

afterAll(async () => {
  await new Promise((resolve) => server.close(resolve));
  delete process.env.DATABASE_URL;
  delete process.env.ADMIN_SETUP_SECRET;
});

beforeEach(() => {
  executeMock.mockClear();
  setupExecuteMock();
});

// ─── HTTP helper ──────────────────────────────────────────────────────────────

async function req(method, urlPath, { token, body } = {}) {
  const headers = { "Content-Type": "application/json" };
  if (token) headers["Authorization"] = `Bearer ${token}`;
  const resp = await fetch(`http://localhost:${port}/api/community${urlPath}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const json = await resp.json().catch(() => ({}));
  return { status: resp.status, body: json };
}

// ─── 1. Unauthenticated → 401 ────────────────────────────────────────────────

describe("Unauthenticated access returns 401", () => {
  it("GET /complaints/mine (farmer own list)", async () => {
    const { status } = await req("GET", "/complaints/mine");
    expect(status).toBe(401);
  });

  it("GET /complaints (admin list)", async () => {
    const { status } = await req("GET", "/complaints");
    expect(status).toBe(401);
  });

  it("GET /complaints/:id", async () => {
    const { status } = await req("GET", "/complaints/10");
    expect(status).toBe(401);
  });

  it("PATCH /complaints/:id", async () => {
    const { status } = await req("PATCH", "/complaints/10", {
      body: { status: "resolved" },
    });
    expect(status).toBe(401);
  });

  it("DELETE /complaints/:id", async () => {
    const { status } = await req("DELETE", "/complaints/10");
    expect(status).toBe(401);
  });
});

// ─── 2. Farmer cannot access admin-only endpoints → 403 ──────────────────────

describe("Farmer blocked from admin endpoints (403)", () => {
  it("GET /complaints (admin-only list) returns 403", async () => {
    const { status, body } = await req("GET", "/complaints", {
      token: FARMER_A_TOKEN,
    });
    expect(status).toBe(403);
    expect(typeof body.message).toBe("string");
  });

  it("PATCH /complaints/:id returns 403 for farmer", async () => {
    const { status } = await req("PATCH", "/complaints/10", {
      token: FARMER_A_TOKEN,
      body: { status: "resolved" },
    });
    expect(status).toBe(403);
  });

  it("DELETE /complaints/:id returns 403 for farmer", async () => {
    const { status } = await req("DELETE", "/complaints/10", {
      token: FARMER_A_TOKEN,
    });
    expect(status).toBe(403);
  });
});

// ─── 3. Farmer IDOR — Farmer A cannot access Farmer B’s complaint → 403 ───────

describe("IDOR prevention — farmer cannot access another farmer's data", () => {
  it("Farmer A cannot read Farmer B's complaint", async () => {
    // COMPLAINT_10 is owned by FARMER_B (user_id=2). FARMER_A has id=1.
    const { status } = await req("GET", "/complaints/10", {
      token: FARMER_A_TOKEN,
    });
    // Backend uses session user.id for the ownership WHERE clause.
    expect(status).toBe(403);
  });

  it("Farmer B can read their own complaint", async () => {
    const { status } = await req("GET", "/complaints/10", {
      token: FARMER_B_TOKEN,
    });
    expect(status).toBe(200);
  });
});

// ─── 4. Admin access is allowed → 200 ─────────────────────────────────────────

describe("Admin access is allowed", () => {
  it("accepts an Admin role returned from the authenticated database record regardless of email", async () => {
    const { status } = await req("GET", "/complaints", { token: WRONG_ADMIN_TOKEN });
    expect(status).toBe(200);
  });
  it("Admin can list all complaints (200)", async () => {
    const { status, body } = await req("GET", "/complaints", {
      token: ADMIN_TOKEN,
    });
    expect(status).toBe(200);
    expect(Array.isArray(body.complaints)).toBe(true);
  });

  it("Admin can read any complaint (200)", async () => {
    const { status } = await req("GET", "/complaints/10", {
      token: ADMIN_TOKEN,
    });
    expect(status).toBe(200);
  });

  it("Admin can delete a complaint (200)", async () => {
    const { status } = await req("DELETE", "/complaints/10", {
      token: ADMIN_TOKEN,
    });
    expect(status).toBe(200);
  });
});

// ─── 5. Role spoofing via signup body is ignored → role remains ‘farmer’ ────────

describe("Role spoofing prevention", () => {
  it("rejects Admin signup when the server-issued code is missing", async () => {
    const { status } = await req("POST", "/auth/signup", {
      body: { name: "Attacker", email: "attacker@test.com", password: "SecureAdmin!2026", role: "admin" },
    });
    expect(status).toBe(403);
  });

  it("allows the former fixed address to be used as an ordinary Farmer email", async () => {
    const { status } = await req("POST", "/auth/signup", {
      body: { name: "Farmer", email: "ADMIN@gmail.com", password: "password123", role: "farmer" },
    });
    expect(status).toBe(201);
  });
});

// ─── 6. Admin creation — timingSafeEqual security (endpoint level) ─────────────
// These tests exercise the ACTUAL timingSafeEqual code path, unlike the unit
// test in community.test.js which uses a locally-defined adminCreateGuard helper.

describe("Admin creation endpoint — secret validation (real timingSafeEqual path)", () => {
  it("rejects a wrong secret (403)", async () => {
    const { status } = await req("POST", "/auth/admin-bootstrap", {
      body: {
        name: "A",
        email: "a@x.com",
        password: "password123",
        setupSecret: "wrong-secret-xx", // same length, wrong content
      },
    });
    expect(status).toBe(403);
  });

  it("rejects a longer secret that starts with the correct secret (prefix attack) (403)", async () => {
    const { status } = await req("POST", "/auth/admin-bootstrap", {
      body: {
        name: "A",
        email: "a@x.com",
        password: "password123",
        setupSecret: "test-secret-8chEXTRA", // correct prefix + extra bytes
      },
    });
    expect(status).toBe(403);
  });

  it("rejects a shorter prefix of the correct secret (403)", async () => {
    const { status } = await req("POST", "/auth/admin-bootstrap", {
      body: {
        name: "A",
        email: "a@x.com",
        password: "password123",
        setupSecret: "test-secre", // correct first N bytes, truncated
      },
    });
    expect(status).toBe(403);
  });

  it("rejects an empty secret (403)", async () => {
    const { status } = await req("POST", "/auth/admin-bootstrap", {
      body: {
        name: "A",
        email: "a@x.com",
        password: "password123",
        setupSecret: "",
      },
    });
    expect(status).toBe(403);
  });

  it("returns 503 when ADMIN_SETUP_SECRET is not set in env", async () => {
    const saved = process.env.ADMIN_SETUP_SECRET;
    delete process.env.ADMIN_SETUP_SECRET;
    try {
      const { status } = await req("POST", "/auth/admin-bootstrap", {
        body: {
          name: "A",
          email: "a@x.com",
          password: "password123",
          setupSecret: "anything",
        },
      });
      expect(status).toBe(503);
    } finally {
      process.env.ADMIN_SETUP_SECRET = saved;
    }
  });
});
