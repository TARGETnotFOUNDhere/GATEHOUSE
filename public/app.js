const app = document.querySelector('#app');
const toast = document.querySelector('#toast');
const storedSession = JSON.parse(localStorage.getItem('gatehouse-session') || 'null');
const state = {
  token: storedSession?.token || '',
  user: storedSession?.user || null,
  view: 'overview',
  visitors: [],
  logs: [],
  history: [],
  editingVisitor: null,
  lookupResidents: [],
  selectedResident: null,
  lookupVisitors: [],
  selectedVisitor: null,
};
let toastTimer;

const escapeHtml = (value = '') => String(value).replace(/[&<>"']/g, (char) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
}[char]));
const initials = (name = '') => name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join('').toUpperCase();
const dateLabel = (value, options = { month: 'short', day: 'numeric', year: 'numeric' }) => value ? new Intl.DateTimeFormat(undefined, options).format(new Date(value)) : '—';
const timeLabel = (value) => value ? new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' }).format(new Date(value)) : '—';
const today = () => new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' });
const isGuard = () => state.user?.role === 'guard';
const isResident = () => state.user?.role === 'resident';

// When deployed on Vercel the backend lives on Render.
// Set window.GATEHOUSE_API in index.html (injected at build/deploy time) OR
// fall back to empty string so relative /api/... paths still work locally.
const API_BASE = (typeof window !== 'undefined' && window.GATEHOUSE_API) || '';

async function api(path, options = {}) {
  const response = await fetch(API_BASE + path, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(state.token ? { Authorization: `Bearer ${state.token}` } : {}),
      ...options.headers,
    },
  });
  const body = response.status === 204 ? {} : await response.json().catch(() => ({}));
  if (!response.ok) {
    if (response.status === 401 && state.token) signOut(false);
    throw new Error(body.message || `Request failed (${response.status})`);
  }
  return body;
}

function showToast(message, kind = 'success') {
  clearTimeout(toastTimer);
  toast.textContent = message;
  toast.className = `${kind === 'error' ? 'error' : ''} show`;
  toastTimer = setTimeout(() => { toast.className = ''; }, 3200);
}

function showAuth(mode = 'login', message = '') {
  state.token = '';
  state.user = null;
  state.view = 'overview';
  state.visitors = [];
  state.logs = [];
  state.history = [];
  app.innerHTML = `
    <main class="auth-screen">
      <section class="auth-visual" aria-label="Residential community">
        <img src="https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=1700&q=85" alt="Modern home in a leafy residential community">
        <div class="brand-lockup"><span class="brand-mark">G</span><span class="brand-name">Gatehouse</span></div>
        <div class="visual-copy"><p class="eyebrow">A calmer front gate</p><h1>Good neighbors.<br>Guests expected.</h1><p>Visitor access, handled with care from the first hello.</p></div>
      </section>
      <section class="auth-panel">
        <div class="auth-form-wrap">
          <p class="eyebrow">Community access</p>
          <h2>${mode === 'login' ? 'Welcome back' : 'Create your account'}</h2>
          <p class="auth-intro">${mode === 'login' ? 'Sign in to manage arrivals and keep your community moving.' : 'Set up resident access for your community.'}</p>
          <div class="auth-tabs" role="tablist" aria-label="Account access">
            <button class="auth-tab ${mode === 'login' ? 'active' : ''}" type="button" role="tab" aria-selected="${mode === 'login'}" data-action="auth-mode" data-mode="login">Sign in</button>
            <button class="auth-tab ${mode === 'register' ? 'active' : ''}" type="button" role="tab" aria-selected="${mode === 'register'}" data-action="auth-mode" data-mode="register">Create account</button>
          </div>
          <form id="auth-form" data-mode="${mode}">
            ${mode === 'register' ? `
              <div class="field-grid">
                <div class="field full"><label for="auth-name">Full name</label><input id="auth-name" name="name" autocomplete="name" required placeholder="Your name"></div>
                <div class="field"><label for="auth-phone">Phone</label><input id="auth-phone" name="phone" autocomplete="tel" inputmode="tel" pattern="[0-9+() -]{10,18}" required placeholder="10-digit number"></div>
                <div class="field"><label for="auth-role">Account type</label><select id="auth-role" name="role"><option value="resident">Resident</option><option value="guard">Security guard</option></select></div>
                <div class="field full" data-role-field="resident"><label for="auth-flat">Flat number</label><input id="auth-flat" name="flatNumber" autocomplete="off" placeholder="e.g. B-204"></div>
                <div class="field full" data-role-field="guard" hidden><label for="auth-guard-key">Guard registration key</label><input id="auth-guard-key" name="guardKey" autocomplete="off" placeholder="Provided by your administrator"></div>
                <div class="field full"><label for="auth-email">Email address</label><input id="auth-email" name="email" type="email" autocomplete="email" required placeholder="you@example.com"></div>
                <div class="field full"><label for="auth-password">Password</label><input id="auth-password" name="password" type="password" autocomplete="new-password" minlength="6" required placeholder="At least 6 characters"></div>
              </div>
              <p class="form-note">Guard accounts require a registration key from your administrator.</p>
            ` : `
              <div class="field"><label for="auth-email">Email address</label><input id="auth-email" name="email" type="email" autocomplete="email" required placeholder="you@example.com"></div>
              <div class="field"><label for="auth-password">Password</label><input id="auth-password" name="password" type="password" autocomplete="current-password" required placeholder="Your password"></div>
            `}
            <p class="auth-error" id="auth-error" role="alert">${escapeHtml(message)}</p>
            <button class="primary-button wide-button" type="submit">${mode === 'login' ? 'Sign in to Gatehouse' : 'Create account'}</button>
          </form>
          <p class="auth-footnote">Your access is private to your role. Residents manage their own guests; guards manage the entry register.</p>
        </div>
      </section>
    </main>`;
  app.querySelector('.auth-visual img')?.addEventListener('error', (event) => event.currentTarget.remove());
}

