import dotenv from "dotenv";
// Load environment variables
dotenv.config();

var corsOptions = {
  origin: process.env.FRONTEND_URL, 
  methods: ["GET", "POST", "PUT", "DELETE"],
  credentials: true, // Allow cookies to be sent
};

export default corsOptions;
