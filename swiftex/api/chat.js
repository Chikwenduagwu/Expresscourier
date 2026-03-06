// api/chat.js — Persistent chat with Supabase + Fireworks AI
// Saves every message (user + bot) to chat_messages table
// Tagged by shipment_id (tracking code) so admin can see per-shipment history

const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  'https://igcuwmqwdsiswqmwwukm.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlnY3V3bXF3ZHNpc3dxbXd3dWttIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1OTMyNDA4MSwiZXhwIjoyMDc0OTAwMDgxfQ.1aIvChfHfvyd7whQRjZULp3fCcuh5o3urozDsPhAHG8'
);

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { message, shipmentId, session_id } = req.body;
const resolvedId = shipmentId || session_id || 'LANDING';

if (!message) {
  return res.status(400).json({ error: 'message is required' });
}

    const trackingId = (resolvedId || 'LANDING').toUpperCase().trim();

    // 1. Fetch shipment data
    const { data: shipment, error: shipmentError } = await supabase
      .from('shipments')
      .select('*')
      .eq('id', trackingId)
      .single();

    if (shipmentError || !shipment) {
      await saveMessage(trackingId, 'user', message);
      const reply = `I couldn't find a shipment with tracking ID "${trackingId}". Please double-check your tracking code or contact support.`;
      await saveMessage(trackingId, 'bot', reply);
      return res.status(200).json({ reply });
    }

    // 2. Load recent chat history (last 10 messages for context)
    const { data: history } = await supabase
      .from('chat_messages')
      .select('role, message')
      .eq('shipment_id', trackingId)
      .order('created_at', { ascending: false })
      .limit(10);

    const recentHistory = (history || []).reverse();

    // 3. Save the incoming user message
    await saveMessage(trackingId, 'user', message);

    // 4. Build system prompt with shipment context
    const systemPrompt = `You are a helpful customer support agent for SwiftEx, a courier service.
You are helping a customer about their specific shipment.

SHIPMENT DETAILS:
- Tracking ID: ${shipment.id}
- Customer: ${shipment.customer_name}
- Status: ${shipment.status}
- Origin: ${shipment.origin}
- Destination: ${shipment.destination}
- Weight: ${shipment.weight ? shipment.weight + 'kg' : 'Not specified'}
- Description: ${shipment.description || 'Not specified'}
- Estimated Delivery: ${shipment.estimated_delivery || 'To be confirmed'}
- Created: ${new Date(shipment.created_at).toLocaleDateString()}

Be concise, helpful, and friendly. If asked something you don't know, say you will escalate to a human agent. Do not make up tracking information.`;

    // 5. Call Fireworks AI (OpenAI-compatible endpoint)
    const aiResponse = await fetch('https://api.fireworks.ai/inference/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer fw_FTxcGQUKDmw53FbrtcvSmW`
      },
      body: JSON.stringify({
        model: 'accounts/fireworks/models/llama-v3p1-8b-instruct',
        max_tokens: 512,
        messages: [
          { role: 'system', content: systemPrompt },
          ...recentHistory.map(m => ({
            role: m.role === 'user' ? 'user' : 'assistant',
            content: m.message
          })),
          { role: 'user', content: message }
        ]
      })
    });

    const aiData = await aiResponse.json();
console.log('Fireworks response:', JSON.stringify(aiData));
const reply = aiData?.choices?.[0]?.message?.content
      || "I'm having trouble responding right now. Please try again in a moment.";

    // 6. Save bot reply
    await saveMessage(trackingId, 'bot', reply);

    return res.status(200).json({ reply });

  } catch (err) {
    console.error('SWIFTEX_ERROR', JSON.stringify({
      message: err.message,
      stack: err.stack,
      name: err.name
    }));
    return res.status(500).json({ 
      error: err.message, 
      reply: err.message 
    });
  }
};

async function saveMessage(shipmentId, role, message) {
  const { error } = await supabase
    .from('chat_messages')
    .insert({ shipment_id: shipmentId, role, message });
  if (error) console.error('Failed to save message:', error);
}
