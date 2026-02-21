# SwiftEx — Courier Tracking System

A full-featured courier tracking platform with admin panel, real-time tracking, AI-powered customer chat, email notifications, and human agent escalation.

---

## 📁 Project Structure

```
swiftex/
├── index.html                  ← Public landing page
├── track.html                  ← Public tracking page
├── admin/
│   ├── index.html              ← Admin login
│   ├── dashboard.html          ← Admin dashboard
│   ├── shipments.html          ← All shipments list
│   ├── shipment.html           ← Manage single shipment + push updates
│   └── chat.html               ← Human agent chat console
├── assets/
│   ├── css/
│   │   ├── main.css            ← Global shared styles
│   │   ├── landing.css         ← Landing page styles
│   │   ├── tracking.css        ← Tracking page + chat widget
│   │   └── admin.css           ← Full admin panel styles
│   └── js/
│       ├── main.js             ← Shared utilities
│       ├── config.js           ← Supabase client init ← EDIT THIS
│       ├── landing.js          ← Landing page logic
│       ├── tracking.js         ← Tracking page logic
│       └── chat-widget.js      ← AI + human chat widget
├── api/
│   ├── chat.js                 ← Fireworks AI proxy (streaming)
│   ├── notify-subscribers.js   ← Email blast via Hostinger SMTP
│   ├── send-email.js           ← Subscription confirmation email
│   └── unsubscribe.js          ← One-click unsubscribe handler
├── package.json                ← nodemailer + supabase-js deps
├── vercel.json                 ← Vercel routing + function config
└── .env.example                ← Environment variable template
```

---

## 🚀 Deployment Guide (Vercel)

### Step 1 — Set Up Supabase

