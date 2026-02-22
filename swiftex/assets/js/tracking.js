// ══════════════════════════════════════════════
// TRACKING.JS — Full tracking page logic
// ══════════════════════════════════════════════

let currentTrackingId = null;
let realtimeChannel = null;

// ── Boot ──
document.addEventListener('DOMContentLoaded', () => {
  const params = new URLSearchParams(window.location.search);
  const id = params.get('id');
  if (id) {
    currentTrackingId = id.toUpperCase();
    loadTracking(currentTrackingId);
  } else {
    showError();
  }

  // Nav search pre-fill
  if (document.getElementById('navSearchInput')) {
    document.getElementById('navSearchInput').value = currentTrackingId || '';
  }

  document.getElementById('year') && (document.getElementById('year').textContent = new Date().getFullYear());
});

// ── Navbar search ──
function searchFromNav() {
  const val = (document.getElementById('navSearchInput')?.value || '').trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (val.length === 12) {
    window.location.href = `track.html?id=${val}`;
  } else {
    showToast('Please enter a valid 12-character Tracking ID');
  }
}

// ── Load tracking data ──
async function loadTracking(trackingId) {
  showLoading();
  try {
    // Fetch shipment
    const { data: shipment, error: shipErr } = await supabaseClient
      .from('shipments')
      .select('*')
      .eq('tracking_id', trackingId)
      .single();

    if (shipErr || !shipment) {
      showError();
      return;
    }

    // Fetch events
    const { data: events, error: evtErr } = await supabaseClient
      .from('tracking_events')
      .select('*')
      .eq('tracking_id', trackingId)
      .order('timestamp', { ascending: false });

    renderTracking(shipment, events || []);
    showResults();
    subscribeRealtime(trackingId);

  } catch (err) {
    console.error('Tracking load error:', err);
    showError();
  }
}

// ── Render everything ──
function renderTracking(shipment, events) {
  // Tracking ID
  document.getElementById('displayTrackingId').textContent = shipment.tracking_id;
  document.title = `${shipment.tracking_id} — SwiftEx`;

  // Status badge
  const statusEl = document.getElementById('statusCard');
  const badge = document.getElementById('statusBadge');
  const icon = document.getElementById('statusIcon');
  const text = document.getElementById('statusText');
  const datetime = document.getElementById('statusDatetime');

  const statusConfig = getStatusConfig(shipment.status);
  badge.className = `status-badge status-${shipment.status}`;
  icon.innerHTML = statusConfig.icon;
  icon.title = statusConfig.label;
  text.textContent = statusConfig.label;

  // Latest event datetime
  if (events.length > 0) {
    datetime.textContent = formatDateTime(events[0].timestamp);
  }

  // Signed by (if delivered)
  if (shipment.status === 'delivered') {
    document.getElementById('statusSigned').style.display = 'block';
    document.getElementById('signedBy').textContent = shipment.signed_by || 'AUTHORITY TO LEAVE';
  }

  // Delivery details message
  if (shipment.delivery_message) {
    const ddCard = document.getElementById('deliveryDetailsCard');
    ddCard.style.display = 'block';
    document.getElementById('deliveryDetailsText').textContent = shipment.delivery_message;
  }

  // Route
  document.getElementById('routeFrom').textContent = shipment.origin || '—';
  document.getElementById('routeTo').textContent = shipment.destination || '—';
  document.getElementById('serviceType').textContent = capitalize(shipment.service_type || 'Standard');
  document.getElementById('estDelivery').textContent = shipment.estimated_delivery
    ? formatDate(shipment.estimated_delivery)
    : 'Pending';
  document.getElementById('shipWeight').textContent = shipment.weight || '—';

  // Info card (right)
  document.getElementById('recipientName').textContent = shipment.recipient_name || '—';
  document.getElementById('senderName').textContent = shipment.sender_name || '—';
  document.getElementById('serviceTypeSide').textContent = capitalize(shipment.service_type || 'Standard');
  document.getElementById('weightSide').textContent = shipment.weight || '—';
  document.getElementById('createdAt').textContent = formatDate(shipment.created_at);

  // Timeline
  renderTimeline(shipment.status, events);
}

