// ══════════════════════════════════════════════
// MAIN.JS — Shared global utilities
// ══════════════════════════════════════════════

// Set current year in any footer year span
document.querySelectorAll('#year, .year').forEach(el => {
  el.textContent = new Date().getFullYear();
});

// Global toast helper (used across pages)
function showToast(msg, duration = 3000) {
  let toast = document.getElementById('toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'toast';
    toast.style.cssText = [
      'position:fixed', 'bottom:24px', 'left:50%',
      'transform:translateX(-50%) translateY(20px)',
      'background:#1f2937', 'color:#fff', 'font-size:0.85rem',
      'font-weight:500', 'padding:10px 22px', 'border-radius:100px',
      'opacity:0', 'transition:all 0.3s', 'pointer-events:none',
      'white-space:nowrap', 'z-index:9999'
    ].join(';');
    document.body.appendChild(toast);
  }
  toast.textContent = msg;
  toast.style.opacity = '1';
  toast.style.transform = 'translateX(-50%) translateY(0)';
  clearTimeout(toast._timer);
  toast._timer = setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(-50%) translateY(20px)';
  }, duration);
}

// Global: auto-uppercase + alphanumeric-only for tracking inputs
document.querySelectorAll('input[data-tracking]').forEach(el => {
  el.addEventListener('input', () => {
    const pos = el.selectionStart;
    el.value = el.value.toUpperCase().replace(/[^A-Z0-9]/g, '');
    el.setSelectionRange(pos, pos);
  });
});
