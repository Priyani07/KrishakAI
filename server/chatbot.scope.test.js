import { afterEach, describe, expect, it, vi } from "vitest";
import { createFarmerChatResponse } from "./chatbot.js";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("Krishak AI conversational scope", () => {
  it("sends broad multilingual instructions and preserves Markdown answers", async () => {
    process.env.GEMINI_API_KEY = "test-gemini-key";
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      candidates: [{ content: { parts: [{ text: "## Namaste\n\n**Hello!** Ask me anything about farming or learning." }] } }],
    }), { status: 200, headers: { "Content-Type": "application/json" } }));
    vi.stubGlobal("fetch", fetchMock);

    const answer = await createFarmerChatResponse({
      question: "Hi, can you explain photosynthesis in Hinglish?",
      history: [{ role: "user", content: "Namaste" }, { role: "assistant", content: "Namaste!" }],
    });

    expect(answer).toContain("## Namaste");
    expect(answer).toContain("**Hello!**");
    const requestBody = JSON.parse(fetchMock.mock.calls[0][1].body);
    const instructions = requestBody.systemInstruction.parts[0].text;
    expect(instructions).toContain("greetings");
    expect(instructions).toContain("general educational and study questions");
    expect(instructions).toContain("Hindi");
    expect(instructions).toContain("Hinglish");
    expect(instructions).toContain("Do not claim access to live weather");
    expect(instructions).toContain("recommend appropriate local verification");
    expect(requestBody.contents[0].parts[0].text).toBe("Namaste");
    expect(requestBody.contents[1].parts[0].text).toBe("Namaste!");
    expect(requestBody.contents[2].parts[0].text).toBe("Hi, can you explain photosynthesis in Hinglish?");
    expect(requestBody.contents[0].role).toBe("user");
    expect(requestBody.contents[1].role).toBe("model");
  });
});