// ── Timeline rendering ──
function renderTimeline(currentStatus, events) {
  const container = document.getElementById('timelineContainer');
  container.innerHTML = '';

  // Define the standard steps in order
  const STEPS = [
    { key: 'label_created', label: 'LABEL CREATED' },
    { key: 'picked_up',     label: 'WE HAVE YOUR PACKAGE' },
    { key: 'in_transit',    label: 'ON THE WAY' },
    { key: 'out_for_delivery', label: 'OUT FOR DELIVERY' },
    { key: 'delivered',     label: 'DELIVERED' },
  ];

  // Map events to step keys
  const eventMap = {};
  events.forEach(e => {
    const key = e.event_type || mapStatusToStep(e.title);
    if (!eventMap[key]) eventMap[key] = [];
    eventMap[key].push(e);
  });

  // Find active step index
  const statusStepMap = {
    'pending': 0,
    'label_created': 0,
    'picked_up': 1,
    'in_transit': 2,
    'out_for_delivery': 3,
    'delivered': 4,
    'exception': 2, // shows on "on the way" level
  };
  const activeIdx = statusStepMap[currentStatus] ?? 0;

  STEPS.forEach((step, idx) => {
    const isCompleted = idx < activeIdx;
    const isActive = idx === activeIdx;
    const isPending = idx > activeIdx;
    const stepEvents = eventMap[step.key] || events.filter(e =>
      e.event_type === step.key || e.title?.toLowerCase().includes(step.label.toLowerCase().slice(0,6))
    );

    const item = document.createElement('div');
    item.className = `timeline-item${isCompleted ? ' completed' : ''}${isActive ? ' active' : ''}${isPending ? ' pending-step' : ''}`;
    if (isActive && currentStatus === 'exception') item.classList.add('status-exception');
    if (isActive && currentStatus === 'delivered') item.classList.add('status-delivered');

    const dotSvg = isActive
      ? `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M5 12h14M12 5l7 7-7 7"/></svg>`
      : '';

    const eventDetails = stepEvents.length > 0 ? stepEvents.map((evt, i) => `
      <div class="${i > 0 ? 'sub-event' : ''}">
        ${evt.description ? `<p class="timeline-desc">${evt.description}</p>` : ''}
        ${evt.location ? `<p class="timeline-location">📍 ${evt.location}</p>` : ''}
        <p class="timeline-time">${formatDateTime(evt.timestamp)}</p>
        ${i === 0 && stepEvents.length > 1 ? `<span class="view-details-link" onclick="this.parentElement.parentElement.classList.toggle('expanded')">View more details</span>` : ''}
      </div>
    `).join('') : '';

    item.innerHTML = `
      <div class="timeline-dot">${dotSvg}</div>
      <div class="timeline-content">
        <div class="timeline-content-inner">
          <div class="timeline-title">${step.label}</div>
          ${eventDetails}
        </div>
      </div>
    `;
    container.appendChild(item);
  });

  // Handle exception status - add as extra item after active
  if (currentStatus === 'exception') {
    const exceptEvts = events.filter(e => e.event_type === 'exception');
    if (exceptEvts.length > 0) {
      const excItem = document.createElement('div');
      excItem.className = 'timeline-item active status-exception';
      excItem.innerHTML = `
        <div class="timeline-dot">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/></svg>
        </div>
        <div class="timeline-content">
          <div class="timeline-content-inner">
            <div class="timeline-title">EXCEPTION</div>
            <p class="timeline-desc">${exceptEvts[0].description || 'Delivery exception - see details'}</p>
            <p class="timeline-location">${exceptEvts[0].location || ''}</p>
            <p class="timeline-time">${formatDateTime(exceptEvts[0].timestamp)}</p>
          </div>
        </div>
      `;
      container.insertBefore(excItem, container.children[3]);
    }
  }
}

// ── Realtime subscription (auto-update on admin push) ──
function subscribeRealtime(trackingId) {
  if (realtimeChannel) supabaseClient.removeChannel(realtimeChannel);

  realtimeChannel = supabaseClient
    .channel(`tracking:${trackingId}`)
    .on('postgres_changes', {
      event: 'INSERT',
      schema: 'public',
      table: 'tracking_events',
      filter: `tracking_id=eq.${trackingId}`
    }, (payload) => {
      showToast('📦 New update on your shipment!');
      setTimeout(() => loadTracking(trackingId), 500);
    })
    .on('postgres_changes', {
      event: 'UPDATE',
      schema: 'public',
      table: 'shipments',
      filter: `tracking_id=eq.${trackingId}`
    }, () => {
      loadTracking(trackingId);
    })
    .subscribe();
}

