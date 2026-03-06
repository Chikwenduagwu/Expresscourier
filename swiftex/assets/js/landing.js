// ══════════════════════════════════════════════
// LANDING PAGE JS — SwiftEx
// ══════════════════════════════════════════════

document.getElementById('year').textContent = new Date().getFullYear();

// ── Hamburger menu ──
const hamburger = document.getElementById('hamburger');
const mobileMenu = document.getElementById('mobileMenu');
hamburger.addEventListener('click', () => {
  mobileMenu.classList.toggle('open');
});
// Close mobile menu on link click
document.querySelectorAll('.mobile-link').forEach(link => {
  link.addEventListener('click', () => mobileMenu.classList.remove('open'));
});

// ── Navbar scroll effect ──
window.addEventListener('scroll', () => {
  const navbar = document.getElementById('navbar');
  if (window.scrollY > 40) {
    navbar.style.boxShadow = '0 4px 30px rgba(77,20,140,0.45)';
  } else {
    navbar.style.boxShadow = '0 2px 24px rgba(77,20,140,0.35)';
  }
});

// ── Tab switching ──
function setTab(el, tabId) {
  document.querySelectorAll('.tab-item').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
  el.classList.add('active');
  document.getElementById('tab-' + tabId).classList.add('active');
}

// ── Track from hero ──
function trackPackage() {
  const val = document.getElementById('heroTrackInput').value.trim().toUpperCase();
  if (!val) {
    shakeInput('heroTrackInput');
    return;
  }
  if (val.length !== 12) {
    showHeroError('Tracking ID must be exactly 12 characters.');
    return;
  }
  window.location.href = `track.html?id=${val}`;
}

// ── Track from panel ──
function trackFromPanel() {
  const val = document.getElementById('panelTrackInput').value.trim().toUpperCase();
  if (!val || val.length !== 12) {
    shakeInput('panelTrackInput');
    return;
  }
  window.location.href = `track.html?id=${val}`;
}

// ── Fill example ──
function fillExample() {
  document.getElementById('heroTrackInput').value = 'ABC123XYZ789';
  // Switch to track tab
  const trackTab = document.querySelector('.tab-item:nth-child(2)');
  setTab(trackTab, 'track');
}

// ── Input shake animation ──
function shakeInput(id) {
  const el = document.getElementById(id);
  el.style.animation = 'shake 0.4s ease';
  setTimeout(() => el.style.animation = '', 400);
}

// ── Hero error message ──
function showHeroError(msg) {
  let err = document.getElementById('heroError');
  if (!err) {
    err = document.createElement('p');
    err.id = 'heroError';
    err.style.cssText = 'color:#fca5a5;font-size:0.82rem;margin-top:6px;';
    document.querySelector('.hero-track-form').after(err);
  }
  err.textContent = msg;
  setTimeout(() => { if (err) err.textContent = ''; }, 3000);
}

// ── Enter key to track ──
document.getElementById('heroTrackInput').addEventListener('keydown', e => {
  if (e.key === 'Enter') trackPackage();
});

// ── Auto-uppercase tracking input ──
['heroTrackInput', 'panelTrackInput'].forEach(id => {
  const el = document.getElementById(id);
  if (!el) return;
  el.addEventListener('input', () => {
    const pos = el.selectionStart;
    el.value = el.value.toUpperCase().replace(/[^A-Z0-9]/g, '');
    el.setSelectionRange(pos, pos);
  });
  el.addEventListener('keydown', e => {
    if (e.key === 'Enter') {
      id === 'heroTrackInput' ? trackPackage() : trackFromPanel();
    }
  });
});

// ── Scroll reveal ──
const observer = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      entry.target.style.animation = 'fadeUp 0.6s ease both';
      observer.unobserve(entry.target);
    }
  });
}, { threshold: 0.12 });

document.querySelectorAll('.manage-card, .biz-card, .stat-pill').forEach(el => {
  el.style.opacity = '0';
  observer.observe(el);
});

// Add shake keyframe
const style = document.createElement('style');
style.textContent = `
  @keyframes shake {
    0%, 100% { transform: translateX(0); }
    20% { transform: translateX(-6px); }
    40% { transform: translateX(6px); }
    60% { transform: translateX(-4px); }
    80% { transform: translateX(4px); }
  }
  @keyframes fadeUp {
    from { opacity: 0; transform: translateY(20px); }
    to { opacity: 1; transform: translateY(0); }
  }
`;
document.head.appendChild(style);

/* Intersection Observer — trigger .reveal on scroll */
    const io = new IntersectionObserver((entries) => {
      entries.forEach(e => {
        if (e.isIntersecting) {
          e.target.classList.add('visible');
          io.unobserve(e.target);
        }
      });
    }, { threshold: 0.1 });

    document.querySelectorAll('.reveal').forEach(el => io.observe(el));