function navItems() {
  return isResident()
    ? [{ id: 'overview', label: 'Overview', mark: '01' }, { id: 'guests', label: 'My guests', mark: '02' }, { id: 'history', label: 'Visit history', mark: '03' }]
    : [{ id: 'overview', label: 'Overview', mark: '01' }, { id: 'entry', label: 'Entry desk', mark: '02' }, { id: 'register', label: 'Live register', mark: '03' }];
}

function renderApp() {
  if (!state.user) return showAuth();
  const currentLabel = navItems().find((item) => item.id === state.view)?.label || 'Overview';
  app.innerHTML = `
    <div class="app-shell">
      <aside class="sidebar">
        <div class="brand-lockup"><span class="brand-mark">G</span><span><span class="brand-name">Gatehouse</span><span class="brand-subtitle">COMMUNITY ACCESS</span></span></div>
        <p class="side-label">Workspace</p>
        <nav class="nav-list" aria-label="Main navigation">
          ${navItems().map((item) => `<button class="nav-button ${state.view === item.id ? 'active' : ''}" type="button" data-action="navigate" data-view="${item.id}" ${state.view === item.id ? 'aria-current="page"' : ''}><span class="nav-symbol">${item.mark}</span>${item.label}</button>`).join('')}
        </nav>
        <div class="sidebar-foot">
          <div class="profile-block"><span class="avatar">${escapeHtml(initials(state.user.name))}</span><div><div class="profile-name">${escapeHtml(state.user.name)}</div><div class="profile-role">${escapeHtml(state.user.role)}</div></div></div>
          <button class="logout-button" type="button" data-action="logout">Sign out</button>
        </div>
      </aside>
      <main class="main-area">
        <header class="topbar"><div class="breadcrumb">Gatehouse <span aria-hidden="true">/</span> <strong>${escapeHtml(currentLabel)}</strong></div><div class="topbar-actions"><time class="topbar-date">${escapeHtml(today())}</time><button class="quiet-button topbar-signout" type="button" data-action="logout">Sign out</button></div></header>
        <section class="page-content" id="page-content">${pageMarkup()}</section>
      </main>
    </div>`;
}

function pageHeading(title, description, action = '') {
  return `<div class="page-heading"><div><p class="eyebrow">${isGuard() ? 'Security desk' : 'Resident portal'}</p><h1>${title}</h1><p>${description}</p></div>${action ? `<div class="heading-actions">${action}</div>` : ''}</div>`;
}

