// ══════════════════════════════════════════════
// CONFIG.JS — Supabase client init
// Replace with your actual Supabase credentials
// ══════════════════════════════════════════════

const SUPABASE_URL = 'https://igcuwmqwdsiswqmwwukm.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlnY3V3bXF3ZHNpc3dxbXd3dWttIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTkzMjQwODEsImV4cCI6MjA3NDkwMDA4MX0.BC57re-bAwPlRkidMddKqaceIu94WsBEbN1HnzpWUZY';

// Initialize Supabase client using CDN
const { createClient } = supabase;
const supabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// App config
const APP_CONFIG = {
  brandName: 'SwiftEx',
  apiBase: '/api',        // Vercel serverless functions
  trackingIdLength: 12,
};
