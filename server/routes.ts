import type { Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import fetch from "node-fetch"; // 👈 install with: npm install node-fetch
import { storage } from "./storage";

export async function registerRoutes(app: Express): Promise<Server> {
  const n8nProdWebhookUrl =
    process.env.N8N_WEBHOOK_URL || "https://orthoconnect.app.n8n.cloud/webhook/patient-query";
  const n8nTestWebhookUrl =
    process.env.N8N_TEST_WEBHOOK_URL || "https://hackgroup1234.app.n8n.cloud/webhook-test/patient-query";

  const forwardToN8n = async (webhookUrl: string, req: Request, res: Response) => {
    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(req.body),
    });

    const rawBody = await response.text();
    const contentType = response.headers.get("content-type") || "";
    const looksLikeJson = contentType.includes("application/json");

    if (looksLikeJson) {
      try {
        const data = JSON.parse(rawBody);
        res.status(response.status).json(data);
        return;
      } catch {
        // Fall through and return raw body details for debugging.
      }
    }

    res.status(response.status).json({
      error: "n8n returned a non-JSON response",
      status: response.status,
      contentType,
      body: rawBody.slice(0, 1000),
    });
  };

  // 🟢 Health check route
  app.get("/api/health", (_req: Request, res: Response) => {
    res.json({ status: "ok", message: "Server is running 🚀" });
  });

  // 🟢 Example route using your storage (you can modify later)
  app.get("/api/users", async (_req: Request, res: Response) => {
    try {
      const users = await storage.getAllUsers?.();
      res.json(users || []);
    } catch (error) {
      console.error("❌ Error fetching users:", error);
      res.status(500).json({ error: "Failed to fetch users" });
    }
  });

  // 🟢 Forward patient data to n8n (production)
  app.post("/api/n8n/patient-query", async (req: Request, res: Response) => {
    try {
      await forwardToN8n(n8nProdWebhookUrl, req, res);
    } catch (error) {
      console.error("❌ Error forwarding to n8n:", error);
      res.status(500).json({ error: "Failed to reach n8n webhook" });
    }
  });

  // 🧪 Forward to n8n test webhook
  app.post("/api/n8n/patient-query-test", async (req: Request, res: Response) => {
    try {
      await forwardToN8n(n8nTestWebhookUrl, req, res);
    } catch (error) {
      console.error("❌ Error contacting n8n test webhook:", error);
      res.status(500).json({ error: "Failed to reach n8n test webhook" });
    }
  });

  // 🤖 Proxy ML analyze (browser → same origin → Node → FastAPI on 8000)
  app.post("/api/ml/analyze", async (req: Request, res: Response) => {
    const mlUrl = process.env.ML_SERVICE_URL || "http://127.0.0.1:8000/analyze";
    try {
      const response = await fetch(mlUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(req.body),
      });
      const rawBody = await response.text();
      const trimmed = rawBody.trim();
      if (!trimmed) {
        return res.status(response.status).json({});
      }
      try {
        const data = JSON.parse(trimmed);
        return res.status(response.status).json(data);
      } catch {
        return res.status(response.status).json({
          error: "ML returned non-JSON",
          detail: trimmed.slice(0, 500),
        });
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      console.error("❌ ML proxy error:", message);
      return res.status(502).json({
        error: "ML service unreachable",
        message,
      });
    }
  });

  // 🔧 Create HTTP server
  const httpServer = createServer(app);
  console.log("✅ Routes registered successfully");
  return httpServer;
}