function statGrid(items) {
  return `<div class="stat-grid">${items.map((item) => `<div class="stat-item"><div class="stat-label">${escapeHtml(item.label)}<span class="stat-dot" style="background:${item.color || 'var(--rust)'}"></span></div><div class="stat-value">${escapeHtml(item.value)}</div></div>`).join('')}</div>`;
}

function emptyRow(columns, title, detail) {
  return `<tr><td colspan="${columns}" class="empty-state"><strong>${escapeHtml(title)}</strong>${escapeHtml(detail)}</td></tr>`;
}

function visitorRows(visitors, actions = false) {
  if (!visitors.length) return emptyRow(actions ? 5 : 4, 'No guests yet', 'Approved guests will appear here.');
  return visitors.map((visitor) => `<tr>
    <td><span class="cell-primary">${escapeHtml(visitor.name)}</span><span class="cell-sub">${escapeHtml(visitor.phone)}</span></td>
    <td>${escapeHtml(visitor.purpose || '—')}</td>
    <td>${dateLabel(visitor.expectedDate)}</td>
    <td><span class="status-pill ${visitor.isPreApproved ? '' : 'denied'}">${visitor.isPreApproved ? 'Approved' : 'Not approved'}</span></td>
    ${actions ? `<td><button class="table-action" type="button" data-action="edit-visitor" data-id="${escapeHtml(visitor._id)}">Edit</button> <button class="table-action delete" type="button" data-action="delete-visitor" data-id="${escapeHtml(visitor._id)}">Remove</button></td>` : ''}
  </tr>`).join('');
}

function logRows(logs, includeAction = false) {
  if (!logs.length) return emptyRow(includeAction ? 5 : 4, 'No visits recorded', 'New visitor activity will appear here.');
  return logs.map((log) => {
    const visitor = log.visitor || {};
    const resident = log.resident || {};
    const status = log.status || 'entered';
    return `<tr>
      <td><span class="cell-primary">${escapeHtml(visitor.name || 'Visitor')}</span><span class="cell-sub">${escapeHtml(visitor.phone || '')}</span></td>
      <td><span class="cell-primary">${escapeHtml(resident.name || 'Resident')}</span><span class="cell-sub">${escapeHtml(resident.flatNumber || '')}</span></td>
      <td>${dateLabel(log.entryTime, { month: 'short', day: 'numeric' })}<span class="cell-sub">${timeLabel(log.entryTime)}</span></td>
      <td><span class="status-pill ${escapeHtml(status)}">${escapeHtml(status)}</span></td>
      ${includeAction ? `<td>${status === 'entered' ? `<button class="table-action" type="button" data-action="mark-exit" data-id="${escapeHtml(log._id)}">Mark exit</button>` : '—'}</td>` : ''}
    </tr>`;
  }).join('');
}

function logTable(logs, includeAction = false) {
  return `<div class="data-panel table-wrap"><table><thead><tr><th>Visitor</th><th>Resident</th><th>Arrival</th><th>Status</th>${includeAction ? '<th>Action</th>' : ''}</tr></thead><tbody>${logRows(logs, includeAction)}</tbody></table></div>`;
}

function residentOverview() {
  const active = state.history.filter((log) => log.status === 'entered').length;
  const approved = state.visitors.filter((visitor) => visitor.isPreApproved).length;
  const greeting = new Date().getHours() < 12 ? 'Good morning' : new Date().getHours() < 18 ? 'Good afternoon' : 'Good evening';
  return `
    <section class="welcome-band"><div class="welcome-copy"><p class="eyebrow">Your community, in view</p><h1>${greeting}, ${escapeHtml(state.user.name.split(' ')[0])}.</h1><p>Keep expected guests close and your visit history clear.</p></div><button class="primary-button welcome-action" type="button" data-action="navigate" data-view="guests">+ Pre-approve a guest</button></section>
    ${statGrid([{ label: 'Approved guests', value: approved, color: 'var(--gold)' }, { label: 'Guest profiles', value: state.visitors.length, color: 'var(--rust)' }, { label: 'Currently inside', value: active, color: '#6a98a4' }])}
    <div class="section-heading"><h2>Recent visit history</h2><button class="quiet-button" type="button" data-action="navigate" data-view="history">View all</button></div>
    ${logTable(state.history.slice(0, 6))}`;
}

