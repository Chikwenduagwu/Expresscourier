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
