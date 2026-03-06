module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { message } = req.body;

    if (!message) return res.status(400).json({ error: 'message is required' });

    const systemPrompt = `You are a helpful customer support agent for SwiftEx, a fast and reliable courier service.
You help customers with general questions about the platform.

ABOUT SWIFTEX:
- SwiftEx is a courier and logistics company offering fast, reliable delivery services
- Customers can track their shipments using a tracking ID on the website
- Services include standard delivery, express delivery, and international shipping
- To track a shipment, customers visit the tracking page and enter their tracking ID
- For urgent issues, customers can request to speak with a human agent
- Support is available 24/7

Only answer questions related to SwiftEx and courier/delivery topics. If asked something unrelated, politely redirect the conversation back to how you can help with deliveries and shipments. Keep responses short, friendly, and helpful.`;

    const aiResponse = await fetch('https://api.fireworks.ai/inference/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer fw_FTxcGQUKDmw53FbrtcvSmW`
      },
      body: JSON.stringify({
        model: 'accounts/fireworks/models/llama-v3p3-70b-instruct',
        max_tokens: 512,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: message }
        ]
      })
    });

    const aiData = await aiResponse.json();
    console.error('FW:', JSON.stringify(aiData));
return res.status(200).json({ reply: JSON.stringify(aiData) });
    const reply = aiData?.choices?.[0]?.message?.content
      || "I'm having trouble responding right now. Please try again.";

    return res.status(200).json({ reply });

  } catch (err) {
    console.error('Chat error:', err.message);
    return res.status(500).json({ reply: err.message });
  }
};
