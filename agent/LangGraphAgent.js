import { StateGraph } from "@langchain/langgraph";
import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { convertToLangChainMessages } from "../middleware/Functions.js";
import { tool } from "@langchain/core/tools";
import { executeCourseQuery } from "./tools.js";
import * as z from "zod";
import dotenv from "dotenv";
dotenv.config();

async function queryCourseDatabase(input) {
  try {
    // const parsed = typeof input === "string" ? JSON.parse(input) : input;
    const { action, value } = input;
    return await executeCourseQuery(action, value);
  } catch (e) {
    return {
      success: false,
      error:
        "Invalid tool input. Must be JSON: {'action': '...', 'value': '...'} or the database failed.",
    };
  }
}

const courseDBTool = tool(
  async (input) => {
    return await queryCourseDatabase(input);
  },
  {
    name: "course_db_tool",
    description: `
        A specialized tool to query the SkillMorph course database for information such as course counts, details, and price filtering. Remember, durations in database are stored in seconds.
        
        **INPUT FORMAT (Mandatory JSON string):** \`{"action": "...", "value": "..."}\`
        
        | Action Key | Description | Value Required? | Value Example |
        |---|---|---|---|
        | \`count_all\` | Get total course counts grouped by category. | No | - |
        | \`count_by_category\` | Get the total number of courses in a specific category. | Yes (Category Name) | \`'Web Development'\` |
        | **\`find_by_category\`** | **List the top 5 courses belonging to a specific category.** | **Yes (Category Name)** | **\`'Development'\`** |
        | \`find_course\` | Search for courses by title or keyword. Returns max 5 results. | Yes (Search Term) | \`'React'\` |
        | \`find_by_price\` | Search for courses at or below a specified maximum price. Returns max 5 results. | Yes (Max Price) | \`'29.99'\` |
    `,
    schema: z.object({
      action: z.string(),
      value: z.string().optional(),
    }),
  }
);

const agentState = z.object({
  messages: z.array(
    z.object({
      id: z.number().optional(),
      role: z.enum(["system", "human", "assistant", "tool"]),
      content: z.string(),
      tool_calls: z.array(z.any()).optional(),
    })
  ),
});

const model = new ChatGoogleGenerativeAI({
  model: "gemini-2.5-flash",
  temperature: 0.2,
  apiKey: process.env.GEMINI_API_KEY,
});
const tools = [courseDBTool];
const llmWithTools = model.bindTools(tools);

// 5. Nodes
async function llmNode(state) {
  const { messages } = state;
  const lcMessages = convertToLangChainMessages(messages);
  const result = await llmWithTools.invoke(lcMessages);
  console.log("LLM Node Result:", result);
  const newStateMessage = {
    role: "assistant",
    content: result.content,
    tool_calls: result.tool_calls,
  };

  return {
    messages: [...messages, newStateMessage],
  };
}

async function toolNode(state) {
  const { messages } = state;
  const lastMessage = messages[messages.length - 1];

  if (!lastMessage.tool_calls || lastMessage.tool_calls.length === 0) {
    return state;
  }

  const toolResults = [];

  for (const call of lastMessage.tool_calls) {
    const toolFunc = tools.find((t) => t.name === call.name);

    if (!toolFunc) continue;

    try {
      const args =
        typeof call.args === "string" ? JSON.parse(call.args) : call.args;
      const output = await toolFunc.invoke(args);
      toolResults.push({
        role: "tool",
        content: JSON.stringify(output),
      });
    } catch (error) {
      toolResults.push({
        role: "tool",
        content: JSON.stringify({
          error: `Error running tool ${call.name}: ${error.message}`,
          details: error.message,
        }),
      });
    }
  }

  return {
    messages: [...messages, ...toolResults],
  };
}

// 6. Router function
function shouldContinue(state) {
  const { messages } = state;
  const lastMessage = messages[messages.length - 1];

  if (lastMessage.tool_calls && lastMessage.tool_calls.length > 0) {
    return "continue";
  }
  return "end";
}

// 7. Build and Compile the Graph
const workflow = new StateGraph({ state: agentState });

workflow.addNode("llm", llmNode);
workflow.addNode("tool", toolNode);
workflow.addEdge("__start__", "llm");
workflow.addConditionalEdges("llm", shouldContinue, {
  continue: "tool",
  end: "__end__",
});
workflow.addEdge("tool", "llm");

const app = workflow.compile();

export async function runChatAgent(query, history = []) {
  const systemPrompt = `
        You are **SkillMorph AI**, the official, friendly, and highly specialized assistant for the SkillMorph course platform.
        Your sole purpose is to help users discover, count, and get details about the courses *available on SkillMorph*.

        **MANDATORY GUARDRAILS:**
        1. **Strict Focus:** Your knowledge is **ONLY** about SkillMorph courses and platform functionality. Absolutely refuse, with a polite redirection, any query concerning external companies, politics, religion, or any topic outside of SkillMorph's course catalog.
        2. **Factuality:** **ALWAYS** use the \`course_db_tool\` to retrieve current and accurate course information. Never guess or hallucinate course data.
        3. **Conversation Context:** Leverage the provided \`history\` to understand the user's ongoing needs and maintain a continuous, personalized conversation flow.
        4. **Tool Output Presentation:** When you present tool results to the user, you **MUST** format the data clearly and concisely (using tables or bullet points). **The \`duration\` field is returned as an already formatted string (e.g., "38.0 hours" or "45 minutes"); do not attempt to convert or modify it.**
    `;

  const initialState = {
    messages: [
      { role: "system", content: systemPrompt },
      ...history,
      { role: "human", content: query },
    ],
  };
  const finalState = await app.invoke(initialState);
  const messages = finalState.messages || [];
  const lastMessage = messages[messages.length - 1];

  const finalContent =
    lastMessage?.content || "Sorry, I couldn't process that request.";

  return finalContent;
}
