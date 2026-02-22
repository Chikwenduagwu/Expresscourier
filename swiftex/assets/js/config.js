// ══════════════════════════════════════════════
// CONFIG.JS — Supabase client init
// Replace with your actual Supabase credentials
// ══════════════════════════════════════════════

const SUPABASE_URL = 'https://YOUR_PROJECT.supabase.co';
const SUPABASE_ANON_KEY = 'YOUR_ANON_KEY';

// Initialize Supabase client using CDN
const { createClient } = supabase;
const supabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// App config
const APP_CONFIG = {
  brandName: 'SwiftEx',
  apiBase: '/api',        // Vercel serverless functions
  trackingIdLength: 12,
};
