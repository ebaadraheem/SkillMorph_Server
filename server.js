import express from "express";
import cookieParser from "cookie-parser";
import cors from "cors";
import dotenv from "dotenv";
import Courses from "./routes/Courses.js";
import Auth from "./routes/Auth.js";
import User from "./routes/User.js";
import Videos from "./routes/Videos.js";
import Payment from "./routes/Payment.js";
import Chat from "./routes/Chat.js";
import Webhooks from "./routes/Webhooks.js";
import corsOptions from "./middleware/Cors.js";
import bodyParser from "body-parser";

const app = express();
const port = process.env.PORT || 4000;

// Load environment variables
dotenv.config();
// Middleware (EXCLUDE webhook from body parsing)
app.use(cookieParser());
app.use(cors(corsOptions));

// Webhook Route (Must come BEFORE express.json())
app.use("/webhook", Webhooks);

// Apply JSON parsing for other routes (EXCLUDE webhook)
app.use(express.json());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Default Route
app.get("/", (req, res) => {
  res.send("Server is up and running for SkillMorph!");
});

// Route Definitions
app.use("/auth", Auth);
app.use("/course", Courses);
app.use("/user", User);
app.use("/videos", Videos);
app.use("/payment", Payment);
app.use("/chat", Chat);

// Start the Server
app.listen(port, () => {
  console.log(`🚀 Server is running on port ${port}`);
});