function guestPage() {
  const visitor = state.editingVisitor || {};
  const editing = Boolean(state.editingVisitor);
  return `${pageHeading(editing ? 'Update guest' : 'My guests', 'Pre-approve expected visitors and keep their details current.', `<button class="quiet-button" type="button" data-action="refresh">Refresh</button>`)}
    <div class="workspace-grid">
      <section class="data-panel form-panel"><h2 class="panel-title">${editing ? 'Edit guest details' : 'Pre-approve a guest'}</h2><p class="panel-description">Add a visitor to your approved list. Security can verify them at the entry desk.</p>
        <form data-form="visitor">
          <div class="field"><label for="guest-name">Visitor name</label><input id="guest-name" name="name" required value="${escapeHtml(visitor.name || '')}" placeholder="Full name"></div>
          <div class="field"><label for="guest-phone">Phone number</label><input id="guest-phone" name="phone" inputmode="tel" pattern="[0-9+() -]{10,18}" required value="${escapeHtml(visitor.phone || '')}" placeholder="10-digit number"></div>
          <div class="field"><label for="guest-purpose">Purpose of visit</label><input id="guest-purpose" name="purpose" value="${escapeHtml(visitor.purpose || '')}" placeholder="e.g. Family visit"></div>
          <div class="field"><label for="guest-date">Expected date</label><input id="guest-date" name="expectedDate" type="date" value="${visitor.expectedDate ? escapeHtml(new Date(visitor.expectedDate).toISOString().slice(0, 10)) : ''}"></div>
          <div class="two-column">
            <div class="field"><label for="guest-email">Email <span class="cell-sub">Optional</span></label><input id="guest-email" name="email" type="email" value="${escapeHtml(visitor.email || '')}" placeholder="guest@email.com"></div>
            <div class="field"><label for="guest-vehicle">Vehicle <span class="cell-sub">Optional</span></label><input id="guest-vehicle" name="vehicleNumber" value="${escapeHtml(visitor.vehicleNumber || '')}" placeholder="Plate number"></div>
          </div>
          <div class="form-actions"><button class="primary-button" type="submit">${editing ? 'Save changes' : 'Approve guest'}</button>${editing ? '<button class="quiet-button" type="button" data-action="cancel-edit">Cancel</button>' : ''}</div>
        </form>
      </section>
      <section><div class="section-heading"><h2>Approved list</h2><span>${state.visitors.length} guest${state.visitors.length === 1 ? '' : 's'}</span></div>
        <div class="data-panel table-wrap"><table><thead><tr><th>Visitor</th><th>Purpose</th><th>Expected</th><th>Approval</th><th>Manage</th></tr></thead><tbody>${visitorRows(state.visitors, true)}</tbody></table></div>
      </section>
    </div>`;
}

function historyPage() {
  return `${pageHeading('Visit history', 'A record of guest arrivals linked to your home.', '<button class="quiet-button" type="button" data-action="refresh">Refresh</button>')}
    <div class="section-heading"><h2>All recorded visits</h2><span>${state.history.length} record${state.history.length === 1 ? '' : 's'}</span></div>${logTable(state.history)}`;
}

function guardOverview() {
  const active = state.logs.filter((log) => log.status === 'entered');
  const visitsToday = state.logs.filter((log) => new Date(log.entryTime).toDateString() === new Date().toDateString()).length;
  return `${pageHeading('Entry overview', 'A clear view of arrivals and the live register.', '<button class="primary-button" type="button" data-action="navigate" data-view="entry">+ Log an arrival</button>')}
    ${statGrid([{ label: 'Currently inside', value: active.length, color: 'var(--gold)' }, { label: 'Visits today', value: visitsToday, color: 'var(--rust)' }, { label: 'Recent records', value: state.logs.length, color: '#6a98a4' }])}
    <div class="section-heading"><h2>Recent activity</h2><button class="quiet-button" type="button" data-action="navigate" data-view="register">Open register</button></div>${logTable(state.logs.slice(0, 8), true)}`;
}

