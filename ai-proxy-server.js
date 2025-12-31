// ai-proxy-server.js
import "dotenv/config"
import express from "express";
import cors from "cors";
import fetch from "node-fetch";

const app = express();
app.use(cors());          // 필요 시 origin 제한 가능
app.use(express.json());

const API_URL =
  "https://factchat-cloud.mindlogic.ai/v1/api/openai/chat/completions";
const API_KEY = process.env.FACTCHAT_API_KEY; // 서버 환경변수

app.post("/api/ai/chat", async (req, res) => {
  try {
    const { messages, model } = req.body;

    const upstreamRes = await fetch(API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${API_KEY}`,
      },
      body: JSON.stringify({
        model: model || "gpt-5-chat-latest",
        messages,
      }),
    });

    const data = await upstreamRes.json();
    res.status(upstreamRes.status).json(data);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "proxy_error", message: err.message });
  }
});

const PORT = 4000;
app.listen(PORT, () => {
  console.log(`AI proxy server listening on http://localhost:${PORT}`);
});
