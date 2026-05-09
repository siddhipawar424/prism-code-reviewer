const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const mongoose = require("mongoose");
const { GoogleGenerativeAI } = require("@google/generative-ai");

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json({ limit: "2mb" }));

/* ── MongoDB ── */
mongoose
  .connect(process.env.MONGO_URI)
  .then(() => console.log("MongoDB Connected"))
  .catch((err) => console.error("MongoDB Error:", err));

/* ── Gemini ── */
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

/* ── Schema ── */
const reviewSchema = new mongoose.Schema({
  code: String,
  language: String,
  review: Object, // structured JSON, not raw text
  createdAt: { type: Date, default: Date.now },
});
const Review = mongoose.model("Review", reviewSchema);

/* ── Prompt ── */
function buildPrompt(code, language) {
  return `You are an expert ${language} engineer with 15+ years of experience.

Analyze the code and respond ONLY with a raw JSON object — no markdown fences, no extra text.

Adapt your depth to actual quality:
- Good clean code → brief sections, empty arrays where nothing applies
- Buggy/risky code → thorough, line-specific, detailed
- Never fabricate issues to fill sections

Required JSON shape:

{
  "quality": {
    "score": <0-100 integer>,
    "label": <"Excellent"|"Good"|"Needs Work"|"Poor">,
    "summary": "<2-3 honest sentences about overall code quality>"
  },
  "bugs": [
    {
      "severity": <"critical"|"warning"|"info">,
      "title": "<short title>",
      "description": "<what the bug is and why it matters>",
      "snippet": "<the offending line or code, or null>"
    }
  ],
  "security": [
    {
      "severity": <"critical"|"warning"|"info">,
      "title": "<short title>",
      "description": "<the risk and its real-world impact>"
    }
  ],
  "performance": [
    {
      "title": "<short title>",
      "description": "<what to optimize and measurable benefit>"
    }
  ],
  "bestPractices": [
    {
      "title": "<short title>",
      "description": "<what convention is violated and the better approach>"
    }
  ],
  "optimizedCode": "<complete refactored code as a plain string — use \\n for newlines>",
  "diffSummary": "<2-3 sentences: key changes made in the optimized version and why>"
}

Rules:
- Any array may be [] if genuinely nothing applies
- optimizedCode is always required (return original if already optimal)
- Properly escape all quotes and newlines inside JSON strings
- Output ONLY the JSON object — nothing before or after

${language} code to review:
\`\`\`
${code}
\`\`\``;
}

/* ── Routes ── */

app.get("/", (_req, res) => res.send("AI Code Reviewer API Running"));

app.post("/api/review", async (req, res) => {
  try {
    const { code, language = "javascript" } = req.body;
    if (!code?.trim()) return res.status(400).json({ message: "Code is required" });

    const result = await model.generateContent(buildPrompt(code, language));
    const raw = result.response.text().trim()
      .replace(/^```json\s*/i, "")
      .replace(/^```\s*/i, "")
      .replace(/```\s*$/i, "")
      .trim();

    let reviewData;
    try {
      reviewData = JSON.parse(raw);
    } catch (e) {
      console.error("JSON parse failed:", e.message);
      console.error("Raw snippet:", raw.slice(0, 500));
      return res.status(500).json({ message: "AI returned malformed JSON. Please try again." });
    }

    const saved = await Review.create({
      code,
      language: language.toLowerCase(),
      review: reviewData,
    });

    res.json(saved);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server Error" });
  }
});

// Lightweight list — only metadata for sidebar
app.get("/api/history", async (_req, res) => {
  try {
    const reviews = await Review.find(
      {},
      { code: 1, language: 1, createdAt: 1, "review.quality": 1 }
    ).sort({ createdAt: -1 }).limit(50);
    res.json(reviews);
  } catch (err) {
    res.status(500).json({ message: "Error fetching history" });
  }
});

// Full item by id (for restoring a review from sidebar)
app.get("/api/history/:id", async (req, res) => {
  try {
    const item = await Review.findById(req.params.id);
    if (!item) return res.status(404).json({ message: "Not found" });
    res.json(item);
  } catch (err) {
    res.status(500).json({ message: "Fetch failed" });
  }
});

app.delete("/api/history/:id", async (req, res) => {
  try {
    await Review.findByIdAndDelete(req.params.id);
    res.json({ message: "Deleted" });
  } catch (err) {
    res.status(500).json({ message: "Delete failed" });
  }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));