import { describe, expect, it } from "vitest";
import { bindDiscussionChatSocket } from "../client/src/services/phase4Services.js";

describe("discussion chat client lifecycle", () => {
  it("rejoins the same room after every Socket.IO connect event and restores history", () => {
    const handlers = new Map();
    const emissions = [];
    const socket = {
      on(event, callback) { handlers.set(event, callback); },
      emit(event, payload, acknowledge) {
        emissions.push({ event, payload });
        if (event === "joinDiscussion") acknowledge({ ok: true, messages: [{ id: `${emissions.length}`, text: "Recovered history" }] });
      },
    };
    const statuses = [];
    const histories = [];
    const senders = [];
    bindDiscussionChatSocket(socket, { roomId: 44, onMessage: () => {}, onHistory: (messages) => histories.push(messages), onStatus: (status) => statuses.push(status), onReady: (sender) => senders.push(sender) });
    handlers.get("connect")();
    handlers.get("disconnect")();
    handlers.get("connect")();
    expect(emissions).toEqual([{ event: "joinDiscussion", payload: { discussionId: 44 } }, { event: "joinDiscussion", payload: { discussionId: 44 } }]);
    expect(histories).toHaveLength(2);
    expect(senders).toHaveLength(2);
    expect(statuses).toEqual(expect.arrayContaining([{ state: "reconnecting", message: "Chat disconnected. Trying to reconnect…" }, { state: "connected", message: "Chat connected." }]));
  });
});
