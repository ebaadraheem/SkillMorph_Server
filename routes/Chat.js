import express from "express";
import { runChatAgent } from "../agent/LangGraphAgent.js";
const router = express.Router();

router.post("/query", async (req, res) => {
    const { query, messages } = req.body;

    if (!query) {
        return res.status(400).json({ error: "Query is required" });
    }

    try {
        // Run the LangGraph agent
        const response = await runChatAgent(query, messages || []);
        res.json({
            success: true,
            response,
        });
    } catch (error) {
        console.error("Chat Agent Error:", error);
        // Do not expose sensitive error details in production
        res.status(500).json({
            success: false,
            error: "Failed to communicate with the AI agent.",
        });
    }
});

export default router;