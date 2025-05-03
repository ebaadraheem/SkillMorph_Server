import express from "express";
import authenticateAccessToken from "../middleware/Authenticate.js";
import client from "../lib/db.js";

const router = express.Router();

router.get("/info", authenticateAccessToken, async (req, res) => {
  try {
    const user_id = req.user.userId;

    // Fetch user information
    const userResult = await client.query("SELECT * FROM users WHERE user_id = $1", [user_id]);
    const user = userResult.rows[0];

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    let stripeAccountId = null; // Use null to indicate absence of value
    if (user.role === "instructor") {
      const stripeResult = await client.query(
        "SELECT stripe_account_id FROM instructor_details WHERE instructor_id = $1",
        [user_id]
      );

      if (stripeResult.rows.length > 0) {
        stripeAccountId = stripeResult.rows[0].stripe_account_id;
      }
    }


    const data = {
      user_id: user.user_id,
      username: user.username,
      email: user.email,
      role: user.role,
      stripe_account_id: stripeAccountId || "empty", // Fallback to "empty" if null
    };

    res.status(200).json(data);
  } catch (error) {
    console.error("Error fetching user info:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