function entryPage() {
  const residentCards = state.lookupResidents.map((resident) => `<div class="lookup-card"><div><strong>${escapeHtml(resident.name)}</strong><small>Flat ${escapeHtml(resident.flatNumber)} · ${escapeHtml(resident.phone)}</small></div><button type="button" class="table-action" data-action="choose-resident" data-id="${escapeHtml(resident._id)}">Select</button></div>`).join('');
  const visitorCards = state.lookupVisitors.map((visitor) => {
    const belongs = visitor.resident?._id === state.selectedResident?._id;
    return `<div class="lookup-card"><div><strong>${escapeHtml(visitor.name)}</strong><small>${escapeHtml(visitor.phone)} · ${escapeHtml(visitor.resident?.name || 'Resident')} · ${escapeHtml(visitor.resident?.flatNumber || '')}</small></div><button type="button" class="table-action" data-action="choose-visitor" data-id="${escapeHtml(visitor._id)}" ${belongs ? '' : 'disabled'}>${belongs ? 'Select' : 'Different resident'}</button></div>`;
  }).join('');
  const selected = state.selectedResident && state.selectedVisitor
    ? `<div class="entry-selection"><strong>Ready to log:</strong> ${escapeHtml(state.selectedVisitor.name)} visiting ${escapeHtml(state.selectedResident.name)} · ${escapeHtml(state.selectedResident.flatNumber)}</div>`
    : state.selectedResident ? `<div class="entry-selection"><strong>Resident selected:</strong> ${escapeHtml(state.selectedResident.name)} · ${escapeHtml(state.selectedResident.flatNumber)}. Find the visitor by phone to continue.</div>` : '';
  return `${pageHeading('Log a visitor', 'Verify the resident and match an approved visitor before recording entry.')}
    <div class="workspace-grid">
      <section class="data-panel form-panel"><h2 class="panel-title">Arrival details</h2><p class="panel-description">Only visitors pre-approved for the selected resident can be logged.</p>
        <form class="inline-form" data-form="resident-lookup"><div class="field"><label for="resident-flat">Find resident by flat</label><input class="lookup-input" id="resident-flat" name="flatNumber" required placeholder="e.g. A-101"></div><button class="secondary-button" type="submit">Find</button></form>
        <div class="lookup-result">${residentCards || (state.lookupResidents.length === 0 && state.selectedResident ? '' : '')}</div>
        ${state.selectedResident ? `<div class="entry-section"><form class="inline-form" data-form="visitor-lookup"><div class="field"><label for="lookup-phone">Find approved visitor by phone</label><input class="lookup-input" id="lookup-phone" name="phone" inputmode="tel" required placeholder="Visitor phone number"></div><button class="secondary-button" type="submit">Search</button></form><div class="lookup-result">${visitorCards}</div></div>` : ''}
        ${selected}
        ${state.selectedResident && state.selectedVisitor ? `<div class="form-actions entry-section"><button class="primary-button" type="button" data-action="log-entry">Log arrival</button><button class="quiet-button" type="button" data-action="clear-selection">Clear</button></div>` : ''}
      </section>
      <section><div class="section-heading"><h2>Open entries</h2><span>${state.logs.filter((log) => log.status === 'entered').length} active</span></div>${logTable(state.logs.filter((log) => log.status === 'entered'), true)}
        <div class="callout" style="margin-top:12px"><span class="callout-mark">i</span><span>Visitors must be pre-approved by their resident before arrival can be recorded.</span></div>
      </section>
    </div>`;
}

function registerPage() {
  const active = state.logs.filter((log) => log.status === 'entered');
  return `${pageHeading('Live register', 'Track every visitor currently on the property and record departures.', '<button class="quiet-button" type="button" data-action="refresh">Refresh</button>')}
    <div class="section-heading"><h2>Currently on site</h2><span>${active.length} active</span></div>${logTable(active, true)}
    <div class="section-heading" style="margin-top:28px"><h2>Recent arrivals</h2><span>Latest 100 records</span></div>${logTable(state.logs.slice(0, 100), true)}`;
}

function pageMarkup() {
  if (isResident()) {
    if (state.view === 'guests') return guestPage();
    if (state.view === 'history') return historyPage();
    return residentOverview();
  }
  if (state.view === 'entry') return entryPage();
  if (state.view === 'register') return registerPage();
  return guardOverview();
}