// ── Email subscription ──
async function subscribeEmail() {
  const email = document.getElementById('subscribeEmail').value.trim();
  const feedback = document.getElementById('subscribeFeedback');

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    feedback.className = 'subscribe-feedback error';
    feedback.textContent = 'Please enter a valid email address.';
    return;
  }

  const btn = document.querySelector('.submit-btn');
  btn.textContent = '...';
  btn.disabled = true;

  try {
    const { error } = await supabaseClient
      .from('email_subscribers')
      .upsert({ tracking_id: currentTrackingId, email, is_active: true }, { onConflict: 'tracking_id,email' });

    if (error) throw error;

    feedback.className = 'subscribe-feedback success';
    feedback.textContent = '✓ You\'re subscribed! We\'ll email you on every update.';
    document.getElementById('subscribeEmail').value = '';

    // Also send a welcome confirmation email (via API)
    try {
      await fetch(`${APP_CONFIG.apiBase}/send-email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'subscription_confirm', email, trackingId: currentTrackingId })
      });
    } catch (_) { /* SMTP may not be configured yet */ }

  } catch (err) {
    feedback.className = 'subscribe-feedback error';
    if (err.code === '23505') {
      feedback.textContent = 'You\'re already subscribed to this shipment.';
    } else {
      feedback.textContent = 'Failed to subscribe. Please try again.';
    }
  } finally {
    btn.textContent = 'SUBMIT';
    btn.disabled = false;
  }
}

// ── Helpers ──
function getStatusConfig(status) {
  const map = {
    pending:          { label: 'Pending',           icon: '⏳' },
    label_created:    { label: 'Label Created',      icon: '🏷️' },
    picked_up:        { label: 'Picked Up',          icon: '📦' },
    in_transit:       { label: 'In Transit',         icon: '🚚' },
    out_for_delivery: { label: 'Out for Delivery',   icon: '🛵' },
    delivered:        { label: 'Delivered',          icon: '✅' },
    exception:        { label: 'Delivery Exception', icon: '⚠️' },
  };
  return map[status] || { label: capitalize(status), icon: '📦' };
}

function mapStatusToStep(title = '') {
  const t = title.toLowerCase();
  if (t.includes('label') || t.includes('created')) return 'label_created';
  if (t.includes('pickup') || t.includes('have your')) return 'picked_up';
  if (t.includes('way') || t.includes('transit') || t.includes('facility')) return 'in_transit';
  if (t.includes('out for') || t.includes('delivery')) return 'out_for_delivery';
  if (t.includes('delivered')) return 'delivered';
  return 'in_transit';
}

function formatDateTime(ts) {
  if (!ts) return '—';
  const d = new Date(ts);
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'numeric', day: 'numeric', year: '2-digit' })
    + ' at ' + d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
}

function formatDate(ts) {
  if (!ts) return '—';
  return new Date(ts).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
}

function capitalize(s) {
  if (!s) return '';
  return s.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
}

// ── UI state helpers ──
function showLoading() {
  document.getElementById('loadingState').style.display = 'flex';
  document.getElementById('errorState').style.display = 'none';
  document.getElementById('trackingResults').style.display = 'none';
}
function showError() {
  document.getElementById('loadingState').style.display = 'none';
  document.getElementById('errorState').style.display = 'flex';
  document.getElementById('trackingResults').style.display = 'none';
}
function showResults() {
  document.getElementById('loadingState').style.display = 'none';
  document.getElementById('errorState').style.display = 'none';
  document.getElementById('trackingResults').style.display = 'block';
}

// ── UI actions ──
function copyTrackingId() {
  navigator.clipboard.writeText(currentTrackingId).then(() => showToast('Tracking ID copied!'));
}
function shareTracking() {
  if (navigator.share) {
    navigator.share({ title: 'Track my SwiftEx shipment', url: window.location.href });
  } else {
    navigator.clipboard.writeText(window.location.href).then(() => showToast('Link copied!'));
  }
}
function toggleDotMenu() {
  document.getElementById('dotDropdown').classList.toggle('open');
}
function toggleUpdates() {
  const body = document.getElementById('updatesBody');
  const btn = document.getElementById('updatesToggle');
  const isHidden = body.style.display === 'none';
  body.style.display = isHidden ? 'block' : 'none';
  btn.classList.toggle('collapsed', !isHidden);
}
function downloadPOD(e) {
  e.preventDefault();
  showToast('Proof of delivery feature coming soon');
}
function reportMissing(e) {
  e.preventDefault();
  showToast('Report submitted — our team will follow up');
}
function showToast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 3000);
}

// ── Close dot menu on outside click ──
document.addEventListener('click', (e) => {
  if (!e.target.closest('.dot-menu-wrap')) {
    document.getElementById('dotDropdown')?.classList.remove('open');
  }
});

// ── Subscribe enter key ──
document.getElementById('subscribeEmail')?.addEventListener('keydown', e => {
  if (e.key === 'Enter') subscribeEmail();
});