1. Go to [supabase.com](https://supabase.com) → **New Project**
2. Note your **Project URL** and **API Keys** (Settings → API)
3. Go to **SQL Editor** and run this schema:

```sql
-- SHIPMENTS
create table shipments (
  id uuid default gen_random_uuid() primary key,
  tracking_id varchar(12) unique not null,
  recipient_name text,
  recipient_email text,
  sender_name text,
  origin text,
  destination text,
  service_type text default 'standard',
  weight text,
  status text default 'pending',
  estimated_delivery date,
  signed_by text,
  delivery_message text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- TRACKING EVENTS
create table tracking_events (
  id uuid default gen_random_uuid() primary key,
  tracking_id varchar(12) references shipments(tracking_id) on delete cascade,
  title text not null,
  description text,
  location text,
  event_type text,
  timestamp timestamptz default now(),
  metadata jsonb
);

-- EMAIL SUBSCRIBERS
create table email_subscribers (
  id uuid default gen_random_uuid() primary key,
  tracking_id varchar(12) references shipments(tracking_id) on delete cascade,
  email text not null,
  subscribed_at timestamptz default now(),
  is_active boolean default true,
  unique(tracking_id, email)
);

-- CHAT MESSAGES
create table chat_messages (
  id uuid default gen_random_uuid() primary key,
  tracking_id varchar(12) references shipments(tracking_id) on delete cascade,
  session_id text not null,
  role text not null,
  content text not null,
  is_human_agent boolean default false,
  agent_name text,
  created_at timestamptz default now()
);

-- ROW LEVEL SECURITY
alter table shipments enable row level security;
alter table tracking_events enable row level security;
alter table email_subscribers enable row level security;
alter table chat_messages enable row level security;

-- Public can READ tracking data
create policy "Public read shipments"
  on shipments for select using (true);

create policy "Public read events"
  on tracking_events for select using (true);

-- Authenticated admins can do everything
create policy "Admin all shipments"
  on shipments for all using (auth.role() = 'authenticated');

create policy "Admin all events"
  on tracking_events for all using (auth.role() = 'authenticated');

-- Anyone can subscribe with email
create policy "Public insert subscribers"
  on email_subscribers for insert with check (true);

create policy "Public read own subscriber"
  on email_subscribers for select using (true);

create policy "Admin manage subscribers"
  on email_subscribers for all using (auth.role() = 'authenticated');

-- Chat: anyone can insert/read (scoped by session_id in app logic)
create policy "Public chat read"
  on chat_messages for select using (true);

create policy "Public chat insert"
  on chat_messages for insert with check (true);

create policy "Admin chat all"
  on chat_messages for all using (auth.role() = 'authenticated');

-- Enable Realtime on all tables
alter publication supabase_realtime add table shipments;
alter publication supabase_realtime add table tracking_events;
alter publication supabase_realtime add table chat_messages;
```

4. Go to **Authentication → Users → Add User** and create your admin account (email + password).

---

### Step 2 — Set Up Supabase Webhook (for auto email on update)

1. In Supabase → **Database → Webhooks → Create Webhook**
2. Configure:
   - **Name:** `notify-on-event`
   - **Table:** `tracking_events`
   - **Events:** `INSERT`
   - **URL:** `https://YOUR-APP.vercel.app/api/notify-subscribers`
   - **Headers:** Add `x-webhook-secret` → your `WEBHOOK_SECRET` value
3. Click **Save**

> ⚠️ You need your Vercel URL first — come back to this step after Step 4.

---

### Step 3 — Edit `assets/js/config.js`

Open `assets/js/config.js` and replace the placeholder values:

```js
const SUPABASE_URL = 'https://YOUR_PROJECT_ID.supabase.co';
const SUPABASE_ANON_KEY = 'eyJ...your_anon_key...';
```

These are your **public** keys — safe to be in the browser.  
Find them in Supabase → Settings → API.

---

### Step 4 — Deploy to Vercel

#### Option A: Via Vercel CLI (Recommended)

```bash
# 1. Install Vercel CLI
npm install -g vercel

# 2. Login
vercel login

# 3. From your project root directory:
vercel

# Follow the prompts:
# - Set up and deploy? Yes
# - Which scope? (your account)
# - Link to existing project? No → create new
# - Project name: swiftex (or your choice)
# - Directory: ./ (current)
# - Override settings? No

# 4. Deploy to production:
vercel --prod
```

#### Option B: Via GitHub + Vercel Dashboard

1. Push your project to a GitHub repository
2. Go to [vercel.com](https://vercel.com) → **New Project**
3. Import your GitHub repository
4. Click **Deploy** (Vercel auto-detects the config)

---

### Step 5 — Add Environment Variables in Vercel

1. Go to your Vercel project → **Settings → Environment Variables**
2. Add each variable below (set for **Production**, **Preview**, and **Development**):

| Variable | Value | Required |
|---|---|---|
| `SUPABASE_URL` | `https://xxxxx.supabase.co` | ✅ |
| `SUPABASE_ANON_KEY` | `eyJ...` (anon key) | ✅ |
| `SUPABASE_SERVICE_ROLE_KEY` | `eyJ...` (service role key) | ✅ |
| `FIREWORKS_API_KEY` | `fw-xxxxxxxxxxxx` | ✅ |
| `FIREWORKS_MODEL` | `accounts/fireworks/models/llama-v3p1-70b-instruct` | ✅ |
| `APP_URL` | `https://your-app.vercel.app` | ✅ |
| `BRAND_NAME` | `SwiftEx` | ✅ |
| `WEBHOOK_SECRET` | Any random string | ✅ |
| `SMTP_HOST` | `smtp.hostinger.com` | ⏳ Later |
| `SMTP_PORT` | `465` | ⏳ Later |
| `SMTP_USER` | `notifications@yourdomain.com` | ⏳ Later |
| `SMTP_PASS` | Your email password | ⏳ Later |

3. After adding variables, go to **Deployments → Redeploy**

---

### Step 6 — Activate SMTP Email (When Ready)

1. Log in to **Hostinger** → Email → Manage Email Accounts
2. Create `notifications@yourdomain.com`
3. Go back to Vercel → Environment Variables
4. Add (or uncomment) the 4 SMTP variables above
5. Redeploy — emails will start sending automatically

**Hostinger SMTP Settings:**
```
Host:    smtp.hostinger.com
Port:    465
Security: SSL
Username: notifications@yourdomain.com
Password: (your email password)
```

---

### Step 7 — Get Your Fireworks AI Key

1. Go to [fireworks.ai](https://fireworks.ai) → Sign Up / Log In
2. Go to **API Keys** → **Create API Key**
3. Copy the key → add as `FIREWORKS_API_KEY` in Vercel
4. Recommended model: `accounts/fireworks/models/llama-v3p1-70b-instruct`

---

## ✅ Final Checklist

```
[ ] Supabase project created
[ ] SQL schema executed (all 4 tables + RLS policies)
[ ] Realtime enabled on tables
[ ] Admin user created in Supabase Auth
[ ] config.js updated with your SUPABASE_URL and SUPABASE_ANON_KEY
[ ] Deployed to Vercel (vercel --prod)
[ ] All environment variables set in Vercel dashboard
[ ] Redeployed after setting env vars
[ ] Supabase Webhook configured pointing to /api/notify-subscribers
[ ] Tested: create shipment in admin
[ ] Tested: view tracking page publicly
[ ] Tested: AI chat on tracking page
[ ] (Later) SMTP variables added → email notifications working
```

---

## 🔗 Pages & URLs

| Page | URL |
|---|---|
| Landing / Home | `https://your-app.vercel.app/` |
| Track a Package | `https://your-app.vercel.app/track.html?id=ABC123XYZ789` |
| Admin Login | `https://your-app.vercel.app/admin/` |
| Admin Dashboard | `https://your-app.vercel.app/admin/dashboard.html` |
| All Shipments | `https://your-app.vercel.app/admin/shipments.html` |
| Manage Shipment | `https://your-app.vercel.app/admin/shipment.html?id=TRACKINGID` |
| Agent Chat Console | `https://your-app.vercel.app/admin/chat.html` |

---

## 🔑 Admin Workflow

1. **Login** at `/admin/` with your Supabase Auth email + password
2. **Create a shipment** from the dashboard → auto-generates a 12-char tracking ID
3. **Share the tracking ID** with your customer
4. **Push updates** from the shipment detail page → customers get email + live page update
5. **Monitor chat** in the Chat console — reply as human agent when escalated

---

## 🛠️ Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Vanilla HTML, CSS, JavaScript |
| Database | Supabase (PostgreSQL) |
| Auth | Supabase Auth |
| Realtime | Supabase Realtime (WebSockets) |
| Backend API | Vercel Serverless Functions (Node.js 18) |
| AI Chat | Fireworks AI (llama-v3p1-70b-instruct, streaming) |
| Email | Hostinger SMTP via nodemailer |
| Hosting | Vercel |
| Fonts | Google Fonts (Syne + DM Sans) |

---

## ❓ Troubleshooting

**Tracking page shows "Not Found"**
→ Check `config.js` has the correct Supabase URL and anon key.
→ Ensure RLS policies allow public SELECT on `shipments` and `tracking_events`.

**Admin login doesn't work**
→ Make sure you created a user in Supabase → Authentication → Users (not just the database).

**Chat not working**
→ Check `FIREWORKS_API_KEY` is set in Vercel env vars and redeployed.

**Emails not sending**
→ Verify all 4 SMTP_ vars are set. Check Vercel function logs for SMTP errors.
→ Ensure Hostinger email account exists and SMTP is enabled.

**Realtime not updating**
→ Go to Supabase → Database → Replication and confirm tables are in the `supabase_realtime` publication.

---

*Built with ❤️ — SwiftEx Courier Tracking System*