async function refreshData() {
  const requests = isResident()
    ? [api('/api/visitors/mine'), api(`/api/residents/${encodeURIComponent(state.user.id)}/visitor-logs`)]
    : [api('/api/visitor-logs')];
  const results = await Promise.all(requests);
  if (isResident()) {
    state.visitors = results[0].data || [];
    state.history = results[1].data || [];
  } else {
    state.logs = results[0].data || [];
  }
}

async function enterApp() {
  try {
    await refreshData();
    renderApp();
  } catch (error) {
    showAuth('login', error.message);
  }
}

function signOut(showMessage = true) {
  localStorage.removeItem('gatehouse-session');
  state.token = '';
  state.user = null;
  state.visitors = [];
  state.logs = [];
  state.history = [];
  showAuth();
  if (showMessage) showToast('You have signed out.');
}

async function handleAuth(form) {
  const values = Object.fromEntries(new FormData(form).entries());
  const errorNode = document.querySelector('#auth-error');
  const submit = form.querySelector('[type="submit"]');
  submit.disabled = true;
  submit.textContent = 'Please wait…';
  if (errorNode) errorNode.textContent = '';
  try {
    if (form.dataset.mode === 'register') {
      await api('/api/auth/register', { method: 'POST', body: JSON.stringify(values) });
      showAuth('login', 'Account created. Sign in to continue.');
      document.querySelector('#auth-email').value = values.email;
      return;
    }
    const result = await api('/api/auth/login', { method: 'POST', body: JSON.stringify(values) });
    state.token = result.data.token;
    state.user = result.data.user;
    state.view = 'overview';
    localStorage.setItem('gatehouse-session', JSON.stringify({ token: state.token, user: state.user }));
    await enterApp();
  } catch (error) {
    const target = document.querySelector('#auth-error');
    if (target) target.textContent = error.message;
    else showAuth('login', error.message);
  } finally {
    const currentSubmit = document.querySelector('#auth-form [type="submit"]');
    if (currentSubmit) {
      currentSubmit.disabled = false;
      currentSubmit.textContent = currentSubmit.closest('form').dataset.mode === 'login' ? 'Sign in to Gatehouse' : 'Create account';
    }
  }
}

async function handleVisitorForm(form) {
  const values = Object.fromEntries(new FormData(form).entries());
  Object.keys(values).forEach((key) => { if (!values[key]) delete values[key]; });
  if (values.expectedDate) values.expectedDate = new Date(`${values.expectedDate}T12:00:00`).toISOString();
  const path = state.editingVisitor ? `/api/visitors/${encodeURIComponent(state.editingVisitor._id)}` : '/api/visitors/preapprove';
  try {
    const result = await api(path, { method: state.editingVisitor ? 'PUT' : 'POST', body: JSON.stringify(values) });
    state.editingVisitor = null;
    await refreshData();
    renderApp();
    showToast(result.message || 'Guest saved.');
  } catch (error) { showToast(error.message, 'error'); }
}

async function findResident(form) {
  const flatNumber = new FormData(form).get('flatNumber');
  try {
    const result = await api(`/api/residents?flatNumber=${encodeURIComponent(flatNumber)}`);
    state.lookupResidents = result.data || [];
    state.selectedResident = null;
    state.lookupVisitors = [];
    state.selectedVisitor = null;
    renderApp();
    if (!state.lookupResidents.length) showToast('No resident found for that flat.', 'error');
    else if (state.lookupResidents.length === 1) {
      state.selectedResident = state.lookupResidents[0];
      renderApp();
    }
  } catch (error) { showToast(error.message, 'error'); }
}

async function findVisitors(form) {
  const phone = new FormData(form).get('phone');
  try {
    const residentId = state.selectedResident?._id || '';
    const query = `/api/visitors?phone=${encodeURIComponent(phone)}${residentId ? `&residentId=${encodeURIComponent(residentId)}` : ''}`;
    const result = await api(query);
    state.lookupVisitors = (result.data || []).filter((visitor) => visitor.isPreApproved);
    state.selectedVisitor = null;
    renderApp();
    if (!state.lookupVisitors.length) showToast('No approved visitor found for that phone.', 'error');
  } catch (error) { showToast(error.message, 'error'); }
}

