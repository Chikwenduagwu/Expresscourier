// api/send-email.js
// Sends a subscription confirmation email when a user subscribes to updates
// Also handles general transactional email sending

const nodemailer = require('nodemailer');
const { createClient } = require('@supabase/supabase-js');

// ─────────────────────────────────────────────
// SMTP ready — fill .env vars to activate
// ─────────────────────────────────────────────
const SMTP_CONFIGURED = !!(
  process.env.SMTP_HOST &&
  process.env.SMTP_USER &&
  process.env.SMTP_PASS
);

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { type, email, trackingId } = req.body;

  if (!email || !trackingId) {
    return res.status(400).json({ error: 'email and trackingId are required' });
  }

  if (!SMTP_CONFIGURED) {
    console.log('[Email] SMTP not configured — skipping send-email for', email);
    return res.status(200).json({ success: true, message: 'SMTP not configured — email skipped' });
  }

  const brandName = process.env.BRAND_NAME || 'SwiftEx';
  const appUrl = process.env.APP_URL || 'https://yourapp.vercel.app';

  // Fetch shipment info for context
  let shipment = null;
  try {
    const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
    const { data } = await sb.from('shipments').select('*').eq('tracking_id', trackingId).single();
    shipment = data;
  } catch (_) {}

  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT) || 465,
    secure: true,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });

  let subject, html;

  if (type === 'subscription_confirm') {
    subject = `✅ You're now tracking ${trackingId} — ${brandName}`;
    html = `
<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#f4f5f7;font-family:'Helvetica Neue',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f5f7;padding:32px 0;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;">

        <tr><td style="background:#4D148C;border-radius:12px 12px 0 0;padding:24px 32px;">
          <div style="font-size:24px;font-weight:800;color:#fff;letter-spacing:-1px;">
            ${brandName.slice(0,-2)}<span style="color:#FF6200;">${brandName.slice(-2)}</span>
          </div>
        </td></tr>

        <tr><td style="background:#fff;padding:32px;border-left:1px solid #e5e7eb;border-right:1px solid #e5e7eb;">
          <div style="font-size:32px;margin-bottom:12px;">🔔</div>
          <h1 style="font-size:20px;font-weight:800;color:#1f2937;margin:0 0 10px;">You're subscribed!</h1>
          <p style="font-size:14px;color:#4b5563;line-height:1.65;margin:0 0 24px;">
            You'll receive email notifications every time there's an update on your shipment.
          </p>

          <div style="background:#f3eeff;border:1.5px solid #c084fc;border-radius:10px;padding:18px 20px;margin-bottom:24px;">
            <div style="font-size:11px;font-weight:700;color:#9ca3af;letter-spacing:0.08em;text-transform:uppercase;margin-bottom:4px;">Tracking ID</div>
            <div style="font-size:22px;font-weight:800;color:#4D148C;letter-spacing:0.08em;">${trackingId}</div>
            ${shipment ? `
            <div style="margin-top:12px;display:flex;gap:16px;">
              <div>
                <div style="font-size:10px;font-weight:700;color:#9ca3af;text-transform:uppercase;">From</div>
                <div style="font-size:13px;font-weight:600;color:#374151;">${shipment.origin || '—'}</div>
              </div>
              <div style="color:#FF6200;font-size:16px;padding-top:12px;">→</div>
              <div>
                <div style="font-size:10px;font-weight:700;color:#9ca3af;text-transform:uppercase;">To</div>
                <div style="font-size:13px;font-weight:600;color:#374151;">${shipment.destination || '—'}</div>
              </div>
            </div>
            ` : ''}
          </div>

          <div style="text-align:center;">
            <a href="${appUrl}/track.html?id=${trackingId}"
               style="display:inline-block;background:#FF6200;color:#fff;font-weight:700;font-size:14px;padding:14px 32px;border-radius:8px;text-decoration:none;letter-spacing:0.04em;">
              TRACK YOUR PACKAGE →
            </a>
          </div>
        </td></tr>

        <tr><td style="background:#f4f5f7;border-radius:0 0 12px 12px;padding:18px 32px;border:1px solid #e5e7eb;border-top:none;">
          <div style="font-size:11px;color:#9ca3af;text-align:center;line-height:1.7;">
            You subscribed to tracking updates for <strong>${trackingId}</strong>.<br>
            <a href="${appUrl}/api/unsubscribe?trackingId=${trackingId}&email=${encodeURIComponent(email)}" style="color:#4D148C;">Unsubscribe</a>
            &nbsp;|&nbsp; &copy; ${new Date().getFullYear()} ${brandName}
          </div>
        </td></tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;
  } else {
    return res.status(400).json({ error: 'Unknown email type' });
  }

  try {
    await transporter.sendMail({
      from: `"${brandName}" <${process.env.SMTP_USER}>`,
      to: email,
      subject,
      html,
    });
    return res.status(200).json({ success: true });
  } catch (err) {
    console.error('[Email] Send error:', err);
    return res.status(500).json({ error: 'Failed to send email', detail: err.message });
  }
};
