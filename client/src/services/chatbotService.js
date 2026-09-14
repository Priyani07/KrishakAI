export async function askFarmerChatbot({ question, history }) {
  const response = await fetch("/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ question, history }),
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload.error || "Unable to reach the AI service. Please try again.");
  }
  if (typeof payload.answer !== "string" || !payload.answer.trim()) {
    throw new Error("The AI service returned an unexpected response.");
  }
  return payload.answer.trim();
}