async function logEntry() {
  if (!state.selectedResident || !state.selectedVisitor) return;
  try {
    const result = await api('/api/visitor-logs', {
      method: 'POST',
      body: JSON.stringify({ residentId: state.selectedResident._id, visitorId: state.selectedVisitor._id, status: 'entered' }),
    });
    state.selectedResident = null;
    state.selectedVisitor = null;
    state.lookupResidents = [];
    state.lookupVisitors = [];
    await refreshData();
    renderApp();
    showToast(result.message || 'Arrival logged.');
  } catch (error) { showToast(error.message, 'error'); }
}

async function handleSubmit(event) {
  const form = event.target;
  if (!(form instanceof HTMLFormElement)) return;
  event.preventDefault();
  if (form.id === 'auth-form') return handleAuth(form);
  if (form.dataset.form === 'visitor') return handleVisitorForm(form);
  if (form.dataset.form === 'resident-lookup') return findResident(form);
  if (form.dataset.form === 'visitor-lookup') return findVisitors(form);
}

async function handleClick(event) {
  const button = event.target.closest('[data-action]');
  if (!button) return;
  const { action } = button.dataset;
  if (action === 'auth-mode') return showAuth(button.dataset.mode);
  if (action === 'logout') return signOut();
  if (action === 'navigate') {
    state.view = button.dataset.view;
    if (state.view === 'entry') {
      state.selectedResident = null; state.selectedVisitor = null; state.lookupResidents = []; state.lookupVisitors = [];
    }
    renderApp();
    return;
  }
  if (action === 'refresh') {
    try { await refreshData(); renderApp(); showToast('Information refreshed.'); }
    catch (error) { showToast(error.message, 'error'); }
    return;
  }
  if (action === 'cancel-edit') { state.editingVisitor = null; renderApp(); return; }
  if (action === 'edit-visitor') {
    state.editingVisitor = state.visitors.find((item) => item._id === button.dataset.id) || null;
    renderApp();
    document.querySelector('#guest-name')?.focus();
    return;
  }
  if (action === 'delete-visitor') {
    const visitor = state.visitors.find((item) => item._id === button.dataset.id);
    if (!visitor || !confirm(`Remove ${visitor.name} from your approved guests?`)) return;
    try {
      const result = await api(`/api/visitors/${encodeURIComponent(visitor._id)}`, { method: 'DELETE' });
      await refreshData(); renderApp(); showToast(result.message || 'Guest removed.');
    } catch (error) { showToast(error.message, 'error'); }
    return;
  }
  if (action === 'choose-resident') {
    state.selectedResident = state.lookupResidents.find((item) => item._id === button.dataset.id) || null;
    state.lookupVisitors = []; state.selectedVisitor = null;
    renderApp();
    return;
  }
  if (action === 'choose-visitor') {
    const visitor = state.lookupVisitors.find((item) => item._id === button.dataset.id);
    if (visitor?.resident?._id === state.selectedResident?._id) state.selectedVisitor = visitor;
    renderApp();
    return;
  }
  if (action === 'clear-selection') {
    state.lookupResidents = []; state.selectedResident = null; state.lookupVisitors = []; state.selectedVisitor = null;
    renderApp();
    return;
  }
  if (action === 'log-entry') return logEntry();
  if (action === 'mark-exit') {
    try {
      const result = await api(`/api/visitor-logs/${encodeURIComponent(button.dataset.id)}/exit`, { method: 'PATCH' });
      await refreshData(); renderApp(); showToast(result.message || 'Exit recorded.');
    } catch (error) { showToast(error.message, 'error'); }
  }
}

function handleChange(event) {
  if (event.target.id !== 'auth-role') return;
  const role = event.target.value;
  document.querySelectorAll('[data-role-field]').forEach((field) => {
    field.hidden = field.dataset.roleField !== role;
    const input = field.querySelector('input');
    if (input) input.required = field.dataset.roleField === role;
  });
}

document.addEventListener('submit', handleSubmit);
document.addEventListener('click', handleClick);
document.addEventListener('change', handleChange);

if (state.token && state.user) enterApp();
else showAuth();
