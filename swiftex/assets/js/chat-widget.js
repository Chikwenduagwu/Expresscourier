// ══════════════════════════════════════════════
// CHAT-WIDGET.JS — AI chat + Human agent
// Fireworks AI via /api/chat (Vercel serverless)
// Chat history persisted to Supabase by tracking ID
// ══════════════════════════════════════════════

let chatOpen = false;
let isHumanAgent = false;
let messageHistory = [];
let realtimeChatChannel = null;
let chatHistoryLoaded = false;

// ── Get tracking ID from URL or sessionStorage ──
function getTrackingId() {
  const params = new URLSearchParams(window.location.search);
  const fromUrl = params.get('id') || params.get('tracking');
  if (fromUrl) {
    sessionStorage.setItem('swiftex_tracking_id', fromUrl.toUpperCase());
    return fromUrl.toUpperCase();
  }
  return sessionStorage.getItem('swiftex_tracking_id') || null;
}

// currentTrackingId — use existing global if set, otherwise resolve from URL
function resolveTrackingId() {
  if (typeof currentTrackingId !== 'undefined' && currentTrackingId) {
    return currentTrackingId;
  }
  return getTrackingId();
}

// ── Toggle chat widget ──
function toggleChat() {
  chatOpen = !chatOpen;
  const panel = document.getElementById('chatPanel');
  const pill  = document.getElementById('chatPill');

  if (chatOpen) {
    panel.classList.add('open');
    pill.style.display = 'none';

    // Load history from Supabase on first open
    if (!chatHistoryLoaded) {
      loadChatHistory();
    }

    subscribeAgentReplies();
    scrollMessages();
    document.getElementById('chatInput').focus();
  } else {
    panel.classList.remove('open');
    pill.style.display = 'flex';
  }
}

// ── Load full chat history from Supabase ──
async function loadChatHistory() {
  const trackingId = resolveTrackingId();
  if (!trackingId) return;

  const container = document.getElementById('chatMessages');

  // Show loading spinner
  container.innerHTML = `
    <div style="display:flex;justify-content:center;padding:20px">
      <div style="width:20px;height:20px;border:2px solid #e5e7eb;border-top-color:#4D148C;border-radius:50%;animation:spin 0.7s linear infinite"></div>
    </div>`;

  try {
    const { data, error } = await supabaseClient
      .from('chat_messages')
      .select('*')
      .eq('tracking_id', trackingId)
      .order('created_at', { ascending: true });

    container.innerHTML = ''; // clear loading

    if (error) throw error;

    if (!data || data.length === 0) {
      // Fresh conversation — show welcome message
      appendMessage('assistant', "Hi! 👋 I'm here to help with your shipment. Ask me anything about your delivery status or any issues.");
      chatHistoryLoaded = true;
      return;
    }

    // Replay all saved messages into the UI
    data.forEach(msg => {
      const role = msg.is_human_agent ? 'agent' : msg.role;
      appendMessageSilent(role, msg.content, msg.created_at);

      // Rebuild in-memory history for AI context
      if (msg.role === 'user' || msg.role === 'assistant') {
        messageHistory.push({ role: msg.role, content: msg.content });
      }

      // Restore human agent mode if it was escalated before
      if (msg.is_human_agent || msg.role === 'agent') {
        isHumanAgent = true;
      }
    });

    // Restore escalation UI if needed
    if (isHumanAgent) {
      const modeBar  = document.getElementById('chatModeBar');
      const agentBtn = document.getElementById('agentBtn');
      if (modeBar)  modeBar.style.display = 'block';
      if (agentBtn) { agentBtn.style.opacity = '0.4'; agentBtn.disabled = true; }
    }

    chatHistoryLoaded = true;
    scrollMessages();

  } catch (err) {
    console.warn('Failed to load chat history:', err);
    container.innerHTML = '';
    appendMessage('assistant', "Hi! 👋 I'm here to help with your shipment. Ask me anything.");
    chatHistoryLoaded = true;
  }
}

// ── Send message ──
async function sendChatMessage() {
  const trackingId = resolveTrackingId();
  const input = document.getElementById('chatInput');
  const text  = input.value.trim();
  if (!text) return;

  input.value = '';
  appendMessage('user', text);
  messageHistory.push({ role: 'user', content: text });

  // Save user message to DB under tracking ID
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
        message:    text,
        shipmentId: trackingId,
        history:    messageHistory.slice(-10)
      })
    });

    showTyping(false);

    if (!response.ok) throw new Error('API error');

    const data  = await response.json();
    const reply = data.reply || "Sorry, I couldn't process that.";

    appendMessage('assistant', reply);
    messageHistory.push({ role: 'assistant', content: reply });

    // NOTE: api/chat.js already saves both user + bot messages in Supabase,
    // so we do NOT call saveChatMessage here for the bot reply to avoid duplicates.

    checkEscalation(reply);

  } catch (err) {
    showTyping(false);
    appendMessage('assistant', "Sorry, I'm having trouble connecting. Please try again or request a human agent.");
  } finally {
    document.getElementById('sendBtn').disabled = false;
    document.getElementById('chatInput').focus();
  }
}