/* ══ COUNT-UP ══════════════════════════════════════
   Counts from 0 → target with easeOutQuart curve.
   Triggers when .stats-section enters the viewport.
══════════════════════════════════════════════════ */
(function () {
  var nums    = document.querySelectorAll('.s-num');
  var section = document.querySelector('.stats-section');
  var fired   = false;

  function easeOut(t) { return 1 - Math.pow(1 - t, 4); }

  function runCounters() {
    if (fired) return;
    fired = true;
    nums.forEach(function (el) {
      var target  = +el.dataset.target;
      var suffix  = el.dataset.suffix || '';
      var dur     = 2400;
      var t0      = performance.now();
      (function tick(now) {
        var p = Math.min((now - t0) / dur, 1);
        var v = target * easeOut(p);
        /* Format: always show integer unless < 10 */
        el.textContent = (target < 10 ? Math.round(v * 10) / 10 : Math.round(v)) + suffix;
        if (p < 1) requestAnimationFrame(tick);
        else el.textContent = target + suffix;
      })(t0);
    });
  }

  if ('IntersectionObserver' in window) {
    var io = new IntersectionObserver(function (entries) {
      if (entries[0].isIntersecting) { runCounters(); io.disconnect(); }
    }, { threshold: 0.3 });
    io.observe(section);
  } else {
    runCounters();
  }
})();


  /* ══ LANDING PAGE CHAT WIDGET ══════════════════════════════
     - Session ID persisted in localStorage (30-day expiry)
     - Messages saved to Supabase chat_messages by session_id
     - AI replies via /api/chat
     - Realtime agent replies via Supabase channel
  ══════════════════════════════════════════════════════════ */
  (function () {

    /* ── Persistent session ID ── */
    function getSessionId() {
      try {
        var stored = JSON.parse(localStorage.getItem('swiftex_session') || '{}');
        var thirtyDays = 30 * 24 * 60 * 60 * 1000;
        if (!stored.id || (Date.now() - (stored.created || 0)) > thirtyDays) {
          var fresh = { id: crypto.randomUUID(), created: Date.now() };
          localStorage.setItem('swiftex_session', JSON.stringify(fresh));
          return fresh.id;
        }
        return stored.id;
      } catch (e) {
        return 'session_' + Math.random().toString(36).slice(2);
      }
    }

    var SESSION_ID = getSessionId();

    /* ── State ── */
    var isOpen           = false;
    var isHumanAgent     = false;
    var historyLoaded    = false;
    var messageHistory   = [];
    var realtimeChannel  = null;

    /* ── References ── */
    function el(id) { return document.getElementById(id); }

    /* ── Toggle open / close ── */
    window.landingToggleChat = function () {
      isOpen = !isOpen;
      var panel = el('landingChatPanel');
      var pill  = el('landingChatPill');
      if (isOpen) {
        panel.classList.add('open');
        pill.style.display = 'none';
        if (!historyLoaded) loadHistory();
        subscribeRealtime();
        setTimeout(function () { el('landingChatInput').focus(); }, 300);
      } else {
        panel.classList.remove('open');
        pill.style.display = 'flex';
      }
    };

    /* ── Load chat history from Supabase ── */
    async function loadHistory() {
      var container = el('landingChatMessages');
      container.innerHTML = '<div style="display:flex;justify-content:center;padding:20px"><div style="width:20px;height:20px;border:2px solid #eee;border-top-color:#F5C400;border-radius:50%;animation:spin 0.7s linear infinite"></div></div>';

      try {
        var res = await supabaseClient
          .from('chat_messages')
          .select('*')
          .eq('session_id', SESSION_ID)
          .order('created_at', { ascending: true });

        container.innerHTML = '';

        if (!res.data || res.data.length === 0) {
          appendMsg('assistant', "Hi! 👋 I'm the Express Support assistant. Ask me anything about shipping, tracking, or our services.");
          historyLoaded = true;
          return;
        }

        res.data.forEach(function (msg) {
          var role = (msg.is_human_agent || msg.role === 'agent') ? 'agent' : msg.role;
          appendMsgSilent(role, msg.content, msg.created_at);
          if (msg.role === 'user' || msg.role === 'assistant') {
            messageHistory.push({ role: msg.role, content: msg.content });
          }
          if (msg.is_human_agent || msg.role === 'agent') isHumanAgent = true;
        });

        if (isHumanAgent) {
          el('landingChatModeBar').style.display = 'block';
          var ab = el('landingAgentBtn');
          if (ab) { ab.style.opacity = '0.4'; ab.disabled = true; }
        }

        historyLoaded = true;
        scrollBottom();

      } catch (err) {
        container.innerHTML = '';
        appendMsg('assistant', "Hi! 👋 Ask me anything about our services.");
        historyLoaded = true;
      }
    }

    /* ── Send message ── */
    window.landingSendMessage = async function () {
      var input = el('landingChatInput');
      var text  = input.value.trim();
      if (!text) return;
      input.value = '';

      appendMsg('user', text);
      messageHistory.push({ role: 'user', content: text });
      await saveMsg('user', text);

      if (isHumanAgent) return; // wait for agent reply via realtime

      showTyping(true);
      el('landingSendBtn').disabled = true;

      try {
        var res = await fetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            message:   text,
            sessionId: SESSION_ID,
            history:   messageHistory.slice(-10)
          })
        });

        showTyping(false);
        var data  = await res.json();
        var reply = data.reply || "Sorry, I couldn't process that.";

        appendMsg('assistant', reply);
        messageHistory.push({ role: 'assistant', content: reply });

        // Check escalation
        if (reply.includes('ESCALATE_TO_HUMAN')) {
          isHumanAgent = true;
          el('landingChatModeBar').style.display = 'block';
          var ab = el('landingAgentBtn');
          if (ab) { ab.style.opacity = '0.4'; ab.disabled = true; }
          appendMsg('assistant', "I've notified a human agent. They'll join shortly.");
        }

      } catch (err) {
        showTyping(false);
        appendMsg('assistant', "Sorry, I'm having trouble connecting. Please try again.");
      } finally {
        el('landingSendBtn').disabled = false;
        el('landingChatInput').focus();
      }
    };

    /* ── Request human agent ── */
    window.landingRequestAgent = async function () {
      if (isHumanAgent) return;
      isHumanAgent = true;
      el('landingChatModeBar').style.display = 'block';
      var ab = el('landingAgentBtn');
      if (ab) { ab.style.opacity = '0.4'; ab.disabled = true; }
      appendMsg('assistant', "You've requested a human agent. Someone will join shortly. Please wait…");
      await saveMsg('assistant', '[CUSTOMER REQUESTED HUMAN AGENT]', true);
    };

    /* ── Save message to Supabase ── */
    async function saveMsg(role, content, isAgentFlag) {
      try {
        await supabaseClient.from('chat_messages').insert({
          session_id:     SESSION_ID,
          role:           role,
          content:        content,
          is_human_agent: isAgentFlag || false,
          page:           'landing'
        });
      } catch (e) { /* silent */ }
    }

    /* ── Subscribe to realtime agent replies ── */
    function subscribeRealtime() {
      if (realtimeChannel) return;
      realtimeChannel = supabaseClient
        .channel('landing_chat:' + SESSION_ID)
        .on('postgres_changes', {
          event: 'INSERT', schema: 'public', table: 'chat_messages',
          filter: 'session_id=eq.' + SESSION_ID
        }, function (payload) {
          var msg = payload.new;
          if (msg.role === 'agent' || msg.is_human_agent) {
            if (!isHumanAgent) {
              isHumanAgent = true;
              el('landingChatModeBar').style.display = 'block';
            }
            appendMsg('agent', msg.content);
          }
        })
        .subscribe();
    }

    /* ── Append message (live) ── */
    function appendMsg(role, text) {
      var container = el('landingChatMessages');
      var wrap = document.createElement('div');
      wrap.className = 'chat-message ' + role;
      var now = new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
      var isAgent = role === 'agent';
      wrap.innerHTML =
        (isAgent ? '<div class="msg-agent-label">🧑‍💼 Human Agent</div>' : '') +
        '<div class="msg-bubble">' + escHtml(text) + '</div>' +
        '<div class="msg-time">' + now + '</div>';
      container.appendChild(wrap);
      scrollBottom();
    }

    /* ── Append message (history replay) ── */
    function appendMsgSilent(role, text, iso) {
      var container = el('landingChatMessages');
      var wrap = document.createElement('div');
      wrap.className = 'chat-message ' + role;
      var d = iso ? new Date(iso) : new Date();
      var t = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
      var isAgent = role === 'agent';
      wrap.innerHTML =
        (isAgent ? '<div class="msg-agent-label">🧑‍💼 Human Agent</div>' : '') +
        '<div class="msg-bubble">' + escHtml(text) + '</div>' +
        '<div class="msg-time">' + t + '</div>';
      container.appendChild(wrap);
    }

    /* ── Typing indicator ── */
    function showTyping(show) {
      var t = el('landingChatTyping');
      if (t) t.style.display = show ? 'flex' : 'none';
      if (show) scrollBottom();
    }

    /* ── Scroll to bottom ── */
    function scrollBottom() {
      var c = el('landingChatMessages');
      if (c) c.scrollTop = c.scrollHeight;
    }

    /* ── HTML escape ── */
    function escHtml(s) {
      return String(s)
        .replace(/&/g,'&amp;').replace(/</g,'&lt;')
        .replace(/>/g,'&gt;').replace(/"/g,'&quot;')
        .replace(/\n/g,'<br>');
    }

    /* ── Enter key to send ── */
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' && !e.shiftKey && document.activeElement === el('landingChatInput')) {
        e.preventDefault();
        landingSendMessage();
      }
    });


