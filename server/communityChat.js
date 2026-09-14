import { Server } from "socket.io";
import { authenticateCommunityToken, communityDiscussionExists } from "./community.js";

export const CHAT_MESSAGE_MAX_LENGTH = 1000;
export const CHAT_HISTORY_LIMIT = 50;

export function getDiscussionRoomName(discussionId) {
  const id = Number(discussionId);
  return Number.isSafeInteger(id) && id > 0 ? `discussion:${id}` : null;
}

export function normalizeChatMessage(value) {
  if (typeof value !== "string") return "";
  return value.trim().replace(/\s+/g, " ").slice(0, CHAT_MESSAGE_MAX_LENGTH + 1);
}

export function validateChatMessage(value) {
  const text = normalizeChatMessage(value);
  if (!text) return { ok: false, message: "Write a message before sending." };
  if (text.length > CHAT_MESSAGE_MAX_LENGTH) return { ok: false, message: `Messages must be ${CHAT_MESSAGE_MAX_LENGTH} characters or fewer.` };
  return { ok: true, text };
}

export function createSessionChatHistory(limit = CHAT_HISTORY_LIMIT) {
  const histories = new Map();
  return {
    list(room) {
      return [...(histories.get(room) || [])];
    },
    add(room, message) {
      const next = [...(histories.get(room) || []), message].slice(-limit);
      histories.set(room, next);
      return message;
    },
  };
}

export function createCommunityChatServer(httpServer, dependencies = {}) {
  const authenticateUser = dependencies.authenticateUser || authenticateCommunityToken;
  const discussionExists = dependencies.discussionExists || communityDiscussionExists;
  const io = new Server(httpServer, {
    path: "/api/community/socket.io",
    cors: { origin: true, credentials: false },
  });
  const history = createSessionChatHistory();

  io.use(async (socket, next) => {
    try {
      const user = await authenticateUser(socket.handshake.auth?.token);
      if (!user) return next(new Error("Community authentication is required."));
      socket.data.user = { id: Number(user.id), name: user.name || "Community member" };
      return next();
    } catch {
      return next(new Error("Community authentication is unavailable."));
    }
  });

  io.on("connection", (socket) => {
    socket.on("joinDiscussion", async (payload, acknowledge = () => {}) => {
      const room = getDiscussionRoomName(payload?.discussionId);
      if (!room || !(await discussionExists(payload.discussionId))) {
        acknowledge({ ok: false, message: "That discussion is unavailable." });
        return;
      }
      if (socket.data.room && socket.data.room !== room) socket.leave(socket.data.room);
      socket.join(room);
      socket.data.room = room;
      acknowledge({ ok: true, messages: history.list(room) });
    });

    socket.on("chat:message", (payload, acknowledge = () => {}) => {
      const room = getDiscussionRoomName(payload?.discussionId);
      if (!room || socket.data.room !== room) {
        acknowledge({ ok: false, message: "Join the selected discussion before sending a message." });
        return;
      }
      const validation = validateChatMessage(payload?.text);
      if (!validation.ok) {
        acknowledge(validation);
        return;
      }
      const message = {
        id: crypto.randomUUID(),
        discussionId: Number(payload.discussionId),
        text: validation.text,
        authorId: socket.data.user.id,
        authorName: socket.data.user.name,
        createdAt: new Date().toISOString(),
      };
      history.add(room, message);
      io.to(room).emit("chat:message", message);
      acknowledge({ ok: true, message });
    });
  });

  return io;
}
