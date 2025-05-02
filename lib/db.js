import pkg from "pg";
import dotenv from "dotenv";
const { Client } = pkg; // Destructure Client from the imported package

dotenv.config();
// Database connection configuration
const dbConfig = {
  user: process.env.DB_USER,
  password: process.env.DB_PASS,
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  database: process.env.DB_NAME,
  ssl: { rejectUnauthorized: false }, 
};

// Create a new PostgreSQL client
const client = new Client(dbConfig);

// Connect to the database
(async () => {
  try {
    await client.connect();
    console.log("Connected to PostgreSQL database");
  } catch (err) {
    console.error("Error connecting to PostgreSQL database", err);
  }
})();

export default client;
