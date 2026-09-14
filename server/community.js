import crypto from "node:crypto";
import { promisify } from "node:util";
import mysql from "mysql2/promise";
import { Router } from "express";

const scryptAsync = promisify(crypto.scrypt);
const SESSION_DAYS = 7;
const COMMENT_MAX_LENGTH = 2000;
const SOLUTION_MAX_LENGTH = 5000;
const DISCUSSION_DEFAULT_LIMIT = 20;
const DISCUSSION_MAX_LIMIT = 50;
let pool;

export function isAdmin(user) {
  return user?.role === "admin";
}

function secretsMatch(expected, supplied) {
  if (!expected || typeof supplied !== "string") return false;
  const expectedBuffer = Buffer.from(expected);
  const suppliedBuffer = Buffer.from(supplied);
  const comparisonLength = Math.max(expectedBuffer.length, suppliedBuffer.length);
  const paddedExpected = Buffer.alloc(comparisonLength);
  const paddedSupplied = Buffer.alloc(comparisonLength);
  expectedBuffer.copy(paddedExpected);
  suppliedBuffer.copy(paddedSupplied);
  return expectedBuffer.length === suppliedBuffer.length && crypto.timingSafeEqual(paddedExpected, paddedSupplied);
}

function getPool() {
  if (!pool) {
    const databaseUrl = process.env.DATABASE_URL;
    if (!databaseUrl) throw new Error("DATABASE_URL is not configured.");
    pool = mysql.createPool(databaseUrl);
  }
  return pool;
}

async function query(sql, values = []) {
  const [rows] = await getPool().execute(sql, values);
  return rows;
}

function clean(value, maxLength) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

function publicUser(user) {
  return { id: user.id, name: user.name, farmName: user.farm_name, email: user.email, role: user.role };
}

export async function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString("hex");
  const derived = await scryptAsync(password, salt, 64, { N: 16384, r: 8, p: 1 });
  return `scrypt$${salt}$${Buffer.from(derived).toString("hex")}`;
}

export async function verifyPassword(password, stored) {
  const [algorithm, salt, expectedHex] = String(stored).split("$");
  if (algorithm !== "scrypt" || !salt || !expectedHex) return false;
  const actual = Buffer.from(await scryptAsync(password, salt, 64, { N: 16384, r: 8, p: 1 }));
  const expected = Buffer.from(expectedHex, "hex");
  return actual.length === expected.length && crypto.timingSafeEqual(actual, expected);
}

function createToken() {
  return crypto.randomUUID();
}

function authError(res, message = "Authentication is required.") {
  return res.status(401).json({ message });
}

async function createSession(userId) {
  const token = createToken();
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000);
  await query("INSERT INTO community_sessions (user_id, jti, expires_at) VALUES (?, ?, ?)", [userId, token, expiresAt]);
  return { token, expiresAt };
}

export async function authenticateCommunityToken(token) {
  if (typeof token !== "string" || !token.trim()) return null;
  if (!token) return null;
  const rows = await query(
    `SELECT u.id, u.name, u.farm_name, u.email, u.role
     FROM community_sessions s
     JOIN community_users u ON u.id = s.user_id
     WHERE s.jti = ? AND s.revoked_at IS NULL AND s.expires_at > UTC_TIMESTAMP()`,
    [token]
  );
  return rows[0] || null;
}

async function authenticate(req) {
  const header = req.get("authorization") || "";
  if (!header.startsWith("Bearer ")) return null;
  return authenticateCommunityToken(header.slice(7).trim());
}

export async function communityDiscussionExists(discussionId) {
  const id = Number(discussionId);
  if (!Number.isSafeInteger(id) || id < 1) return false;
  const rows = await query("SELECT id FROM community_discussions WHERE id = ? LIMIT 1", [id]);
  return Boolean(rows[0]);
}

function requireFields(body, fields) {
  return fields.every((field) => typeof body?.[field] === "string" && body[field].trim());
}

function boundedPositiveInteger(value, fallback, max) {
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 1) return fallback;
  return Math.min(parsed, max);
}

function safeComplaintId(raw) {
  const id = Number(raw);
  return Number.isSafeInteger(id) && id >= 1 ? id : null;
}

