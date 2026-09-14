import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import express from "express";
import { createServer } from "node:http";
import { buildDiscussionPayload, createDiscussion } from "../client/src/services/phase4Services.js";
import { registerCommunityRoutes } from "./community.js";

let server;
let communityBaseUrl;

beforeAll(async () => {
  const app = express();
  app.use(express.json());
  registerCommunityRoutes(app);
  server = createServer(app);
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  communityBaseUrl = `http://127.0.0.1:${address.port}/api/community`;
});

afterAll(async () => {
  await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
});

describe("Community discussion creation payload", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("maps the existing title, detailed description, and problem type fields to the backend contract", () => {
    expect(buildDiscussionPayload({
      title: "  Water access near the north field  ",
      detailedDescription: "  The canal valve has not opened for two days.  ",
      problemType: "  Water issue  ",
      cropType: "Wheat",
      imageName: "field.jpg",
    })).toEqual({
      title: "Water access near the north field",
      description: "The canal valve has not opened for two days.",
      problemType: "Water issue",
    });
  });

  it("sends exactly the required payload and bearer token to POST /discussions", async () => {
    vi.stubEnv("VITE_COMMUNITY_API_URL", "https://community.example.test");
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ discussion: { id: 99 } }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const payload = buildDiscussionPayload({
      title: "Animal tracks at field boundary",
      detailedDescription: "Fresh tracks were visible after irrigation.",
      problemType: "Farm safety",
    });
    await expect(createDiscussion(payload, "verified-session-token")).resolves.toEqual({ discussion: { id: 99 } });

    expect(fetchMock).toHaveBeenCalledWith("https://community.example.test/discussions", expect.objectContaining({
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer verified-session-token",
      },
      body: JSON.stringify({
        title: "Animal tracks at field boundary",
        description: "Fresh tracks were visible after irrigation.",
        problemType: "Farm safety",
      }),
    }));
  });

  it("rejects unauthenticated discussion creation before it can persist data", async () => {
    const response = await fetch(`${communityBaseUrl}/discussions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: "Not persisted",
        description: "This request has no authorization header.",
        problemType: "Verification",
      }),
    });

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ message: "Authentication is required." });
  });
});
