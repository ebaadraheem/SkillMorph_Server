import client from "../lib/db.js";
import { HumanMessage, AIMessage, ToolMessage, SystemMessage } from "@langchain/core/messages";
const addStudentEnrollment = async (student_id, course_id, amount_paid) => {
  try {
    // Insert the enrollment data into the database
    const query = `
      INSERT INTO student_enrollments (student_id, course_id, amount_paid)
      VALUES ($1, $2, $3) RETURNING *;
    `;
    const values = [student_id, course_id, amount_paid];

    const result = await client.query(query, values);

    return result.rows[0];
  } catch (error) {
    console.error("Error adding enrollment:", error);
    return { error: error.message };
  }
};

const deleteStudentEnrollment = async (student_id, course_id) => {
  try {
    // Delete the enrollment data from the database
    const query = `
        DELETE FROM student_enrollments 
        WHERE student_id = $1 AND course_id = $2
        RETURNING *;
      `;
    const values = [student_id, course_id];

    const result = await client.query(query, values);

    return result.rows[0];
  } catch (error) {
    console.error("Error deleting enrollment:", error);
    return { error: error.message };
  }
};
// Helper function to convert custom state messages to LangChain message objects
function convertToLangChainMessages(messages) {
  return messages
    .map((msg) => {
      if (msg.role === "system") {
        return new SystemMessage({ content: msg.content });
      } else if (msg.role === "human") {
        return new HumanMessage({ content: msg.content });
      } else if (msg.role === "assistant") {
        return new AIMessage({
          content: msg.content,
          tool_calls: msg.tool_calls,
        });
      } else if (msg.role === "tool") {
        try {
          const resultData = JSON.parse(msg.content);

          return new ToolMessage({
            content: resultData.result
              ? JSON.stringify(resultData.result)
              : msg.content,
            toolCallId: resultData.id || "unknown-id", 
            name: resultData.tool || "course_db_tool", 
          });
        } catch (e) {
          console.error("Error parsing tool message content in conversion:", e);
          return new SystemMessage({
            content: `Tool execution failed: ${msg.content}`,
          });
        }
      }
      return null;
    })
    .filter(Boolean); 
}

export {
  addStudentEnrollment,
  deleteStudentEnrollment,
  convertToLangChainMessages,
};
