import express, { type Request, Response, NextFunction } from "express";
import cors from "cors";
import fetch from "node-fetch"; // needed for proxy
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";

const app = express();

// ✅ Enable CORS globally
app.use(
  cors({
    origin: "*", // You can restrict to your frontend domain
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

// ✅ Support for JSON body & retain raw buffer (useful for webhooks)
declare module "http" {
  interface IncomingMessage {
    rawBody: unknown;
  }
}

app.use(
  express.json({
    verify: (req, _res, buf) => {
      req.rawBody = buf;
    },
  })
);
app.use(express.urlencoded({ extended: false }));

// ✅ Request logger
app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api") || path.startsWith("/proxy")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }
      if (logLine.length > 100) {
        logLine = logLine.slice(0, 99) + "…";
      }
      log(logLine);
    }
  });

  next();
});

// 🟢 n8n Proxy Route (Prevents CORS issues)
app.post("/proxy/n8n", async (req: Request, res: Response) => {
  try {
    const response = await fetch("https://orthoconnect.app.n8n.cloud/webhook/patient-query", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(req.body),
    });

    const data = await response.json();
    res.status(response.status).json(data);
  } catch (error) {
    console.error("❌ Error proxying to n8n:", error);
    res.status(500).json({ message: "Failed to contact n8n" });
  }
});

(async () => {
  const server = await registerRoutes(app);

  // ✅ Global Error Handler
  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";
    console.error("❌ Express Error:", err);
    res.status(status).json({ message });
  });

  // ✅ Vite dev setup vs production static serve
  if (app.get("env") === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  // ✅ Start server
  const basePort = parseInt(process.env.PORT || "5000", 10);
  const host = process.env.HOST || "localhost";

  const startListening = (port: number, remainingTries: number) => {
    const onError = (err: any) => {
      // If the port is already in use, try the next port so `npm run dev` still works out-of-box.
      if (err?.code === "EADDRINUSE" && remainingTries > 0) {
        server.off("error", onError);
        const nextPort = port + 1;
        log(`⚠️  Port ${port} is in use. Trying ${nextPort}...`);
        startListening(nextPort, remainingTries - 1);
        return;
      }

      // Bubble up other errors (or if we ran out of retries).
      throw err;
    };

    server.once("error", onError);
    server.listen({ port, host }, () => {
      server.off("error", onError);
      log(`🚀 Serving on http://${host}:${port}`);
    });
  };

  startListening(basePort, 20);
})();
