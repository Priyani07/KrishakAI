import express from "express";
import { createServer } from "node:http";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({ execute: vi.fn(), createPool: vi.fn() }));

vi.mock("mysql2/promise", () => ({
  default: { createPool: db.createPool },
}));

const { registerCommunityRoutes } = await import("./community.js");

let server;
let baseUrl;
let comments;
let nextCommentId;

function commentRow(comment) {
  return {
    id: comment.id,
    discussionId: comment.discussionId,
    parentCommentId: comment.parentCommentId,
    text: comment.text,
    deletedAt: comment.deletedAt || null,
    createdAt: comment.createdAt,
    updatedAt: comment.updatedAt,
    authorId: comment.userId,
    authorName: comment.userId === 8 ? "Other Farmer" : "Verified Farmer",
  };
}

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
  await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
});

beforeEach(() => {
  comments = [];
  nextCommentId = 1;
  db.execute.mockReset();
  db.execute.mockImplementation(async (sql, values = []) => {
    if (sql.includes("FROM community_sessions")) {
      const isOtherUser = values[0] === "other-session";
      return [[isOtherUser
        ? { id: 8, name: "Other Farmer", farm_name: "Other Farm", email: "other@example.test", role: "farmer" }
        : { id: 7, name: "Verified Farmer", farm_name: "Verified Farm", email: "verified@example.test", role: "farmer" }]];
    }
    if (sql.startsWith("SELECT id FROM community_discussions")) {
      return [Number(values[0]) === 1 ? [{ id: 1 }] : []];
    }
    if (sql.startsWith("INSERT INTO community_comments")) {
      const [discussionId, userId, parentCommentId, text] = values;
      const timestamp = "2026-08-22T10:30:00.000Z";
      const record = { id: nextCommentId++, discussionId, userId, parentCommentId, text, createdAt: timestamp, updatedAt: timestamp, deletedAt: null };
      comments.push(record);
      return [{ insertId: record.id }];
    }
    if (sql.startsWith("SELECT id, discussion_id AS discussionId")) {
      return [comments.filter((comment) => comment.id === Number(values[0])).map((comment) => ({ id: comment.id, discussionId: comment.discussionId, parentCommentId: comment.parentCommentId, deletedAt: comment.deletedAt || null }))];
    }
    if (sql.startsWith("SELECT id, user_id AS userId, deleted_at AS deletedAt FROM community_comments")) {
      return [comments.filter((comment) => comment.id === Number(values[0])).map((comment) => ({ id: comment.id, userId: comment.userId, deletedAt: comment.deletedAt || null }))];
    }
    if (sql.startsWith("SELECT id FROM community_comments WHERE parent_comment_id")) {
      return [comments.filter((comment) => Number(comment.parentCommentId) === Number(values[0]) && !comment.deletedAt).map((comment) => ({ id: comment.id }))];
    }
    if (sql.startsWith("UPDATE community_comments SET text")) {
      const comment = comments.find((item) => item.id === Number(values[1]));
      if (comment) {
        comment.text = values[0];
        comment.updatedAt = "2026-08-22T10:35:00.000Z";
        if (sql.includes("deleted_at")) comment.deletedAt = comment.updatedAt;
      }
      return [{ affectedRows: comment ? 1 : 0 }];
    }
    if (sql.startsWith("DELETE FROM community_comments")) {
      const index = comments.findIndex((comment) => comment.id === Number(values[0]));
      if (index >= 0) comments.splice(index, 1);
      return [{ affectedRows: index >= 0 ? 1 : 0 }];
    }
    if (sql.includes("WHERE c.id = ?")) {
      return [comments.filter((comment) => comment.id === Number(values[0])).map(commentRow)];
    }
    if (sql.includes("WHERE c.discussion_id = ?")) {
      return [comments.filter((comment) => comment.discussionId === Number(values[0])).map(commentRow)];
    }
    throw new Error(`Unexpected query: ${sql}`);
  });
});

function postComment(id, body, authenticated = true, token = "verified-session") {
  return fetch(`${baseUrl}/discussions/${id}/comments`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(authenticated ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  });
}

