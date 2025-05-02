# SkillMorph_Server

The SkillMorph Server is the backend API for the SkillMorph platform — a modern learning and course management system. It handles user authentication, course and video management, payment integrations (via Stripe), and real-time updates.

---

## 🚀 Features

- 🔐 User Authentication (Sign Up / Sign In / JWT)
- 🧑‍🏫 Instructor & Course Management
- 🎬 Video Uploading & Streaming
- 💳 Stripe Integration for payouts and payments
- 🧾 Course Enrollment & Progress Tracking
- 🔁 Webhooks & Triggers for real-time updates

---

## 🛠 Tech Stack

- Node.js + Express
- PostgreSQL (with Supabase)
- Stripe API
- JWT for Auth
- Cloud Storage (e.g. Supabase Storage / Cloudinary)

---
Add .env file 
DB_PASS=Your postgresql database password 
DB_USER=Your postgresql database username 
DB_HOST=Your postgresql database host 
DB_PORT=Your postgresql database port no 
DB_NAME=Your postgresql database name 
FRONTEND_URL=Your frontend url
JWT_SECRET=Your JWT secret 
REFRESH_TOKEN_SECRET=Your JWT refresh token secret
CLOUDINARY_CLOUD_NAME=Your cloudinary cloud name
CLOUDINARY_API_KEY=Your cloudinary api key
CLOUDINARY_API_SECRET=Your cloudinary api secret
STRIPE_SECRET_KEY=Your stripe secret key
STRIPE_CONNECT_WEBHOOK_SECRET=Your stripe connect webhook secret
STRIPE_PAYMENT_WEBHOOK_SECRET=Your stripe payment webhook secret 

```bash
git clone 
cd skillmorph-server
npm install
