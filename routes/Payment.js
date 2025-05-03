import express from "express";
const router = express.Router();
import dotenv from "dotenv";
import Stripe from "stripe";
import client from "../lib/db.js";

// Load environment variables
dotenv.config();

// Initialize Stripe
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: "2020-08-27",
});

const PLATFORM_FEE_PERCENTAGE = 10; // Platform fee percentage (10%)
router.post("/create-or-fetch-connect-account", async (req, res) => {
  const { creatorId, creatorEmail } = req.body;

  if (!creatorEmail) {
    return res.status(400).json({ error: "Creator ID is required" });
  }

  try {
    // Fetch existing accounts
    const accounts = await stripe.accounts.list();

    // Check if the account already exists
    let creatorAccount = accounts.data.find(
      (account) => account.email === creatorEmail
    );

    if (creatorAccount) {
      // Check if the user left details incomplete
      if (
        !creatorAccount.details_submitted ||
        creatorAccount.requirements.currently_due.length > 0
      ) {
        const accountLink = await stripe.accountLinks.create({
          account: creatorAccount.id,
          refresh_url: `${process.env.FRONTEND_URL}/skillsdashboard?view=payments`,
          return_url: `${process.env.FRONTEND_URL}/skillsdashboard?view=payments`,
          type: "account_onboarding",
        });

        return res.json({
          success: false,
          message: "Onboarding incomplete. Redirect to Stripe.",
          accountLink: accountLink.url,
        });
      }
      // Check if the user has submitted details but is pending verification
      if (creatorAccount.requirements.past_due.length > 0) {
        return res.json({
          success: false,
          message:
            "Verification pending. User needs to complete document verification.",
          pendingRequirements: creatorAccount.requirements.past_due,
        });
      }

      // Check if onboarding is complete but payments are not enabled
      if (!creatorAccount.charges_enabled || !creatorAccount.payouts_enabled) {
        return res.json({
          success: false,
          message: "Onboarding complete, but payments are pending approval.",
          isActive: false,
        });
      }

      // If everything is complete and active
      return res.json({
        success: true,
        accountId: creatorAccount.id,
        isActive: true,
      });
    }

    // If no account exists, create a new one
    creatorAccount = await stripe.accounts.create({
      type: "express",
      email: creatorEmail,
      business_type: "individual",
      capabilities: {
        card_payments: { requested: true },
        transfers: { requested: true },
      },
      metadata: {
        creatorEmail: creatorEmail,
        instructor_id: creatorId,
      },
    });

    // Generate onboarding link
    const accountLink = await stripe.accountLinks.create({
      account: creatorAccount.id,
      refresh_url: `${process.env.FRONTEND_URL}/skillsdashboard?view=payments`,
      return_url: `${process.env.FRONTEND_URL}/skillsdashboard?view=payments`,
      type: "account_onboarding",
    });

    res.json({
      success: false,
      message: "New account created. Complete onboarding.",
      accountLink: accountLink.url,
    });
  } catch (error) {
    console.error("Stripe Connect error:", error);
    res.status(500).json({
      success: false,
      error: error.message,
      details: error.raw?.message || "Unknown error occurred",
    });
  }
});

router.post("/process-payment", async (req, res) => {
  const { courseId, amount, creatorConnectId, student_id } = req.body;

  if (!courseId || !amount || !creatorConnectId) {
    return res.status(400).json({ error: "Missing required fields" });
  }

  try {
    const amountInCents = Math.round(amount * 100);
    const platformFee = Math.round(
      amountInCents * (PLATFORM_FEE_PERCENTAGE / 100)
    );

    // Fetch course details
    const result = await client.query("SELECT * FROM courses WHERE id = $1", [
      courseId,
    ]);
    const course = result.rows[0];

    if (!course) {
      return res.status(404).json({ error: "Course not found" });
    }

    // Create checkout session
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      line_items: [
        {
          price_data: {
            currency: "usd",
            product_data: {
              images: [course.thumbnail],
              name: course.title,
              description: course.description,
            },
            unit_amount: amountInCents,
          },
          quantity: 1,
        },
      ],
      mode: "payment",
      success_url: `${process.env.FRONTEND_URL}/skillsdashboard?view=enrolled`,
      cancel_url: `${process.env.FRONTEND_URL}/skillsdashboard?view=allcourses`,
      payment_intent_data: {
        application_fee_amount: platformFee,
        transfer_data: {
          destination: creatorConnectId,
        },
      },
      metadata: {
        courseId,
        creatorId: creatorConnectId,
        platformFee: platformFee,
        student_id, // Add student ID to metadata
      },
    });

    // Return checkout session URL for frontend
    res.json({
      success: true,
      sessionId: session.id,
      sessionUrl: session.url,
    });
  } catch (error) {
    console.error("Error processing payment:", error);
    res.status(500).json({ error: error.message });
  }
});
// Get creator's balance
router.get("/balance/:accountId", async (req, res) => {
  const { accountId } = req.params;

  if (!accountId) {
    return res.status(400).json({ error: "Account ID is required" });
  }

  try {
    const balance = await stripe.balance.retrieve({
      stripeAccount: accountId,
    });

    res.json({ success: true, balance });
  } catch (error) {
    console.error("Error fetching balance:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get creator's payout history
router.get("/payouts/:accountId", async (req, res) => {
  const { accountId } = req.params;

  if (!accountId) {
    return res.status(400).json({ error: "Account ID is required" });
  }

  try {
    const payouts = await stripe.payouts.list({
      stripeAccount: accountId,
      //   limit: 10,
    });
    res.json({ success: true, payouts });
  } catch (error) {
    console.error("Error fetching payouts:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get creator's payment history
router.get("/payments/:accountId", async (req, res) => {
  const { accountId } = req.params;
  try {
    // Fetch the balance transactions for the account (creator's payments)
    const balanceTransactions = await stripe.balanceTransactions.list({
      stripeAccount: accountId, // Specify the connected account
    });

    res.json({ success: true, data: balanceTransactions.data });
  } catch (error) {
    console.error("Error fetching payments:", error);
    res.status(500).json({ error: error.message });
  }
});

// Create payout for creator
router.post("/payout", async (req, res) => {
  const { accountId, amount } = req.body;

  if (!accountId || !amount) {
    return res
      .status(400)
      .json({ error: "Account ID and amount are required" });
  }

  try {
    const payout = await stripe.payouts.create(
      {
        amount,
        currency: "usd",
      },
      {
        stripeAccount: accountId,
      }
    );

    res.json({ success: true, payout });
  } catch (error) {
    console.error("Error creating payout:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
