import { afterEach, describe, expect, it, vi } from "vitest";
import { createDiscussionComment, deleteDiscussionComment, getDiscussions, updateDiscussionComment } from "../client/src/services/phase4Services.js";

describe("Community comment owner-action client requests", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("sends authenticated persisted update and delete requests to the exact comment endpoints", async () => {
    vi.stubEnv("VITE_COMMUNITY_API_URL", "https://community.example.test");
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ comment: { id: 17, text: "Updated field note." } }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ success: true, deletedCommentId: 17 }) });
    vi.stubGlobal("fetch", fetchMock);

    await expect(updateDiscussionComment(17, "Updated field note.", "owner-session-token")).resolves.toEqual({
      comment: { id: 17, text: "Updated field note." },
    });
    await expect(deleteDiscussionComment(17, "owner-session-token")).resolves.toEqual({ success: true, deletedCommentId: 17 });

    expect(fetchMock).toHaveBeenNthCalledWith(1, "https://community.example.test/comments/17", expect.objectContaining({
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer owner-session-token",
      },
      body: JSON.stringify({ text: "Updated field note." }),
    }));
    expect(fetchMock).toHaveBeenNthCalledWith(2, "https://community.example.test/comments/17", expect.objectContaining({
      method: "DELETE",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer owner-session-token",
      },
    }));
  });

  it("sends optional parent-comment and capped-feed request parameters without changing existing comment calls", async () => {
    vi.stubEnv("VITE_COMMUNITY_API_URL", "https://community.example.test");
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ comment: { id: 18, parentCommentId: 17, text: "A persisted reply." } }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ discussions: [], page: 2, limit: 20, total: 20, hasNext: false }) });
    vi.stubGlobal("fetch", fetchMock);

    await createDiscussionComment(4, "A persisted reply.", "owner-session-token", 17);
    await getDiscussions({ page: 2, limit: 20 });

    expect(fetchMock).toHaveBeenNthCalledWith(1, "https://community.example.test/discussions/4/comments", expect.objectContaining({
      method: "POST",
      body: JSON.stringify({ text: "A persisted reply.", parentCommentId: 17 }),
    }));
    expect(fetchMock).toHaveBeenNthCalledWith(2, "https://community.example.test/discussions?page=2&limit=20", expect.objectContaining({
      headers: { "Content-Type": "application/json" },
    }));
  });
});
