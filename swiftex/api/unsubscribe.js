// api/unsubscribe.js
// One-click unsubscribe handler — called from email footer links

const { createClient } = require('@supabase/supabase-js');

module.exports = async function handler(req, res) {
  const { trackingId, email } = req.query;

  if (!trackingId || !email) {
    return res.status(400).send(errorPage('Missing parameters', 'Invalid unsubscribe link.'));
  }

  try {
    const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

    const { error } = await sb
      .from('email_subscribers')
      .update({ is_active: false })
      .eq('tracking_id', trackingId)
      .eq('email', decodeURIComponent(email));

    if (error) throw error;

    const brandName = process.env.BRAND_NAME || 'SwiftEx';
    const appUrl = process.env.APP_URL || '/';

    return res.status(200).send(`
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1.0">
  <title>Unsubscribed — ${brandName}</title>
  <link href="https://fonts.googleapis.com/css2?family=Syne:wght@700;800&family=DM+Sans:wght@400;500&display=swap" rel="stylesheet">
  <style>
    *{box-sizing:border-box;margin:0;padding:0}
    body{font-family:'DM Sans',sans-serif;background:#f4f5f7;display:flex;align-items:center;justify-content:center;min-height:100vh;padding:24px;}
    .card{background:#fff;border-radius:16px;padding:48px 40px;text-align:center;max-width:420px;width:100%;box-shadow:0 8px 30px rgba(0,0,0,0.08);}
    .icon{font-size:3rem;margin-bottom:20px;}
    h1{font-family:'Syne',sans-serif;font-size:1.6rem;font-weight:800;color:#1f2937;margin-bottom:10px;}
    p{font-size:0.9rem;color:#6b7280;line-height:1.65;margin-bottom:24px;}
    .tracking-id{font-family:'Syne',monospace;font-size:1rem;font-weight:700;color:#4D148C;background:#f3eeff;padding:8px 16px;border-radius:6px;display:inline-block;letter-spacing:0.08em;margin-bottom:24px;}
    a.btn{display:inline-block;background:#4D148C;color:#fff;font-family:'Syne',sans-serif;font-size:0.875rem;font-weight:700;padding:12px 28px;border-radius:8px;text-decoration:none;letter-spacing:0.03em;}
    a.btn:hover{background:#6b2db5;}
  </style>
</head>
<body>
  <div class="card">
    <div class="icon">✅</div>
    <h1>Unsubscribed</h1>
    <p>You've been successfully removed from tracking updates for:</p>
    <div class="tracking-id">${trackingId}</div>
    <p>You won't receive any more email notifications for this shipment. You can re-subscribe anytime from the tracking page.</p>
    <a href="${appUrl}/track.html?id=${trackingId}" class="btn">View Tracking Page</a>
  </div>
</body>
</html>`);
  } catch (err) {
    console.error('Unsubscribe error:', err);
    return res.status(500).send(errorPage('Error', 'Something went wrong. Please try again.'));
  }
};

function errorPage(title, message) {
  return `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>${title}</title></head>
  <body style="font-family:sans-serif;text-align:center;padding:80px 24px;">
    <h2 style="color:#dc2626;">${title}</h2>
    <p style="color:#6b7280;margin-top:8px;">${message}</p>
  </body></html>`;
}
