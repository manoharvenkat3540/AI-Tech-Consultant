import express, { Request, Response } from "express";
import dotenv from "dotenv";
import path from "node:path";
import emailRouter from "./email.js";

dotenv.config();

const app = express();
const PORT = Number(process.env.PORT) || 3000;

// Middleware
app.use(express.json());

// Serve frontend files from the public folder
app.use(express.static(path.resolve(process.cwd(), "public")));

// Email API
app.use("/api/emails", emailRouter);

// Health check
app.get("/health", (_req: Request, res: Response) => {
  res.json({
    status: "healthy",
    service: "AI Inbox Agent",
    message: "Task 2 API is running!"
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`AI Inbox Agent running at http://localhost:${PORT}`);
});