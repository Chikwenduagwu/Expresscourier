// api/chat.js — Fireworks AI proxy (Vercel Serverless Function)
const { createClient } = require('@supabase/supabase-js');

module.exports = async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    return res.status(200).end();
  }
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { message, trackingId, history = [], sessionId } = req.body;
  if (!message) return res.status(400).json({ error: 'message is required' });

  // Fetch shipment context
  let shipmentContext = `Tracking ID: ${trackingId || 'unknown'}`;
  try {
    const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
    const [{ data: shipment }, { data: events }] = await Promise.all([
      sb.from('shipments').select('*').eq('tracking_id', trackingId).single(),
      sb.from('tracking_events').select('*').eq('tracking_id', trackingId).order('timestamp', { ascending: false }).limit(5),
    ]);
    if (shipment) {
      shipmentContext = `Shipment: ${shipment.tracking_id} | Status: ${shipment.status} | From: ${shipment.origin} | To: ${shipment.destination} | Est. Delivery: ${shipment.estimated_delivery || 'Pending'}\nEvents: ${events?.map(e => `${e.title}${e.location ? ' at ' + e.location : ''}`).join(', ') || 'None'}`;
    }
  } catch (err) { console.error('[Chat] Context error:', err.message); }

  const systemPrompt = `You are a professional customer support agent for ${process.env.BRAND_NAME || 'SwiftEx'} courier. Be warm, concise, 2-4 sentences max. ${shipmentContext}. If customer wants human agent, include exactly ESCALATE_TO_HUMAN in response. Never invent tracking data.`;

  const messages = [
    { role: 'system', content: systemPrompt },
    ...history.slice(-8).map(m => ({ role: m.role === 'assistant' ? 'assistant' : 'user', content: m.content })),
    { role: 'user', content: message },
  ];

  try {
    const fireworksRes = await fetch('https://api.fireworks.ai/inference/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${process.env.FIREWORKS_API_KEY}` },
      body: JSON.stringify({
        model: process.env.FIREWORKS_MODEL || 'accounts/fireworks/models/llama-v3p1-70b-instruct',
        messages,
        max_tokens: 400,
        temperature: 0.7,
        stream: false,
      }),
    });

    if (!fireworksRes.ok) {
      console.error('[Chat] Fireworks error:', await fireworksRes.text());
      return res.status(200).json({ reply: "I'm having trouble connecting. Please try again or request a human agent." });
    }

    const data = await fireworksRes.json();
    const reply = data.choices?.[0]?.message?.content || "Sorry, I couldn't generate a response.";

    if (trackingId && sessionId) {
      try {
        const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
        await sb.from('chat_messages').insert([
          { tracking_id: trackingId, session_id: sessionId, role: 'user', content: message, is_human_agent: false },
          { tracking_id: trackingId, session_id: sessionId, role: 'assistant', content: reply, is_human_agent: false },
        ]);
      } catch (dbErr) { console.error('[Chat] DB error:', dbErr.message); }
    }

    return res.status(200).json({ reply });
  } catch (err) {
    console.error('[Chat] Error:', err.message);
    return res.status(200).json({ reply: "I'm having trouble right now. Please try again shortly." });
  }
};
