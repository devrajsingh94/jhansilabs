import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import Razorpay from "razorpay";
import dotenv from "dotenv";

dotenv.config();

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // Razorpay Initialization
  const razorpay = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID || "",
    key_secret: process.env.RAZORPAY_KEY_SECRET || "",
  });

  // API Routes
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok", env: process.env.NODE_ENV });
  });

  app.get("/api/razorpay-key", (req, res) => {
    if (!process.env.RAZORPAY_KEY_ID) {
      console.warn("RAZORPAY_KEY_ID is missing in environment");
    }
    res.json({ keyId: process.env.RAZORPAY_KEY_ID || "" });
  });

  app.post("/api/create-order", async (req, res) => {
    console.log("Received create-order request:", req.body);
    try {
      const { amount, currency = "INR", receipt } = req.body;
      
      if (!amount) {
        return res.status(400).json({ error: "Amount is required" });
      }

      if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET) {
        console.error("Razorpay keys are missing");
        return res.status(500).json({ error: "Payment gateway configuration missing" });
      }

      const options = {
        amount: Math.round(Number(amount) * 100), // Razorpay expects amount in paise
        currency,
        receipt: receipt || `rcpt_${Date.now()}`,
      };

      console.log("Creating Razorpay order with options:", options);
      const order = await razorpay.orders.create(options);
      console.log("Razorpay order created:", order.id);
      res.json(order);
    } catch (error: any) {
      console.error("Razorpay Order Error Details:", error);
      res.status(500).json({ error: error.message || "Failed to create order" });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
