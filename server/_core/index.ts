import "dotenv/config";
import express from "express";
import { createServer } from "http";
import net from "net";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { registerOAuthRoutes } from "./oauth";
import { registerStorageProxy } from "./storageProxy";
import { appRouter } from "../routers";
import { createContext } from "./context";
import { serveStatic, setupVite } from "./vite";
import { handleChatRequest } from "../chatbot.js";
// @ts-expect-error Community backend intentionally remains a JavaScript module.
import { registerMarketPriceRoutes } from "../marketPrices.js";
import { registerIrrigationAiRoutes } from "../irrigationAi.js";
import { registerCommunityRoutes } from "../community.js";
// @ts-expect-error Community Socket.IO boundary intentionally remains a JavaScript module.
import { createCommunityChatServer } from "../communityChat.js";
// @ts-expect-error Weather provider boundary intentionally remains a JavaScript module.
import { registerWeatherRoutes } from "../weather.js";
// @ts-expect-error Disease Detection route intentionally remains a JavaScript module.
import { registerDiseaseRoutes } from "../disease.js";
// @ts-expect-error Soil Testing route intentionally remains a JavaScript module.
import { registerSoilTestRoutes } from "../soilTest.js";
// @ts-expect-error Soil Analysis route intentionally remains a JavaScript module.
import { registerSoilAnalysisRoutes } from "../soilAnalysis.js";

function isPortAvailable(port: number): Promise<boolean> {
  return new Promise(resolve => {
    const server = net.createServer();
    server.listen(port, () => {
      server.close(() => resolve(true));
    });
    server.on("error", () => resolve(false));
  });
}

async function findAvailablePort(startPort: number = 3000): Promise<number> {
  for (let port = startPort; port < startPort + 20; port++) {
    if (await isPortAvailable(port)) {
      return port;
    }
  }
  throw new Error(`No available port found starting from ${startPort}`);
}

async function startServer() {
  const app = express();
  const server = createServer(app);
  // Configure body parser with larger size limit for file uploads
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));
  registerStorageProxy(app);
  registerOAuthRoutes(app);
  // Dedicated Krishak AI endpoint. The Gemini key remains server-side.
  app.post("/api/chat", handleChatRequest);
  registerCommunityRoutes(app);
  registerMarketPriceRoutes(app);
  registerIrrigationAiRoutes(app);
  createCommunityChatServer(server);
  registerWeatherRoutes(app);
  registerDiseaseRoutes(app);
  registerSoilAnalysisRoutes(app);
  registerSoilTestRoutes(app);
  // tRPC API
  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext,
    })
  );
  // development mode uses Vite, production mode uses static files
  if (process.env.NODE_ENV === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  const preferredPort = parseInt(process.env.PORT || "3000");
  const port = await findAvailablePort(preferredPort);

  if (port !== preferredPort) {
    console.log(`Port ${preferredPort} is busy, using port ${port} instead`);
  }

  server.listen(port, () => {
    console.log(`Server running on http://localhost:${port}/`);
  });
}

startServer().catch(console.error);
