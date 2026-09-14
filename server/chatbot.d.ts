export function createFarmerChatResponse(input: { question: string; history?: Array<{ role: "user" | "assistant"; content: string }> }): Promise<string>;
export function handleChatRequest(req: any, res: any): Promise<any>;
