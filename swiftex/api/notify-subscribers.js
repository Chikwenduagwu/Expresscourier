// api/notify-subscribers.js
// Triggered when admin pushes a tracking update
// Sends branded HTML email to all active subscribers via Hostinger SMTP

const nodemailer = require('nodemailer');
const { createClient } = require('@supabase/supabase-js');

// ─────────────────────────────────────────────
// SMTP is ready to go — fill in your .env vars
// when you're ready to activate email sending.
// ─────────────────────────────────────────────
const SMTP_CONFIGURED = !!(
  process.env.SMTP_HOST &&
  process.env.SMTP_USER &&
  process.env.SMTP_PASS
);

module.exports = async function handler(req, res) {
  // Allow Supabase webhook or internal calls
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  // Validate webhook secret if called by Supabase
  const secret = req.headers['x-webhook-secret'];
  if (process.env.WEBHOOK_SECRET && secret !== process.env.WEBHOOK_SECRET) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const { trackingId, eventTitle, eventDescription, eventLocation, newStatus } = req.body;

  if (!trackingId) return res.status(400).json({ error: 'trackingId required' });

  // ── Fetch subscribers + shipment details ──
  const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

  const [{ data: subscribers }, { data: shipment }, { data: allEvents }] = await Promise.all([
    sb.from('email_subscribers').select('email').eq('tracking_id', trackingId).eq('is_active', true),
    sb.from('shipments').select('*').eq('tracking_id', trackingId).single(),
    sb.from('tracking_events').select('*').eq('tracking_id', trackingId).order('timestamp', { ascending: false }).limit(6),
  ]);

  if (!subscribers?.length) {
    return res.status(200).json({ success: true, message: 'No active subscribers — no emails sent' });
  }

  if (!SMTP_CONFIGURED) {
    console.log('[Email] SMTP not configured yet — skipping email send for', trackingId);
    return res.status(200).json({ success: true, message: 'SMTP not configured — email skipped', subscribers: subscribers.length });
  }

  // ── Configure Hostinger SMTP ──
  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,          // smtp.hostinger.com
    port: parseInt(process.env.SMTP_PORT) || 465,
    secure: true,                          // SSL on port 465
    auth: {
      user: process.env.SMTP_USER,        // notifications@yourdomain.com
      pass: process.env.SMTP_PASS,        // email password
    },
  });

  // ── Build HTML email ──
  const statusColors = {
    pending: '#6b7280',
    picked_up: '#0891b2',
    in_transit: '#4D148C',
    out_for_delivery: '#FF6200',
    delivered: '#16a34a',
    exception: '#dc2626',
  };
  const statusLabels = {
    pending: 'Pending',
    picked_up: 'Picked Up',
    in_transit: 'In Transit',
    out_for_delivery: 'Out for Delivery',
    delivered: 'Delivered',
    exception: 'Delivery Exception',
  };

  const statusColor = statusColors[newStatus] || '#4D148C';
  const statusLabel = statusLabels[newStatus] || newStatus;
  const brandName = process.env.BRAND_NAME || 'SwiftEx';
  const appUrl = process.env.APP_URL || 'https://yourapp.vercel.app';

  const eventsHtml = allEvents?.slice(0, 5).map(e => `
    <tr>
      <td style="padding:8px 0;border-bottom:1px solid #f3f4f6;vertical-align:top;">
        <div style="font-size:13px;font-weight:600;color:#1f2937;">${e.title}</div>
        ${e.description ? `<div style="font-size:12px;color:#6b7280;margin-top:2px;">${e.description}</div>` : ''}
        ${e.location ? `<div style="font-size:12px;color:#9ca3af;">📍 ${e.location}</div>` : ''}
      </td>
      <td style="padding:8px 0 8px 16px;border-bottom:1px solid #f3f4f6;vertical-align:top;white-space:nowrap;">
        <div style="font-size:12px;color:#9ca3af;">${new Date(e.timestamp).toLocaleDateString('en-US',{month:'short',day:'numeric',year:'2-digit'})}</div>
        <div style="font-size:11px;color:#d1d5db;">${new Date(e.timestamp).toLocaleTimeString('en-US',{hour:'numeric',minute:'2-digit',hour12:true})}</div>
      </td>
    </tr>
  `).join('') || '<tr><td style="color:#9ca3af;font-size:13px;padding:8px 0;">No events yet</td></tr>';

  const htmlEmail = `
<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><title>Shipment Update</title></head>
<body style="margin:0;padding:0;background:#f4f5f7;font-family:'Helvetica Neue',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f5f7;padding:32px 0;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">

        <!-- Header -->
        <tr><td style="background:#4D148C;border-radius:12px 12px 0 0;padding:28px 32px;">
          <table width="100%" cellpadding="0" cellspacing="0">
            <tr>
              <td>
                <div style="font-size:26px;font-weight:800;color:#fff;letter-spacing:-1px;">${brandName.slice(0,-2)}<span style="color:#FF6200;">${brandName.slice(-2)}</span></div>
                <div style="font-size:12px;color:rgba(255,255,255,0.6);margin-top:2px;letter-spacing:0.05em;text-transform:uppercase;">Shipment Notification</div>
              </td>
              <td align="right">
                <div style="background:rgba(255,255,255,0.12);border-radius:8px;padding:8px 16px;display:inline-block;">
                  <div style="font-size:10px;color:rgba(255,255,255,0.6);letter-spacing:0.06em;text-transform:uppercase;margin-bottom:2px;">Tracking ID</div>
                  <div style="font-size:15px;font-weight:700;color:#fff;letter-spacing:0.08em;">${trackingId}</div>
                </div>
              </td>
            </tr>
          </table>
        </td></tr>

        <!-- Status Banner -->
        <tr><td style="background:#fff;padding:24px 32px;border-left:1px solid #e5e7eb;border-right:1px solid #e5e7eb;">
          <div style="background:${statusColor}15;border-left:4px solid ${statusColor};border-radius:0 8px 8px 0;padding:16px 20px;">
            <div style="font-size:11px;font-weight:700;color:${statusColor};letter-spacing:0.08em;text-transform:uppercase;margin-bottom:4px;">Current Status</div>
            <div style="font-size:22px;font-weight:800;color:${statusColor};">${statusLabel}</div>
            ${eventTitle ? `<div style="font-size:14px;color:#4b5563;margin-top:6px;">${eventTitle}</div>` : ''}
            ${eventDescription ? `<div style="font-size:13px;color:#6b7280;margin-top:3px;">${eventDescription}</div>` : ''}
            ${eventLocation ? `<div style="font-size:12px;color:#9ca3af;margin-top:4px;">📍 ${eventLocation}</div>` : ''}
          </div>
        </td></tr>

        <!-- Route Info -->
        <tr><td style="background:#fff;padding:0 32px 20px;border-left:1px solid #e5e7eb;border-right:1px solid #e5e7eb;">
          <table width="100%" cellpadding="0" cellspacing="0">
            <tr>
              <td style="text-align:center;padding:12px;background:#f9fafb;border-radius:8px;">
                <div style="font-size:10px;font-weight:700;color:#9ca3af;text-transform:uppercase;letter-spacing:0.06em;margin-bottom:2px;">From</div>
                <div style="font-size:14px;font-weight:700;color:#1f2937;">${shipment?.origin || '—'}</div>
              </td>
              <td style="text-align:center;width:40px;font-size:18px;color:#FF6200;">→</td>
              <td style="text-align:center;padding:12px;background:#f9fafb;border-radius:8px;">
                <div style="font-size:10px;font-weight:700;color:#9ca3af;text-transform:uppercase;letter-spacing:0.06em;margin-bottom:2px;">To</div>
                <div style="font-size:14px;font-weight:700;color:#1f2937;">${shipment?.destination || '—'}</div>
              </td>
            </tr>
          </table>
        </td></tr>

        <!-- Events Timeline -->
        <tr><td style="background:#fff;padding:0 32px 24px;border-left:1px solid #e5e7eb;border-right:1px solid #e5e7eb;">
          <div style="font-size:11px;font-weight:700;color:#9ca3af;text-transform:uppercase;letter-spacing:0.08em;margin-bottom:12px;">Shipment History</div>
          <table width="100%" cellpadding="0" cellspacing="0">${eventsHtml}</table>
        </td></tr>

        <!-- CTA -->
        <tr><td style="background:#fff;padding:0 32px 32px;border-left:1px solid #e5e7eb;border-right:1px solid #e5e7eb;border-bottom:1px solid #e5e7eb;border-radius:0 0 0 0;">
          <div style="text-align:center;">
            <a href="${appUrl}/track.html?id=${trackingId}" style="display:inline-block;background:#FF6200;color:#fff;font-weight:700;font-size:14px;padding:14px 32px;border-radius:8px;text-decoration:none;letter-spacing:0.04em;">
              TRACK YOUR PACKAGE →
            </a>
          </div>
        </td></tr>

        <!-- Footer -->
        <tr><td style="background:#f4f5f7;border-radius:0 0 12px 12px;padding:20px 32px;border-left:1px solid #e5e7eb;border-right:1px solid #e5e7eb;border-bottom:1px solid #e5e7eb;">
          <div style="font-size:11px;color:#9ca3af;text-align:center;line-height:1.7;">
            You're receiving this because you subscribed to tracking updates for <strong>${trackingId}</strong>.<br>
            <a href="${appUrl}/api/unsubscribe?trackingId=${trackingId}&email={{EMAIL}}" style="color:#4D148C;">Unsubscribe</a> &nbsp;|&nbsp;
            <a href="${appUrl}" style="color:#4D148C;">${brandName}</a><br>
            &copy; ${new Date().getFullYear()} ${brandName}. All rights reserved.
          </div>
        </td></tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;

  // ── Send emails to all subscribers ──
  const results = await Promise.allSettled(
    subscribers.map(sub =>
      transporter.sendMail({
        from: `"${brandName}" <${process.env.SMTP_USER}>`,
        to: sub.email,
        subject: `📦 ${statusLabel} — Your ${brandName} shipment ${trackingId}`,
        html: htmlEmail.replace('{{EMAIL}}', encodeURIComponent(sub.email)),
      })
    )
  );

  const sent = results.filter(r => r.status === 'fulfilled').length;
  const failed = results.filter(r => r.status === 'rejected').length;

  console.log(`[Email] Sent ${sent}/${subscribers.length} emails for ${trackingId}`);
  return res.status(200).json({ success: true, sent, failed });
};
