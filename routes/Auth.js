import express from "express";
import pkg1 from "jsonwebtoken";
import pkg2 from "bcryptjs";
import client from "../lib/db.js";
import nodemailer from "nodemailer";
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
    res.json({ Token: accessToken });
  } catch (err) {
    console.error("Error during token refresh:", err);
    res.status(403).json({
      error: "Invalid token",
      message: "Credentials have expired. Please Log In again!",
    });
  }
});

router.post("/forgot-password", async (req, res) => {
  const { email } = req.body;

  // 1. Check if user exists
  const userRes = await client.query("SELECT * FROM users WHERE email = $1", [
    email,
  ]);
  if (userRes.rows.length === 0) {
    return res.status(404).json({ msg: "User not found" });
  }

  const user = userRes.rows[0];

  // 2. Check if reset_token exists and is not expired
  if (
    user.reset_token &&
    user.reset_token_expires &&
    new Date(user.reset_token_expires) > new Date()
  ) {
    return res
      .status(200)
      .json({
        msg: "Reset password email already sent. Please wait before requesting again.",
      });
  }

  // 3. Create new token and expiry
  const token = sign({ email }, process.env.JWT_SECRET, { expiresIn: "15m" });
  const expiry = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes from now

  // 4. Update user with new token and expiry
  await client.query(
    "UPDATE users SET reset_token = $1, reset_token_expires = $2 WHERE email = $3",
    [token, expiry, email]
  );

  // 5. Send email
  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: { user: process.env.EMAIL, pass: process.env.EMAIL_PASS },
  });

  await transporter.sendMail({
    from: process.env.EMAIL,
    to: email,
    subject: "Reset Your Password",
    html: `
    <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
      <h2 style="color: #3DA0A7;">SkillMorph Password Reset Request</h2>
      <p>Hello,</p>
      <p>We received a request to reset your password for your SkillMorph account associated with this email address. If you made this request, you can reset your password by clicking the button below:</p>
      <p style="text-align: center; margin: 20px 0;">
        <a href="${process.env.FRONTEND_URL}/reset-password/${token}" 
           style="background-color: #3DA0A7; color: white; padding: 10px 20px; text-decoration: none; border-radius: 6px;">
          Reset Password
        </a>
      </p>
      <p>This link will expire in 15 minutes for security reasons.</p>
      <p>If you didn't request a password reset, you can safely ignore this email. Your account will remain secure and no changes will be made.</p>
      <p>Thanks,<br>The SkillMorph Team</p>
      <hr />
      <p style="font-size: 12px; color: #999;">Please do not reply to this email. This inbox is not monitored.</p>
    </div>
  `,
  });

  res.json({ msg: "Reset link sent to email" });
});

router.post("/reset-password", async (req, res) => {
  console.log("Request body:", req.body); // Log the request body
  const { token, password } = req.body;
  console.log(token, password);
  // 1. Verify token
  try {
    const decoded = verify(token, process.env.JWT_SECRET);
    const email = decoded.email;

    const userRes = await client.query("SELECT * FROM users WHERE email = $1", [
      email,
    ]);
    const user = userRes.rows[0];

    if (
      !user ||
      user.reset_token !== token ||
      new Date() > user.reset_token_expires
    ) {
      return res.status(400).json({ msg: "Invalid or expired token" });
    }

    const hashed = await hash(password, 10);
    await client.query(
      "UPDATE users SET password = $1, reset_token = NULL, reset_token_expires = NULL WHERE email = $2",
      [hashed, email]
    );

    res.json({ msg: "Password has been reset successfully" });
  } catch (err) {
    res.status(400).json({ msg: "Invalid token" });
  }
});

// Logout User
router.post("/logout", async (req, res) => {
  res.clearCookie("refreshToken");
  res.json({ message: "Logged out" });
});
export default router;