export function registerCommunityRoutes(app) {
  const router = Router();

  // ─── FARMER / ADMIN AUTHENTICATION ────────────────────────────────────────

  router.post("/auth/signup", async (req, res) => {
    const name = clean(req.body?.name, 120);
    const farmName = clean(req.body?.farmName, 160);
    const email = clean(req.body?.email, 255).toLowerCase();
    const password = typeof req.body?.password === "string" ? req.body.password : "";
    const requestedRole = req.body?.role === "admin" ? "admin" : "farmer";
    const minimumPasswordLength = requestedRole === "admin" ? 12 : 8;
    if (!name || !email || !password || password.length < minimumPasswordLength) {
      return res.status(400).json({ message: `Name, email, and a password of at least ${minimumPasswordLength} characters are required.` });
    }
    if (requestedRole === "admin") {
      if (!process.env.ADMIN_SETUP_SECRET) return res.status(503).json({ message: "Admin signup is not enabled on the server." });
      if (!secretsMatch(process.env.ADMIN_SETUP_SECRET, req.body?.adminSetupSecret)) return res.status(403).json({ message: "A valid Admin signup code is required." });
    }
    try {
      const existing = await query("SELECT id FROM community_users WHERE email = ? LIMIT 1", [email]);
      if (existing.length) return res.status(409).json({ message: "An account with this email already exists." });
      const passwordHash = await hashPassword(password);
      const result = await query("INSERT INTO community_users (name, farm_name, email, password_hash, role) VALUES (?, ?, ?, ?, ?)", [name, farmName, email, passwordHash, requestedRole]);
      const userRows = await query("SELECT id, name, farm_name, email, role FROM community_users WHERE id = ?", [result.insertId]);
      const session = await createSession(result.insertId);
      return res.status(201).json({ token: session.token, user: publicUser(userRows[0]) });
    } catch (error) {
      if (error?.code === "ER_DUP_ENTRY") return res.status(409).json({ message: "An account with this email already exists." });
      console.error("[Community] Signup failed", error);
      return res.status(500).json({ message: "The Community database could not create this account." });
    }
  });

  router.post("/auth/login", async (req, res) => {
    const email = clean(req.body?.email, 255).toLowerCase();
    const password = typeof req.body?.password === "string" ? req.body.password : "";
    if (!email || !password) return res.status(400).json({ message: "Email and password are required." });
    try {
      const rows = await query("SELECT id, name, farm_name, email, role, password_hash FROM community_users WHERE email = ? LIMIT 1", [email]);
      const user = rows[0];
      if (!user || !(await verifyPassword(password, user.password_hash))) return res.status(401).json({ message: "Invalid email or password." });
      const session = await createSession(user.id);
      return res.json({ token: session.token, user: publicUser(user) });
    } catch (error) {
      console.error("[Community] Login failed", error);
      return res.status(500).json({ message: "The Community database could not complete login." });
    }
  });

  router.post("/auth/logout", async (req, res) => {
    const header = req.get("authorization") || "";
    const token = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
    if (token) await query("UPDATE community_sessions SET revoked_at = UTC_TIMESTAMP() WHERE jti = ? AND revoked_at IS NULL", [token]);
    return res.json({ success: true });
  });

  router.get("/users/me", async (req, res) => {
    try {
      const user = await authenticate(req);
      if (!user) return authError(res, "Your Community session is missing, invalid, or expired.");
      return res.json({ user: publicUser(user) });
    } catch (error) {
      console.error("[Community] Current user failed", error);
      return res.status(500).json({ message: "The Community database could not validate the session." });
    }
  });

  // ─── CONTROLLED ADMIN CREATION ───────────────────────────────────────────
  // Backward-compatible server bootstrap. The email is caller-supplied and
  // the server-side setup secret controls whether the Admin role is granted.
  router.post("/auth/admin-bootstrap", async (req, res) => {
    const setupSecret = process.env.ADMIN_SETUP_SECRET;
    if (!setupSecret) return res.status(503).json({ message: "Admin bootstrap is not enabled." });
    if (!secretsMatch(setupSecret, req.body?.setupSecret)) return res.status(403).json({ message: "Invalid setup secret." });
    const name = clean(req.body?.name, 120) || "Administrator";
    const email = clean(req.body?.email, 255).toLowerCase();
    const password = typeof req.body?.password === "string" ? req.body.password : "";
    if (!email) return res.status(400).json({ message: "Admin email is required." });
    if (password.length < 12) return res.status(400).json({ message: "Admin password must be at least 12 characters." });
    try {
      const existing = await query("SELECT id FROM community_users WHERE email = ? LIMIT 1", [email]);
      if (existing.length) return res.status(409).json({ message: "An account with this email already exists." });
      const passwordHash = await hashPassword(password);
      const result = await query("INSERT INTO community_users (name, farm_name, email, password_hash, role) VALUES (?, '', ?, ?, 'admin')", [name, email, passwordHash]);
      const userRows = await query("SELECT id, name, farm_name, email, role FROM community_users WHERE id = ?", [result.insertId]);
      const session = await createSession(result.insertId);
      return res.status(201).json({ token: session.token, user: publicUser(userRows[0]) });
    } catch (error) {
      if (error?.code === "ER_DUP_ENTRY") return res.status(409).json({ message: "An account with this email already exists." });
      console.error("[Community] Admin bootstrap failed", error);
      return res.status(500).json({ message: "The Community database could not create the administrator account." });
    }
  });

  // Legacy alias kept for backward compatibility — same hardened logic above.
  // router.post("/admin/create", ...) intentionally removed; use /auth/admin-bootstrap.



  // ─── DISCUSSIONS ─────────────────────────────────────────────────────────

  router.get("/discussions", async (req, res) => {
    try {
      const page = boundedPositiveInteger(req.query.page, 1, Number.MAX_SAFE_INTEGER);
      const limit = boundedPositiveInteger(req.query.limit, DISCUSSION_DEFAULT_LIMIT, DISCUSSION_MAX_LIMIT);
      const offset = (page - 1) * limit;
      const totalRows = await query("SELECT COUNT(*) AS total FROM community_discussions");
      const total = Number(totalRows[0]?.total || 0);
      const discussions = await query(
        `SELECT d.id, d.title, d.description, d.problem_type AS problemType, d.created_at AS createdAt, u.name AS authorName
         FROM community_discussions d JOIN community_users u ON u.id = d.user_id
         ORDER BY d.created_at DESC, d.id DESC LIMIT ${limit} OFFSET ${offset}`
      );
      return res.json({ discussions, page, limit, total, hasNext: offset + discussions.length < total });
    } catch (error) {
      console.error("[Community] Discussion list failed", error);
      return res.status(500).json({ message: "The Community database could not load discussions." });
    }
  });

  router.get("/discussions/:id", async (req, res) => {
    try {
      const rows = await query(`SELECT d.id, d.title, d.description, d.problem_type AS problemType, d.created_at AS createdAt, u.name AS authorName FROM community_discussions d JOIN community_users u ON u.id = d.user_id WHERE d.id = ? LIMIT 1`, [Number(req.params.id)]);
      if (!rows[0]) return res.status(404).json({ message: "Discussion not found." });
      return res.json({ discussion: rows[0] });
    } catch (error) {
      console.error("[Community] Discussion detail failed", error);
      return res.status(500).json({ message: "The Community database could not load this discussion." });
    }
  });

  router.post("/discussions", async (req, res) => {
    try {
      const user = await authenticate(req);
      if (!user) return authError(res);
      const title = clean(req.body?.title, 200);
      const description = clean(req.body?.description || req.body?.detailedDescription, 10000);
      const problemType = clean(req.body?.problemType, 100);
      if (!title || !description || !problemType) return res.status(400).json({ message: "Title, problem type, and description are required." });
      const result = await query("INSERT INTO community_discussions (user_id, title, description, problem_type) VALUES (?, ?, ?, ?)", [user.id, title, description, problemType]);
      const rows = await query("SELECT id, title, description, problem_type AS problemType, created_at AS createdAt FROM community_discussions WHERE id = ?", [result.insertId]);
      return res.status(201).json({ discussion: rows[0] });
    } catch (error) {
      console.error("[Community] Discussion creation failed", error);
      return res.status(500).json({ message: "The Community database could not create this discussion." });
    }
  });

  router.get("/discussions/:id/comments", async (req, res) => {
    try {
      const discussionId = Number(req.params.id);
      if (!Number.isSafeInteger(discussionId) || discussionId < 1) return res.status(404).json({ message: "Discussion not found." });
      const discussion = await query("SELECT id FROM community_discussions WHERE id = ? LIMIT 1", [discussionId]);
      if (!discussion[0]) return res.status(404).json({ message: "Discussion not found." });
      const comments = await query(
        `SELECT c.id, c.discussion_id AS discussionId, c.parent_comment_id AS parentCommentId, c.text, c.deleted_at AS deletedAt, c.created_at AS createdAt, c.updated_at AS updatedAt,
                u.id AS authorId, u.name AS authorName
         FROM community_comments c
         JOIN community_users u ON u.id = c.user_id
         WHERE c.discussion_id = ?
         ORDER BY c.created_at ASC, c.id ASC`,
        [discussionId]
      );
      return res.json({ comments });
    } catch (error) {
      console.error("[Community] Comment list failed", error);
      return res.status(500).json({ message: "The Community database could not load comments." });
    }
  });

  router.post("/discussions/:id/comments", async (req, res) => {
    try {
      const user = await authenticate(req);
      if (!user) return authError(res);
      const discussionId = Number(req.params.id);
      if (!Number.isSafeInteger(discussionId) || discussionId < 1) return res.status(404).json({ message: "Discussion not found." });
      const rawText = typeof req.body?.text === "string" ? req.body.text.trim() : "";
      if (!rawText) return res.status(400).json({ message: "Comment text is required." });
      if (rawText.length > COMMENT_MAX_LENGTH) return res.status(400).json({ message: `Comment text must be ${COMMENT_MAX_LENGTH} characters or fewer.` });
      const discussion = await query("SELECT id FROM community_discussions WHERE id = ? LIMIT 1", [discussionId]);
      if (!discussion[0]) return res.status(404).json({ message: "Discussion not found." });
      const hasParent = req.body?.parentCommentId !== undefined && req.body?.parentCommentId !== null && req.body?.parentCommentId !== "";
      let parentCommentId = null;
      if (hasParent) {
        parentCommentId = Number(req.body.parentCommentId);
        if (!Number.isSafeInteger(parentCommentId) || parentCommentId < 1) return res.status(400).json({ message: "A valid parent comment is required for a reply." });
        const parents = await query(
          "SELECT id, discussion_id AS discussionId, parent_comment_id AS parentCommentId, deleted_at AS deletedAt FROM community_comments WHERE id = ? LIMIT 1",
          [parentCommentId]
        );
        const parent = parents[0];
        if (!parent) return res.status(400).json({ message: "Parent comment not found." });
        if (Number(parent.discussionId) !== discussionId) return res.status(400).json({ message: "Reply parent must belong to this discussion." });
        if (parent.parentCommentId !== null && parent.parentCommentId !== undefined) return res.status(400).json({ message: "Replies can only be added to a top-level comment." });
        if (parent.deletedAt) return res.status(400).json({ message: "Replies cannot be added to a deleted comment." });
      }
      const result = await query("INSERT INTO community_comments (discussion_id, user_id, parent_comment_id, text) VALUES (?, ?, ?, ?)", [discussionId, user.id, parentCommentId, rawText]);
      const rows = await query(
        `SELECT c.id, c.discussion_id AS discussionId, c.parent_comment_id AS parentCommentId, c.text, c.deleted_at AS deletedAt, c.created_at AS createdAt, c.updated_at AS updatedAt,
                u.id AS authorId, u.name AS authorName
         FROM community_comments c
         JOIN community_users u ON u.id = c.user_id
         WHERE c.id = ? LIMIT 1`,
        [result.insertId]
      );
      return res.status(201).json({ comment: rows[0] });
    } catch (error) {
      console.error("[Community] Comment creation failed", error);
      return res.status(500).json({ message: "The Community database could not create this comment." });
    }
  });

  router.patch("/comments/:commentId", async (req, res) => {
    try {
      const user = await authenticate(req);
      if (!user) return authError(res);
      const commentId = Number(req.params.commentId);
      if (!Number.isSafeInteger(commentId) || commentId < 1) return res.status(404).json({ message: "Comment not found." });
      const rawText = typeof req.body?.text === "string" ? req.body.text.trim() : "";
      if (!rawText) return res.status(400).json({ message: "Comment text is required." });
      if (rawText.length > COMMENT_MAX_LENGTH) return res.status(400).json({ message: `Comment text must be ${COMMENT_MAX_LENGTH} characters or fewer.` });
      const existing = await query("SELECT id, user_id AS userId, deleted_at AS deletedAt FROM community_comments WHERE id = ? LIMIT 1", [commentId]);
      if (!existing[0]) return res.status(404).json({ message: "Comment not found." });
      if (existing[0].deletedAt) return res.status(404).json({ message: "Comment not found." });
      if (Number(existing[0].userId) !== Number(user.id)) return res.status(403).json({ message: "You can only edit your own comments." });
      await query("UPDATE community_comments SET text = ?, updated_at = UTC_TIMESTAMP() WHERE id = ?", [rawText, commentId]);
      const rows = await query(
        `SELECT c.id, c.discussion_id AS discussionId, c.parent_comment_id AS parentCommentId, c.text, c.deleted_at AS deletedAt, c.created_at AS createdAt, c.updated_at AS updatedAt,
                u.id AS authorId, u.name AS authorName
         FROM community_comments c
         JOIN community_users u ON u.id = c.user_id
         WHERE c.id = ? LIMIT 1`,
        [commentId]
      );
      return res.json({ comment: rows[0] });
    } catch (error) {
      console.error("[Community] Comment update failed", error);
      return res.status(500).json({ message: "The Community database could not update this comment." });
    }
  });

  router.delete("/comments/:commentId", async (req, res) => {
    try {
      const user = await authenticate(req);
      if (!user) return authError(res);
      const commentId = Number(req.params.commentId);
      if (!Number.isSafeInteger(commentId) || commentId < 1) return res.status(404).json({ message: "Comment not found." });
      const existing = await query("SELECT id, user_id AS userId, deleted_at AS deletedAt FROM community_comments WHERE id = ? LIMIT 1", [commentId]);
      if (!existing[0]) return res.status(404).json({ message: "Comment not found." });
      if (existing[0].deletedAt) return res.status(404).json({ message: "Comment not found." });
      if (Number(existing[0].userId) !== Number(user.id)) return res.status(403).json({ message: "You can only delete your own comments." });
      const children = await query("SELECT id FROM community_comments WHERE parent_comment_id = ? LIMIT 1", [commentId]);
      if (children[0]) {
        await query("UPDATE community_comments SET text = ?, deleted_at = UTC_TIMESTAMP(), updated_at = UTC_TIMESTAMP() WHERE id = ?", ["[Deleted comment]", commentId]);
        return res.json({ success: true, deletedCommentId: commentId, preservedReplies: true });
      }
      await query("DELETE FROM community_comments WHERE id = ?", [commentId]);
      return res.json({ success: true, deletedCommentId: commentId });
    } catch (error) {
      console.error("[Community] Comment deletion failed", error);
      return res.status(500).json({ message: "The Community database could not delete this comment." });
    }
  });

  // ─── COMPLAINTS ──────────────────────────────────────────────────────────

  // Farmer: create own complaint.
  router.post("/complaints", async (req, res) => {
    try {
      const user = await authenticate(req);
      if (!user) return authError(res);
      if (!requireFields(req.body, ["subject", "category", "description"])) return res.status(400).json({ message: "Subject, category, and description are required." });
      const subject = clean(req.body.subject, 200);
      const category = clean(req.body.category, 100);
      const description = clean(req.body.description, 10000);
      const location = clean(req.body.location, 200);
      const result = await query("INSERT INTO community_complaints (user_id, subject, category, description, location) VALUES (?, ?, ?, ?, ?)", [user.id, subject, category, description, location]);
      return res.status(201).json({ complaint: { id: result.insertId, subject, category, description, location, status: "submitted" } });
    } catch (error) {
      console.error("[Community] Complaint creation failed", error);
      return res.status(500).json({ message: "The Community database could not create this complaint." });
    }
  });

  // Farmer: list only own complaints.
  router.get("/complaints/mine", async (req, res) => {
    try {
      const user = await authenticate(req);
      if (!user) return authError(res);
      const complaints = await query(
        "SELECT id, subject, category, description, location, status, solution, created_at AS createdAt, updated_at AS updatedAt FROM community_complaints WHERE user_id = ? ORDER BY created_at DESC",
        [user.id]
      );
      return res.json({ complaints });
    } catch (error) {
      console.error("[Community] Complaint list failed", error);
      return res.status(500).json({ message: "The Community database could not load complaints." });
    }
  });


  // Admin: list registered farmers (excludes admin accounts).
  router.get("/admin/farmers", async (req, res) => {
    try {
      const user = await authenticate(req);
      if (!user) return authError(res);
      if (!isAdmin(user)) return res.status(403).json({ message: "Administrator access is required." });
      const farmers = await query(
        "SELECT u.id, u.name, u.email, u.farm_name AS farmName, u.role, u.created_at, " +
        "COUNT(c.id) AS complaintCount, " +
        "SUM(CASE WHEN c.status IN ('submitted','in_review') THEN 1 ELSE 0 END) AS pendingCount, " +
        "SUM(CASE WHEN c.status = 'resolved' THEN 1 ELSE 0 END) AS resolvedCount " +
        "FROM community_users u " +
        "LEFT JOIN community_complaints c ON c.user_id = u.id " +
        "WHERE u.role = 'farmer' " +
        "GROUP BY u.id ORDER BY u.created_at DESC"
      );
      return res.json({ farmers });
    } catch (error) {
      console.error("[Community] Admin farmer list failed", error);
      return res.status(500).json({ message: "Could not load farmer list." });
    }
  });

  // Admin: complaints for a specific farmer.
  router.get("/admin/farmers/:farmerId/complaints", async (req, res) => {
    try {
      const user = await authenticate(req);
      if (!user) return authError(res);
      if (!isAdmin(user)) return res.status(403).json({ message: "Administrator access is required." });
      const farmerId = safeComplaintId(req.params.farmerId);
      if (!farmerId) return res.status(404).json({ message: "Farmer not found." });
      const complaints = await query(
        "SELECT id, subject, category, description, location, status, solution, created_at AS createdAt FROM community_complaints WHERE user_id = ? ORDER BY created_at DESC",
        [farmerId]
      );
      return res.json({ complaints });
    } catch (error) {
      console.error("[Community] Admin farmer complaints failed", error);
      return res.status(500).json({ message: "Could not load farmer complaints." });
    }
  });

  // Admin: dashboard stats.
  router.get("/admin/stats", async (req, res) => {
    try {
      const user = await authenticate(req);
      if (!user) return authError(res);
      if (!isAdmin(user)) return res.status(403).json({ message: "Administrator access is required." });
      const [[farmerRow], [complaintRow]] = await Promise.all([
        query("SELECT COUNT(*) AS farmerCount FROM community_users WHERE role = 'farmer'"),
        query("SELECT COUNT(*) AS totalComplaints, SUM(CASE WHEN status IN ('submitted','in_review') THEN 1 ELSE 0 END) AS pending, SUM(CASE WHEN status = 'resolved' THEN 1 ELSE 0 END) AS resolved FROM community_complaints"),
      ]);
      return res.json({
        farmerCount: farmerRow?.farmerCount ?? 0,
        totalComplaints: complaintRow?.totalComplaints ?? 0,
        pending: complaintRow?.pending ?? 0,
        resolved: complaintRow?.resolved ?? 0,
      });
    } catch (error) {
      console.error("[Community] Admin stats failed", error);
      return res.status(500).json({ message: "Could not load admin stats." });
    }
  });
  // Admin: list ALL complaints. Farmer: denied.
  router.get("/complaints", async (req, res) => {
    try {
      const user = await authenticate(req);
      if (!user) return authError(res);
      if (!isAdmin(user)) return res.status(403).json({ message: "Administrator access is required." });
      const complaints = await query(
        "SELECT c.id, c.user_id AS userId, c.subject, c.category, c.description, c.location, c.status, c.solution, c.created_at AS createdAt, c.updated_at AS updatedAt, u.name AS farmerName, u.email AS farmerEmail FROM community_complaints c JOIN community_users u ON u.id = c.user_id ORDER BY c.created_at DESC"
      );
      return res.json({ complaints });
    } catch (error) {
      console.error("[Community] Admin complaint list failed", error);
      return res.status(500).json({ message: "The Community database could not load the complaint queue." });
    }
  });

  // Get single complaint: farmer sees own, admin sees any.
  router.get("/complaints/:id", async (req, res) => {
    try {
      const user = await authenticate(req);
      if (!user) return authError(res);
      const id = safeComplaintId(req.params.id);
      if (!id) return res.status(404).json({ message: "Complaint not found." });
      if (isAdmin(user)) {
        const rows = await query(
          "SELECT c.id, c.user_id AS userId, c.subject, c.category, c.description, c.location, c.status, c.solution, c.created_at AS createdAt, c.updated_at AS updatedAt, u.name AS farmerName, u.email AS farmerEmail FROM community_complaints c JOIN community_users u ON u.id = c.user_id WHERE c.id = ? LIMIT 1",
          [id]
        );
        if (!rows[0]) return res.status(404).json({ message: "Complaint not found." });
        return res.json({ complaint: rows[0] });
      }
      // Farmer: enforce ownership — never expose another farmer's complaint.
      const rows = await query(
        "SELECT id, subject, category, description, location, status, solution, created_at AS createdAt, updated_at AS updatedAt FROM community_complaints WHERE id = ? AND user_id = ? LIMIT 1",
        [id, user.id]
      );
      if (!rows[0]) return res.status(403).json({ message: "You are not authorised to view this complaint." });
      return res.json({ complaint: rows[0] });
    } catch (error) {
      console.error("[Community] Complaint detail failed", error);
      return res.status(500).json({ message: "The Community database could not load this complaint." });
    }
  });

  // Admin: update complaint status and/or solution.
  router.patch("/complaints/:id", async (req, res) => {
    try {
      const user = await authenticate(req);
      if (!user) return authError(res);
      if (!isAdmin(user)) return res.status(403).json({ message: "Administrator access is required." });
      const id = safeComplaintId(req.params.id);
      if (!id) return res.status(404).json({ message: "Complaint not found." });
      // Verify the complaint exists.
      const existing = await query("SELECT id FROM community_complaints WHERE id = ? LIMIT 1", [id]);
      if (!existing[0]) return res.status(404).json({ message: "Complaint not found." });

      const validStatuses = ["submitted", "in_review", "resolved"];
      const newStatus = typeof req.body?.status === "string" && validStatuses.includes(req.body.status)
        ? req.body.status
        : null;
      const hasSolution = typeof req.body?.solution === "string";
      const solution = hasSolution ? req.body.solution.trim().slice(0, SOLUTION_MAX_LENGTH) : null;

      if (!newStatus && !hasSolution) {
        return res.status(400).json({ message: "Provide a valid status or a solution to update." });
      }

      // Require a non-empty solution when resolving.
      if (newStatus === "resolved") {
        const solutionText = solution ?? (await query("SELECT solution FROM community_complaints WHERE id = ? LIMIT 1", [id]))[0]?.solution;
        if (!solutionText || !String(solutionText).trim()) {
          return res.status(400).json({ message: "A solution is required when marking a complaint as resolved." });
        }
      }

      if (newStatus && hasSolution) {
        await query("UPDATE community_complaints SET status = ?, solution = ?, updated_at = UTC_TIMESTAMP() WHERE id = ?", [newStatus, solution, id]);
      } else if (newStatus) {
        await query("UPDATE community_complaints SET status = ?, updated_at = UTC_TIMESTAMP() WHERE id = ?", [newStatus, id]);
      } else {
        await query("UPDATE community_complaints SET solution = ?, updated_at = UTC_TIMESTAMP() WHERE id = ?", [solution, id]);
      }

      const rows = await query(
        "SELECT c.id, c.user_id AS userId, c.subject, c.category, c.description, c.location, c.status, c.solution, c.created_at AS createdAt, c.updated_at AS updatedAt, u.name AS farmerName, u.email AS farmerEmail FROM community_complaints c JOIN community_users u ON u.id = c.user_id WHERE c.id = ? LIMIT 1",
        [id]
      );
      return res.json({ success: true, complaint: rows[0] });
    } catch (error) {
      console.error("[Community] Complaint update failed", error);
      return res.status(500).json({ message: "The Community database could not update this complaint." });
    }
  });

  // Admin: delete complaint.
  router.delete("/complaints/:id", async (req, res) => {
    try {
      const user = await authenticate(req);
      if (!user) return authError(res);
      if (!isAdmin(user)) return res.status(403).json({ message: "Administrator access is required." });
      const id = safeComplaintId(req.params.id);
      if (!id) return res.status(404).json({ message: "Complaint not found." });
      const existing = await query("SELECT id FROM community_complaints WHERE id = ? LIMIT 1", [id]);
      if (!existing[0]) return res.status(404).json({ message: "Complaint not found." });
      await query("DELETE FROM community_complaints WHERE id = ?", [id]);
      return res.json({ success: true });
    } catch (error) {
      console.error("[Community] Complaint deletion failed", error);
      return res.status(500).json({ message: "The Community database could not delete this complaint." });
    }
  });

  app.use("/api/community", router);
}
