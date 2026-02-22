// api/chat.js — Fireworks AI proxy (Vercel serverless)
// Streams AI responses back to the client

export const config = { runtime: 'edge' }; // Use edge runtime for streaming

export default async function handler(req) {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  const { message, trackingId, history = [], sessionId } = await req.json();

  // ── Fetch shipment context from Supabase ──
  let shipmentContext = '';
  try {
    const { createClient } = await import('@supabase/supabase-js');
    const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

    const [{ data: shipment }, { data: events }] = await Promise.all([
      sb.from('shipments').select('*').eq('tracking_id', trackingId).single(),
      sb.from('tracking_events').select('*').eq('tracking_id', trackingId).order('timestamp', { ascending: false }).limit(5)
    ]);

    if (shipment) {
      shipmentContext = `
Shipment Information:
- Tracking ID: ${shipment.tracking_id}
- Status: ${shipment.status}
- Origin: ${shipment.origin}
- Destination: ${shipment.destination}
- Service Type: ${shipment.service_type}
- Estimated Delivery: ${shipment.estimated_delivery || 'Pending'}
- Recipient: ${shipment.recipient_name}

Recent Events:
${events?.map(e => `- ${e.title}${e.location ? ` at ${e.location}` : ''} (${new Date(e.timestamp).toLocaleDateString()})`).join('\n') || 'No events yet'}
      `.trim();
    }
  } catch (err) {
    console.error('Supabase context error:', err);
    shipmentContext = `Tracking ID: ${trackingId}`;
  }

  // ── Build messages for Fireworks AI ──
  const systemPrompt = `You are a professional and helpful customer support agent for SwiftEx, a courier and logistics company. You are warm, concise, and solution-focused.

${shipmentContext}

Guidelines:
- Answer questions about this specific shipment using the information above
- Be empathetic and professional at all times
- For questions outside your knowledge, offer to connect with a human agent
- If the customer asks to speak with a human agent, say you're connecting them now and include exactly "ESCALATE_TO_HUMAN" in your response (the system will handle the rest)
- Do NOT make up tracking information not provided above
- Keep responses concise — 2-4 sentences maximum unless detail is needed`;

  const messages = [
    ...history.slice(-8).map(m => ({ role: m.role === 'assistant' ? 'assistant' : 'user', content: m.content })),
    { role: 'user', content: message }
  ];

  // ── Call Fireworks AI ──
  const fireworksRes = await fetch('https://api.fireworks.ai/inference/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.FIREWORKS_API_KEY}`
    },
    body: JSON.stringify({
      model: process.env.FIREWORKS_MODEL || 'accounts/fireworks/models/llama-v3p1-70b-instruct',
      messages: [{ role: 'system', content: systemPrompt }, ...messages],
      max_tokens: 400,
      temperature: 0.7,
      stream: true,
    })
  });

  if (!fireworksRes.ok) {
    const err = await fireworksRes.text();
    console.error('Fireworks error:', err);
    return new Response(
      JSON.stringify({ reply: 'I apologize — I\'m having trouble connecting right now. Please try again or click the agent button above for human support.' }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  }

  // Stream the response back
  return new Response(fireworksRes.body, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'X-Accel-Buffering': 'no',
    }
  });
}
