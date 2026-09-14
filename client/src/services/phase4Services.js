import { io } from "socket.io-client";

// When VITE_COMMUNITY_API_URL is not set, the community backend is hosted on
// the same origin under /api/community (registered by the server in _core/index.ts).
// This fallback removes the "Community service is not configured yet" blocker
// in development and same-origin production deployments.
const apiBase = () => import.meta.env.VITE_COMMUNITY_API_URL || "/api/community";

async function request(path, options = {}) {
  const base = apiBase();
  const response = await fetch(`${base}${path}`, {
    ...options,
    headers: { "Content-Type": "application/json", ...(options.headers || {}) },
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.message || "The community service returned an error.");
  return payload;
}

// ─── Auth ────────────────────────────────────────────────────────────────────

export function signUp(payload) { return request("/auth/signup", { method: "POST", body: JSON.stringify(payload) }); }
export function logIn(payload) { return request("/auth/login", { method: "POST", body: JSON.stringify(payload) }); }
export function logOut(token) { return request("/auth/logout", { method: "POST", headers: { Authorization: `Bearer ${token}` } }); }
export function getProfile(token) { return request("/users/me", { headers: { Authorization: `Bearer ${token}` } }); }

// Controlled admin creation — requires ADMIN_SETUP_SECRET on the server.
// Never expose the secret in VITE_* variables or frontend code.
// createAdminAccount removed — use POST /api/community/auth/admin-bootstrap
// That endpoint requires ADMIN_SETUP_SECRET (server-side only) and is the only
// supported server bootstrap for an Admin account using a caller-provided email.

// ─── Discussions ─────────────────────────────────────────────────────────────

export function getDiscussions({ page, limit } = {}) {
  const params = new URLSearchParams();
  if (page !== undefined) params.set("page", String(page));
  if (limit !== undefined) params.set("limit", String(limit));
  const query = params.toString();
  return request(`/discussions${query ? `?${query}` : ""}`);
}
export function buildDiscussionPayload(form) {
  return { title: String(form?.title || "").trim(), description: String(form?.detailedDescription || "").trim(), problemType: String(form?.problemType || "").trim() };
}
export function createDiscussion(payload, token) { return request("/discussions", { method: "POST", headers: { Authorization: `Bearer ${token}` }, body: JSON.stringify(payload) }); }
export function getDiscussion(id) { return request(`/discussions/${encodeURIComponent(id)}`); }
export function getDiscussionComments(id) { return request(`/discussions/${encodeURIComponent(id)}/comments`); }
export function createDiscussionComment(id, text, token, parentCommentId = null) {
  const payload = parentCommentId === null || parentCommentId === undefined ? { text } : { text, parentCommentId };
  return request(`/discussions/${encodeURIComponent(id)}/comments`, { method: "POST", headers: { Authorization: `Bearer ${token}` }, body: JSON.stringify(payload) });
}
export function updateDiscussionComment(id, text, token) { return request(`/comments/${encodeURIComponent(id)}`, { method: "PATCH", headers: { Authorization: `Bearer ${token}` }, body: JSON.stringify({ text }) }); }
export function deleteDiscussionComment(id, token) { return request(`/comments/${encodeURIComponent(id)}`, { method: "DELETE", headers: { Authorization: `Bearer ${token}` } }); }

// ─── Complaints ───────────────────────────────────────────────────────────────

export function submitComplaint(payload, token) { return request("/complaints", { method: "POST", headers: { Authorization: `Bearer ${token}` }, body: JSON.stringify(payload) }); }
// Farmer: fetch only own complaints.
export function getMyComplaints(token) { return request("/complaints/mine", { headers: { Authorization: `Bearer ${token}` } }); }
// Admin: fetch all complaints.
export function getAdminComplaints(token) { return request("/complaints", { headers: { Authorization: `Bearer ${token}` } }); }
// Get a single complaint (farmer: own only; admin: any).
export function getComplaint(id, token) { return request(`/complaints/${encodeURIComponent(id)}`, { headers: { Authorization: `Bearer ${token}` } }); }
// Admin: update status and/or solution.
export function updateComplaint(id, payload, token) { return request(`/complaints/${encodeURIComponent(id)}`, { method: "PATCH", headers: { Authorization: `Bearer ${token}` }, body: JSON.stringify(payload) }); }
// Admin: delete a complaint.
export function deleteComplaint(id, token) { return request(`/complaints/${encodeURIComponent(id)}`, { method: "DELETE", headers: { Authorization: `Bearer ${token}` } }); }

// ─── Real-time Discussion Chat (Socket.IO) ────────────────────────────────────
// This is distinct from persisted forum comments/replies.
// Chat requires VITE_COMMUNITY_SOCKET_URL or falls back to same-origin socket.

export function bindDiscussionChatSocket(socket, { roomId, onMessage, onHistory, onStatus, onReady = () => {} }) {
  const emitMessage = (payload) => new Promise((resolve, reject) => {
    socket.emit("chat:message", payload, (ack) => {
      if (!ack?.ok) return reject(new Error(ack?.message || "Chat server rejected the message."));
      resolve(ack.message);
    });
  });
  const joinDiscussion = () => {
    socket.emit("joinDiscussion", { discussionId: roomId }, (ack) => {
      if (!ack?.ok) {
        onStatus({ state: "error", message: ack?.message || "Chat could not join this discussion." });
        return;
      }
      onHistory(ack.messages || []);
      onReady(emitMessage);
      onStatus({ state: "connected", message: "Chat connected." });
    });
  };
  socket.on("connect", joinDiscussion);
  socket.on("connect_error", () => onStatus({ state: "error", message: "Chat could not connect. Try again later." }));
  socket.on("disconnect", () => onStatus({ state: "reconnecting", message: "Chat disconnected. Trying to reconnect\u2026" }));
  socket.on("chat:message", onMessage);
  return { emitMessage, joinDiscussion };
}


// Admin: list registered farmers.
export function getAdminFarmers(token) {
  return request("/admin/farmers", { headers: { Authorization: `Bearer ${token}` } });
}

// Admin: complaints for a specific farmer.
export function getAdminFarmerComplaints(farmerId, token) {
  return request(`/admin/farmers/${encodeURIComponent(farmerId)}/complaints`, { headers: { Authorization: `Bearer ${token}` } });
}

// Admin: dashboard stats.
export function getAdminStats(token) {
  return request("/admin/stats", { headers: { Authorization: `Bearer ${token}` } });
}
export function openChatConnection({ token, roomId, onMessage, onHistory, onStatus, onReady = () => {} }) {
  if (!token) {
    onStatus({ state: "unavailable", message: "Login to join the discussion chat." });
    return () => {};
  }
  onStatus({ state: "connecting", message: "Connecting to the discussion chat\u2026" });
  // Use VITE_COMMUNITY_SOCKET_URL when set; otherwise use the same-origin socket path.
  const socketUrl = import.meta.env.VITE_COMMUNITY_SOCKET_URL || undefined;
  const socket = io(socketUrl, {
    path: "/api/community/socket.io",
    auth: { token },
    transports: ["websocket", "polling"],
    reconnection: true,
  });
  bindDiscussionChatSocket(socket, { roomId, onMessage, onHistory, onStatus, onReady });
  return () => socket.disconnect();
}
