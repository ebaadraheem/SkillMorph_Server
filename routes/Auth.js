import express from "express";
import pkg1 from "jsonwebtoken";
import pkg2 from "bcryptjs";
import client from "../lib/db.js";
const router = express.Router();

const { sign, verify } = pkg1;
const { hash, compare } = pkg2;

// Register User
router.post("/register", async (req, res) => {
  const { username, email, password } = req.body;

  try {
    if (!username || !password) {
      return res
        .status(400)
        .json({ error: "Username and password are required" });
    }

    // Check if username already exists in the database
    const checkUsernameResult = await client.query(
      "SELECT * FROM users WHERE username = $1",
      [username]
    );

    if (checkUsernameResult.rows.length > 0) {
      return res.status(400).json({ error: "Username already taken" });
    }

    // Check if email already exists in the database
    const checkEmailResult = await client.query(
      "SELECT * FROM users WHERE email = $1",
      [email]
    );

    if (checkEmailResult.rows.length > 0) {
      return res.status(400).json({ error: "Email already taken" });
    }

    // Hash password
    const hashedPassword = await hash(password, 10); // Hash password with a salt round of 10

    // Save user to database
    const result = await client.query(
      "INSERT INTO users (username,email,password) VALUES ($1, $2,$3) RETURNING *",
      [username, email, hashedPassword]
    );
    const user = result.rows[0];
    // On SignUp
    const accessToken = sign(
      { userId: user.user_id, username: user.username },
      process.env.JWT_SECRET,
      { expiresIn: "1h" } // Access token: 1-hour
    );

    const refreshToken = sign(
      { userId: user.user_id },
      process.env.REFRESH_TOKEN_SECRET,
      { expiresIn: "30d" } // Refresh token: 1-month
    );
    // Return tokens
    res.cookie("refreshToken", refreshToken, {
      httpOnly: false,
      secure: false, // Use true in production
      sameSite: "Strict",
    });
    res.json({ accessToken });
  } catch (err) {
    console.error("Error during registration:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Login User
router.post("/login", async (req, res) => {
  const { email, password } = req.body;

  try {
    // Check if user exists in the database
    const result = await client.query("SELECT * FROM users WHERE email = $1", [
      email,
    ]);
    const user = result.rows[0];

    if (!user) return res.status(400).json({ error: "User not found" });
    // Verify password
    const isMatch = await compare(password, user.password); // Use bcrypt's compare method
    if (!isMatch) return res.status(400).json({ error: "Invalid credentials" });

    // On Login
    const accessToken = sign(
      { userId: user.user_id, username: user.username },
      process.env.JWT_SECRET,
      { expiresIn: "1h" } // Access token: 1-hour
    );

    const refreshToken = sign(
      { userId: user.user_id },
      process.env.REFRESH_TOKEN_SECRET,
      { expiresIn: "30d" } // Refresh token: 1-month
    );
    // Return tokens
    res.cookie("refreshToken", refreshToken, {
      httpOnly: false,
      secure: false, // Use true in production
      sameSite: "Strict",
    });
    res.json({ accessToken });
  } catch (err) {
    console.error("Error during login:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Refresh Token Endpoint
router.post("/refresh", async (req, res) => {
  // Extract refresh token from cookies
  const token = req.cookies.refreshToken;
  if (!token) {
    return res.status(401).json({
      error: "Access denied",
      message: "Please Log In!",
    });
  }

  try {
    // Verify the refresh token using the secret
    const decoded = verify(token, process.env.REFRESH_TOKEN_SECRET);

    // Generate a new access token
    const accessToken = sign(
      { userId: decoded.userId },
      process.env.JWT_SECRET,
      { expiresIn: "1h" } // Access token expiry time (1 hour)
    );

    // Return the new access token
    res.json({ Token:accessToken });
  } catch (err) {
    console.error("Error during token refresh:", err);
    res.status(403).json({
      error: "Invalid token",
      message: "Credentials have expired. Please Log In again!",
    });
  }
});

// Logout User
router.post("/logout", async (req, res) => {
  res.clearCookie("refreshToken");
  res.json({ message: "Logged out" });
});
export default router;
