import { createServer } from "node:http";
import { io as createClient } from "socket.io-client";
import { afterEach, describe, expect, it } from "vitest";
import { CHAT_HISTORY_LIMIT, createCommunityChatServer, createSessionChatHistory, getDiscussionRoomName, validateChatMessage } from "./communityChat.js";

const activeServers = [];

afterEach(async () => {
  await Promise.all(activeServers.splice(0).map(({ io, server }) => new Promise((resolve) => io.close(() => server.close(resolve)))));
});

async function createTestServer() {
  const server = createServer();
  const io = createCommunityChatServer(server, {
    authenticateUser: async (token) => token === "valid-one" ? { id: 1, name: "Sender" } : token === "valid-two" ? { id: 2, name: "Other room" } : token === "valid-three" ? { id: 3, name: "Same room" } : null,
    discussionExists: async (id) => [1, 2].includes(Number(id)),
  });
  await new Promise((resolve) => server.listen(0, resolve));
  activeServers.push({ io, server });
  return `http://localhost:${server.address().port}`;
}

function connect(url, token) {
  return new Promise((resolve, reject) => {
    const socket = createClient(url, { path: "/api/community/socket.io", auth: { token }, transports: ["websocket"], reconnection: false });
    socket.once("connect", () => resolve(socket));
    socket.once("connect_error", (error) => { socket.disconnect(); reject(error); });
  });
}

function join(socket, discussionId) {
  return new Promise((resolve) => socket.emit("joinDiscussion", { discussionId }, resolve));
}

describe("Community discussion chat contracts", () => {
  it("creates one non-user-controlled room name per valid discussion", () => {
    expect(getDiscussionRoomName(42)).toBe("discussion:42");
    expect(getDiscussionRoomName("7")).toBe("discussion:7");
    expect(getDiscussionRoomName("discussion:7")).toBeNull();
    expect(getDiscussionRoomName(0)).toBeNull();
  });

  it("validates and bounds chat text without allowing empty or overlong messages", () => {
    expect(validateChatMessage("  Farm update   after rain  ")).toEqual({ ok: true, text: "Farm update after rain" });
    expect(validateChatMessage("   ")).toEqual({ ok: false, message: "Write a message before sending." });
    expect(validateChatMessage("x".repeat(1001))).toEqual({ ok: false, message: "Messages must be 1000 characters or fewer." });
  });

  it("keeps bounded session-only history isolated by room", () => {
    const history = createSessionChatHistory(2);
    history.add("discussion:1", { id: "a" });
    history.add("discussion:2", { id: "b" });
    history.add("discussion:1", { id: "c" });
    history.add("discussion:1", { id: "d" });
    expect(history.list("discussion:1")).toEqual([{ id: "c" }, { id: "d" }]);
    expect(history.list("discussion:2")).toEqual([{ id: "b" }]);
    expect(CHAT_HISTORY_LIMIT).toBe(50);
  });

  it("rejects unauthenticated handshakes and invalid discussion joins", async () => {
    const url = await createTestServer();
    await expect(connect(url, "invalid")).rejects.toThrow("Community authentication is required.");
    const socket = await connect(url, "valid-one");
    try {
      await expect(join(socket, 999)).resolves.toMatchObject({ ok: false, message: "That discussion is unavailable." });
    } finally {
      socket.disconnect();
    }
  });

  it("delivers messages only to the selected discussion room", async () => {
    const url = await createTestServer();
    const [sender, otherRoom, sameRoom] = await Promise.all([connect(url, "valid-one"), connect(url, "valid-two"), connect(url, "valid-three")]);
    try {
      await Promise.all([join(sender, 1), join(otherRoom, 2), join(sameRoom, 1)]);
      let wrongRoomReceived = false;
      otherRoom.once("chat:message", () => { wrongRoomReceived = true; });
      const received = new Promise((resolve) => sameRoom.once("chat:message", resolve));
      const acknowledged = new Promise((resolve) => sender.emit("chat:message", { discussionId: 1, text: "Field update" }, resolve));
      await expect(acknowledged).resolves.toMatchObject({ ok: true, message: { discussionId: 1, text: "Field update", authorId: 1 } });
      await expect(received).resolves.toMatchObject({ discussionId: 1, text: "Field update", authorName: "Sender" });
      await new Promise((resolve) => setTimeout(resolve, 60));
      expect(wrongRoomReceived).toBe(false);
    } finally {
      sender.disconnect();
      otherRoom.disconnect();
      sameRoom.disconnect();
    }
  });

});