function updateComment(id, body, authenticated = true, token = "verified-session") {
  return fetch(`${baseUrl}/comments/${id}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      ...(authenticated ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  });
}

function deleteComment(id, authenticated = true, token = "verified-session") {
  return fetch(`${baseUrl}/comments/${id}`, {
    method: "DELETE",
    headers: authenticated ? { Authorization: `Bearer ${token}` } : {},
  });
}

describe("Community comments API", () => {
  it("creates an authenticated persisted comment and returns it through the list endpoint after refresh", async () => {
    const created = await postComment(1, { text: "The irrigation schedule worked well for our field." });
    expect(created.status).toBe(201);
    await expect(created.json()).resolves.toEqual({
      comment: expect.objectContaining({
        id: 1,
        authorId: 7,
        authorName: "Verified Farmer",
        text: "The irrigation schedule worked well for our field.",
      }),
    });

    const refreshed = await fetch(`${baseUrl}/discussions/1/comments`);
    expect(refreshed.status).toBe(200);
    await expect(refreshed.json()).resolves.toEqual({
      comments: [expect.objectContaining({ id: 1, text: "The irrigation schedule worked well for our field." })],
    });
    expect(comments).toHaveLength(1);
  });

  it("returns an empty persisted list for a discussion with no comments", async () => {
    const response = await fetch(`${baseUrl}/discussions/1/comments`);
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ comments: [] });
  });

  it("rejects anonymous comment creation before persistence", async () => {
    const response = await postComment(1, { text: "No session is present." }, false);
    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ message: "Authentication is required." });
    expect(comments).toHaveLength(0);
  });

  it("rejects empty, oversized, and invalid-discussion comment requests safely", async () => {
    const empty = await postComment(1, { text: "   " });
    expect(empty.status).toBe(400);
    await expect(empty.json()).resolves.toEqual({ message: "Comment text is required." });

    const oversized = await postComment(1, { text: "x".repeat(2001) });
    expect(oversized.status).toBe(400);
    await expect(oversized.json()).resolves.toEqual({ message: "Comment text must be 2000 characters or fewer." });

    const missingDiscussion = await postComment(999, { text: "A valid comment." });
    expect(missingDiscussion.status).toBe(404);
    await expect(missingDiscussion.json()).resolves.toEqual({ message: "Discussion not found." });
    expect(comments).toHaveLength(0);
  });

  it("allows the authenticated author to edit a persisted comment, preserves its creation time, and returns the changed record after refresh", async () => {
    await postComment(1, { text: "Original temporary test field note." });
    const original = comments[0];

    const edited = await updateComment(1, { text: "Updated temporary test field note." });
    expect(edited.status).toBe(200);
    await expect(edited.json()).resolves.toEqual({
      comment: expect.objectContaining({
        id: 1,
        authorId: 7,
        text: "Updated temporary test field note.",
        createdAt: original.createdAt,
        updatedAt: "2026-08-22T10:35:00.000Z",
      }),
    });
    expect(comments[0]).toMatchObject({
      discussionId: 1,
      userId: 7,
      createdAt: original.createdAt,
      text: "Updated temporary test field note.",
      updatedAt: "2026-08-22T10:35:00.000Z",
    });

    const refreshed = await fetch(`${baseUrl}/discussions/1/comments`);
    await expect(refreshed.json()).resolves.toEqual({ comments: [expect.objectContaining({ id: 1, text: "Updated temporary test field note." })] });
  });

  it("allows the authenticated author to delete a persisted comment and removes it from the refreshed list", async () => {
    await postComment(1, { text: "Temporary comment scheduled for deletion." });

    const deleted = await deleteComment(1);
    expect(deleted.status).toBe(200);
    await expect(deleted.json()).resolves.toEqual({ success: true, deletedCommentId: 1 });
    expect(comments).toEqual([]);

    const refreshed = await fetch(`${baseUrl}/discussions/1/comments`);
    await expect(refreshed.json()).resolves.toEqual({ comments: [] });
  });

  it("rejects a different authenticated user from editing or deleting another author's comment", async () => {
    await postComment(1, { text: "Author-owned comment." });

    const editAttempt = await updateComment(1, { text: "Unauthorized change." }, true, "other-session");
    expect(editAttempt.status).toBe(403);
    await expect(editAttempt.json()).resolves.toEqual({ message: "You can only edit your own comments." });

    const deleteAttempt = await deleteComment(1, true, "other-session");
    expect(deleteAttempt.status).toBe(403);
    await expect(deleteAttempt.json()).resolves.toEqual({ message: "You can only delete your own comments." });
    expect(comments).toEqual([expect.objectContaining({ id: 1, text: "Author-owned comment.", userId: 7 })]);
  });

  it("rejects anonymous update and delete requests before loading or mutating comments", async () => {
    const editAttempt = await updateComment(1, { text: "Anonymous change." }, false);
    expect(editAttempt.status).toBe(401);
    await expect(editAttempt.json()).resolves.toEqual({ message: "Authentication is required." });

    const deleteAttempt = await deleteComment(1, false);
    expect(deleteAttempt.status).toBe(401);
    await expect(deleteAttempt.json()).resolves.toEqual({ message: "Authentication is required." });
  });

  it("rejects missing comments and invalid edit text without changing persisted comments", async () => {
    await postComment(1, { text: "Unchanged valid comment." });

    const missingEdit = await updateComment(999, { text: "Not found." });
    expect(missingEdit.status).toBe(404);
    await expect(missingEdit.json()).resolves.toEqual({ message: "Comment not found." });

    const missingDelete = await deleteComment(999);
    expect(missingDelete.status).toBe(404);
    await expect(missingDelete.json()).resolves.toEqual({ message: "Comment not found." });

    const emptyEdit = await updateComment(1, { text: "   " });
    expect(emptyEdit.status).toBe(400);
    await expect(emptyEdit.json()).resolves.toEqual({ message: "Comment text is required." });

    const oversizedEdit = await updateComment(1, { text: "x".repeat(2001) });
    expect(oversizedEdit.status).toBe(400);
    await expect(oversizedEdit.json()).resolves.toEqual({ message: "Comment text must be 2000 characters or fewer." });
    expect(comments).toEqual([expect.objectContaining({ id: 1, text: "Unchanged valid comment." })]);
  });

  it("creates a persisted one-level reply and returns its parent reference after a refreshed list read", async () => {
    await postComment(1, { text: "Temporary parent comment." });
    const reply = await postComment(1, { text: "Temporary persisted reply.", parentCommentId: 1 });
    expect(reply.status).toBe(201);
    await expect(reply.json()).resolves.toEqual({
      comment: expect.objectContaining({ id: 2, discussionId: 1, parentCommentId: 1, authorId: 7, text: "Temporary persisted reply." }),
    });

    const refreshed = await fetch(`${baseUrl}/discussions/1/comments`);
    await expect(refreshed.json()).resolves.toEqual({
      comments: [
        expect.objectContaining({ id: 1, parentCommentId: null }),
        expect.objectContaining({ id: 2, parentCommentId: 1, text: "Temporary persisted reply." }),
      ],
    });
  });

  it("rejects invalid, cross-discussion, deleted-parent, and nested-reply requests before persistence", async () => {
    const invalid = await postComment(1, { text: "Invalid parent.", parentCommentId: 999 });
    expect(invalid.status).toBe(400);
    await expect(invalid.json()).resolves.toEqual({ message: "Parent comment not found." });

    comments.push({ id: 90, discussionId: 2, userId: 7, parentCommentId: null, text: "Other discussion parent.", createdAt: "2026-08-22T10:30:00.000Z", updatedAt: "2026-08-22T10:30:00.000Z", deletedAt: null });
    const crossDiscussion = await postComment(1, { text: "Cross discussion reply.", parentCommentId: 90 });
    expect(crossDiscussion.status).toBe(400);
    await expect(crossDiscussion.json()).resolves.toEqual({ message: "Reply parent must belong to this discussion." });

    await postComment(1, { text: "Top-level parent." });
    await postComment(1, { text: "First-level reply.", parentCommentId: 1 });
    const nested = await postComment(1, { text: "Nested reply.", parentCommentId: 2 });
    expect(nested.status).toBe(400);
    await expect(nested.json()).resolves.toEqual({ message: "Replies can only be added to a top-level comment." });

    comments.find((comment) => comment.id === 1).deletedAt = "2026-08-22T10:35:00.000Z";
    const deletedParent = await postComment(1, { text: "Reply to deleted parent.", parentCommentId: 1 });
    expect(deletedParent.status).toBe(400);
    await expect(deletedParent.json()).resolves.toEqual({ message: "Replies cannot be added to a deleted comment." });
    expect(comments).toHaveLength(3);
  });

  it("preserves replies by soft-deleting an owner parent and retains author-only reply edit/delete behavior", async () => {
    await postComment(1, { text: "Temporary parent with reply." });
    await postComment(1, { text: "Temporary owner reply.", parentCommentId: 1 });

    const nonOwnerEdit = await updateComment(2, { text: "Unauthorized reply edit." }, true, "other-session");
    expect(nonOwnerEdit.status).toBe(403);
    const nonOwnerDelete = await deleteComment(2, true, "other-session");
    expect(nonOwnerDelete.status).toBe(403);

    const ownerEdit = await updateComment(2, { text: "Edited owner reply." });
    expect(ownerEdit.status).toBe(200);
    await expect(ownerEdit.json()).resolves.toEqual({ comment: expect.objectContaining({ id: 2, parentCommentId: 1, text: "Edited owner reply." }) });

    const deletedParent = await deleteComment(1);
    expect(deletedParent.status).toBe(200);
    await expect(deletedParent.json()).resolves.toEqual({ success: true, deletedCommentId: 1, preservedReplies: true });
    expect(comments).toEqual([
      expect.objectContaining({ id: 1, text: "[Deleted comment]", deletedAt: "2026-08-22T10:35:00.000Z" }),
      expect.objectContaining({ id: 2, parentCommentId: 1, text: "Edited owner reply." }),
    ]);
  });
});
