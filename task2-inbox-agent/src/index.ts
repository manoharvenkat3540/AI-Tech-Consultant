import express from "express";
import dotenv from "dotenv";
import path from "node:path";
import emailRouter from "./email.js";

dotenv.config();

const app = express();
const PORT = Number(process.env.PORT) || 3000;

app.use(express.json());

app.use(
  express.static(path.resolve(process.cwd(), "public"))
);

app.use("/api/emails", emailRouter);

app.get("/health", (_req, res) => {
  res.json({
    status: "healthy",
    service: "AI Inbox Agent",
    message: "Task 2 API is running!",
  });
});

app.listen(PORT, () => {
  console.log(`AI Inbox Agent running at http://localhost:${PORT}`);
});