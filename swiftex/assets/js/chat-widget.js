// ══════════════════════════════════════════════
// CHAT-WIDGET.JS — AI chat + Human agent
// Fireworks AI via /api/chat (Vercel serverless)
// ══════════════════════════════════════════════

let chatOpen = false;
let isHumanAgent = false;
let chatSessionId = generateSessionId();
let messageHistory = [];
let realtimeChatChannel = null;

// ── Toggle chat widget ──
function toggleChat() {
  chatOpen = !chatOpen;
  const panel = document.getElementById('chatPanel');
  const pill = document.getElementById('chatPill');
  if (chatOpen) {
    panel.classList.add('open');
    pill.style.display = 'none';
    scrollMessages();
    subscribeAgentReplies();
    document.getElementById('chatInput').focus();
  } else {
    panel.classList.remove('open');
    pill.style.display = 'flex';
  }
}

// ── Send message ──
async function sendChatMessage() {
  const input = document.getElementById('chatInput');
  const text = input.value.trim();
  if (!text) return;

  input.value = '';
  appendMessage('user', text);
  messageHistory.push({ role: 'user', content: text });

  // Save to DB
  await saveChatMessage('user', text);

  if (isHumanAgent) {
    // Human agent mode — just wait for agent reply via realtime
    return;
  }

  // AI mode
  showTyping(true);
  document.getElementById('sendBtn').disabled = true;

  try {
    const response = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: text,
        trackingId: currentTrackingId,
        history: messageHistory.slice(-10), // last 10 messages for context
        sessionId: chatSessionId
      })
    });

    showTyping(false);

    if (!response.ok) throw new Error('API error');

    // Handle streaming response
    const reader = response.body?.getReader();
    if (reader) {
      await handleStream(reader);
    } else {
      const data = await response.json();
      const reply = data.reply || 'Sorry, I couldn\'t process that.';
      appendMessage('assistant', reply);
      messageHistory.push({ role: 'assistant', content: reply });
      await saveChatMessage('assistant', reply);
      checkEscalation(reply);
    }

  } catch (err) {
    showTyping(false);
    appendMessage('assistant', 'Sorry, I\'m having trouble connecting. Please try again or request a human agent.');
  } finally {
    document.getElementById('sendBtn').disabled = false;
    document.getElementById('chatInput').focus();
  }
}

// ── Handle streaming response ──
async function handleStream(reader) {
  const decoder = new TextDecoder();
  let fullText = '';
  const msgEl = appendMessage('assistant', '', true); // empty streaming bubble

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    const chunk = decoder.decode(value, { stream: true });
    // Parse SSE chunks
    chunk.split('\n').forEach(line => {
      if (line.startsWith('data: ')) {
        const data = line.slice(6);
        if (data === '[DONE]') return;
        try {
          const parsed = JSON.parse(data);
          const token = parsed.choices?.[0]?.delta?.content || parsed.token || '';
          fullText += token;
          if (msgEl) msgEl.textContent = fullText;
          scrollMessages();
        } catch (_) {}
      }
    });
  }

  if (fullText) {
    messageHistory.push({ role: 'assistant', content: fullText });
    await saveChatMessage('assistant', fullText);
    checkEscalation(fullText);
  }
}

// ── Check for escalation trigger ──
function checkEscalation(text) {
  if (text.includes('ESCALATE_TO_HUMAN')) {
    isHumanAgent = true;
    document.getElementById('chatModeBar').style.display = 'block';
    document.getElementById('agentBtn').style.opacity = '0.4';
    document.getElementById('agentBtn').disabled = true;
    const cleanText = text.replace('ESCALATE_TO_HUMAN', '').trim();
    if (cleanText) {
      const lastBubble = document.querySelector('.chat-messages .chat-message.assistant:last-child .msg-bubble');
      if (lastBubble) lastBubble.textContent = cleanText;
    }
    appendMessage('assistant', 'I\'ve notified a human agent. They\'ll join this chat shortly. Please hold on.');
  }
}

// ── Request human agent manually ──
async function requestAgent() {
  if (isHumanAgent) return;
  isHumanAgent = true;
  document.getElementById('chatModeBar').style.display = 'block';
  document.getElementById('agentBtn').style.opacity = '0.4';
  document.getElementById('agentBtn').disabled = true;

  appendMessage('assistant', 'You\'ve requested a human agent. An agent will join this conversation shortly. Please wait…');
  await saveChatMessage('assistant', 'Customer requested human agent.', false, true /* escalation flag */);
}

// ── Append message bubble ──
function appendMessage(role, text, streaming = false) {
  const container = document.getElementById('chatMessages');
  const wrapper = document.createElement('div');
  wrapper.className = `chat-message ${role}`;

  const now = new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  const isAgent = role === 'agent';

  wrapper.innerHTML = `
    ${isAgent ? '<div class="msg-agent-label">🧑‍💼 Human Agent</div>' : ''}
    <div class="msg-bubble">${text}</div>
    <div class="msg-time">${now}</div>
  `;

  container.appendChild(wrapper);
  scrollMessages();

  if (streaming) {
    return wrapper.querySelector('.msg-bubble');
  }
}

// ── Save message to Supabase ──
async function saveChatMessage(role, content, isHumanAgentMsg = false, escalation = false) {
  try {
    await supabaseClient.from('chat_messages').insert({
      tracking_id: currentTrackingId,
      session_id: chatSessionId,
      role,
      content: escalation ? '[ESCALATED TO HUMAN]' : content,
      is_human_agent: isHumanAgentMsg,
    });
  } catch (err) {
    console.warn('Chat save error:', err);
  }
}

// ── Subscribe to agent replies via Supabase Realtime ──
function subscribeAgentReplies() {
  if (realtimeChatChannel) return;
  realtimeChatChannel = supabaseClient
    .channel(`chat:${chatSessionId}`)
    .on('postgres_changes', {
      event: 'INSERT',
      schema: 'public',
      table: 'chat_messages',
      filter: `session_id=eq.${chatSessionId}`
    }, (payload) => {
      const msg = payload.new;
      if (msg.role === 'agent' || msg.is_human_agent) {
        if (!isHumanAgent) {
          isHumanAgent = true;
          document.getElementById('chatModeBar').style.display = 'block';
        }
        appendMessage('agent', msg.content);
      }
    })
    .subscribe();
}

// ── Typing indicator ──
function showTyping(show) {
  document.getElementById('chatTyping').style.display = show ? 'flex' : 'none';
  if (show) scrollMessages();
}

// ── Scroll to bottom ──
function scrollMessages() {
  const container = document.getElementById('chatMessages');
  container.scrollTop = container.scrollHeight;
}

// ── Session ID ──
function generateSessionId() {
  return 'sess_' + Date.now() + '_' + Math.random().toString(36).slice(2, 9);
}

// ── Enter key to send ──
document.getElementById('chatInput')?.addEventListener('keydown', e => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    sendChatMessage();
  }
});