// ── Check for escalation trigger ──
function checkEscalation(text) {
  if (text.includes('ESCALATE_TO_HUMAN')) {
    isHumanAgent = true;
    const modeBar  = document.getElementById('chatModeBar');
    const agentBtn = document.getElementById('agentBtn');
    if (modeBar)  modeBar.style.display = 'block';
    if (agentBtn) { agentBtn.style.opacity = '0.4'; agentBtn.disabled = true; }

    const cleanText = text.replace('ESCALATE_TO_HUMAN', '').trim();
    if (cleanText) {
      const lastBubble = document.querySelector('.chat-messages .chat-message.assistant:last-child .msg-bubble');
      if (lastBubble) lastBubble.textContent = cleanText;
    }
    appendMessage('assistant', "I've notified a human agent. They'll join this chat shortly. Please hold on.");
  }
}

// ── Request human agent manually ──
async function requestAgent() {
  if (isHumanAgent) return;
  isHumanAgent = true;

  const modeBar  = document.getElementById('chatModeBar');
  const agentBtn = document.getElementById('agentBtn');
  if (modeBar)  modeBar.style.display = 'block';
  if (agentBtn) { agentBtn.style.opacity = '0.4'; agentBtn.disabled = true; }

  appendMessage('assistant', "You've requested a human agent. An agent will join this conversation shortly. Please wait…");
  await saveChatMessage('assistant', 'Customer requested human agent.', false, true);
}

// ── Append message (history replay — uses saved timestamp) ──
function appendMessageSilent(role, text, isoTimestamp) {
  const container = document.getElementById('chatMessages');
  const wrapper   = document.createElement('div');
  wrapper.className = `chat-message ${role}`;

  const date    = isoTimestamp ? new Date(isoTimestamp) : new Date();
  const timeStr = date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  const isAgent = role === 'agent';

  wrapper.innerHTML = `
    ${isAgent ? '<div class="msg-agent-label">🧑‍💼 Human Agent</div>' : ''}
    <div class="msg-bubble">${escapeHtml(text)}</div>
    <div class="msg-time">${timeStr}</div>
  `;
  container.appendChild(wrapper);
}

// ── Append message (live — scrolls to bottom) ──
function appendMessage(role, text, streaming = false) {
  const container = document.getElementById('chatMessages');
  const wrapper   = document.createElement('div');
  wrapper.className = `chat-message ${role}`;

  const now     = new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  const isAgent = role === 'agent';

  wrapper.innerHTML = `
    ${isAgent ? '<div class="msg-agent-label">🧑‍💼 Human Agent</div>' : ''}
    <div class="msg-bubble">${escapeHtml(text)}</div>
    <div class="msg-time">${now}</div>
  `;
  container.appendChild(wrapper);
  scrollMessages();

  if (streaming) return wrapper.querySelector('.msg-bubble');
}

// ── Save message to Supabase ──
async function saveChatMessage(role, content, isHumanAgentMsg = false, escalation = false) {
  const trackingId = resolveTrackingId();
  if (!trackingId) return;

  try {
    await supabaseClient.from('chat_messages').insert({
      tracking_id:    trackingId,
      role,
      content:        escalation ? '[ESCALATED TO HUMAN]' : content,
      is_human_agent: isHumanAgentMsg,
    });
  } catch (err) {
    console.warn('Chat save error:', err);
  }
}

// ── Subscribe to agent replies via Supabase Realtime ──
function subscribeAgentReplies() {
  if (realtimeChatChannel) return;
  const trackingId = resolveTrackingId();
  if (!trackingId) return;

  realtimeChatChannel = supabaseClient
    .channel(`chat:${trackingId}`)
    .on('postgres_changes', {
      event: 'INSERT',
      schema: 'public',
      table: 'chat_messages',
      filter: `tracking_id=eq.${trackingId}`
    }, (payload) => {
      const msg = payload.new;
      if (msg.role === 'agent' || msg.is_human_agent) {
        if (!isHumanAgent) {
          isHumanAgent = true;
          const modeBar = document.getElementById('chatModeBar');
          if (modeBar) modeBar.style.display = 'block';
        }
        appendMessage('agent', msg.content);
      }
    })
    .subscribe();
}

// ── Typing indicator ──
function showTyping(show) {
  const el = document.getElementById('chatTyping');
  if (el) el.style.display = show ? 'flex' : 'none';
  if (show) scrollMessages();
}

// ── Scroll to bottom ──
function scrollMessages() {
  const container = document.getElementById('chatMessages');
  if (container) container.scrollTop = container.scrollHeight;
}

// ── HTML escape ──
function escapeHtml(text) {
  return String(text)
    .replace(/&/g,  '&amp;')
    .replace(/</g,  '&lt;')
    .replace(/>/g,  '&gt;')
    .replace(/"/g,  '&quot;')
    .replace(/\n/g, '<br>');
}

// ── Enter key to send ──
document.getElementById('chatInput')?.addEventListener('keydown', e => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    sendChatMessage();
  }
});

// ── Inject spin keyframe for loading spinner ──
(function () {
  if (document.getElementById('chatSpinStyle')) return;
  const s = document.createElement('style');
  s.id = 'chatSpinStyle';
  s.textContent = '@keyframes spin { to { transform: rotate(360deg); } }';
  document.head.appendChild(s);
})();
