import express from "express";
import Stripe from "stripe";
import client from "../lib/db.js";
import dotenv from "dotenv";

dotenv.config();
const router = express.Router();
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

// Connect account webhook
router.post(
  "/connect-webhook",
  express.raw({ type: "application/json" }),
  async (req, res) => {
    const sig = req.headers["stripe-signature"];
    try {
      const event = stripe.webhooks.constructEvent(
        req.body,
        sig,
        process.env.STRIPE_CONNECT_WEBHOOK_SECRET
      );

      if (event.type === "account.updated") {
        const account = event.data.object;

        if (!account.metadata?.instructor_id) {
          return res.status(400).send("Missing instructor_id");
        }

        if (account.details_submitted && account.charges_enabled) {
          await client.query(
            "UPDATE instructor_details SET stripe_account_id = $1 WHERE instructor_id = $2",
            [account.id, account.metadata.instructor_id]
          );
        }
      }

      res.json({ received: true });
    } catch (err) {
      res.status(400).send(`Webhook Error: ${err.message}`);
    }
  }
);

// Payment webhook
router.post(
  "/payment-webhook",
  express.raw({ type: "application/json" }),
  async (req, res) => {
    try {
      const event = stripe.webhooks.constructEvent(
        req.body,
        req.headers["stripe-signature"],
        process.env.STRIPE_PAYMENT_WEBHOOK_SECRET
      );

      if (event.type === "checkout.session.completed") {
        const session = event.data.object;
        const { courseId, student_id } = session.metadata || {};

        if (!courseId || !student_id) {
          return res.status(400).send("Missing required metadata");
        }

        const checkEnrollment = await client.query(
          "SELECT * FROM student_enrollments WHERE course_id = $1 AND student_id = $2",
          [courseId, student_id]
        );

        if (checkEnrollment.rows.length === 0) {
          await client.query(
            "INSERT INTO student_enrollments (course_id, student_id, amount_paid, enrollment_date) VALUES ($1, $2, $3, NOW())",
            [courseId, student_id, session.amount_total / 100]
          );
        }
      }
      res.json({ received: true });
    } catch (err) {
      res.status(400).send(`Webhook Error: ${err.message}`);
    }
  }
);

export default router;
