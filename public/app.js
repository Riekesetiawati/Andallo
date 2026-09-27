const TOKEN_KEY = 'andallo.token';
const DEFAULT_ORIGIN = { lat: -6.2383, lng: 106.9756 };
const TIME_SLOTS = ['08:00', '09:00', '10:00', '11:00', '13:00', '14:00', '15:00', '16:00', '17:00', '19:00'];
const LIFECYCLE = [
  { status: 'PENDING', label: 'Menunggu persetujuan', hint: 'Penyedia punya waktu 2 menit untuk merespons.' },
  { status: 'ACCEPTED', label: 'Diterima', hint: 'Jadwal dikunci untuk kamu.' },
  { status: 'ON_THE_WAY', label: 'Dalam perjalanan', hint: 'Penyedia menuju lokasi.' },
  { status: 'IN_PROGRESS', label: 'Sedang dikerjakan', hint: 'Layanan sedang berlangsung.' },
  { status: 'SELESAI', label: 'Selesai', hint: 'Beri rating untuk penyedia.' },
];
const NEXT_ACTION = {
  ACCEPTED: { status: 'ON_THE_WAY', label: 'Mulai perjalanan' },
  ON_THE_WAY: { status: 'IN_PROGRESS', label: 'Mulai kerjakan' },
  IN_PROGRESS: { status: 'SELESAI', label: 'Tandai selesai' },
};
const TRACKABLE = new Set(['ACCEPTED', 'ON_THE_WAY', 'IN_PROGRESS']);
const ROLE_LABEL = { customer: 'Customer', provider: 'Mitra', admin: 'Admin' };
const DEMO_ACCOUNTS = [
  { email: 'rieke@andallo.com', name: 'Rieke Setiawati', role: 'customer' },
  { email: 'mitra@andallo.com', name: 'Bara Barbershop', role: 'provider' },
  { email: 'admin@andallo.com', name: 'Admin Andallo', role: 'admin' },
];

const state = {
  token: localStorage.getItem(TOKEN_KEY),
  user: null,
  bookings: [],
  notifications: [],
  unread: 0,
  categories: [],
  origin: null,
  filters: { q: '', category: '', sort: 'distance' },
  events: null,
  maps: [],
  geoWatch: null,
  geoBookingId: null,
};

const $app = document.getElementById('app');
const $modal = document.getElementById('modal-root');

// ---------- utils ----------

const esc = (value) =>
  String(value ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const rupiah = (n) => 'Rp' + Number(n || 0).toLocaleString('id-ID');
const initials = (name) => esc((name || '?').split(/\s+/).slice(0, 2).map((w) => w[0]).join('').toUpperCase());
const fmtDate = (iso) =>
  new Date(`${iso}T00:00:00`).toLocaleDateString('id-ID', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
const fmtTime = (iso) => new Date(iso).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
const fmtRelative = (iso) => {
  const diff = (Date.now() - Date.parse(iso)) / 1000;
  if (diff < 60) return 'baru saja';
  if (diff < 3600) return `${Math.floor(diff / 60)} menit lalu`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} jam lalu`;
  return new Date(iso).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' });
};
const localIso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

const ICONS = {
  search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
  calendar: '<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>',
  bell: '<path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/>',
  pin: '<path d="M12 22s8-6.5 8-13a8 8 0 1 0-16 0c0 6.5 8 13 8 13z"/><circle cx="12" cy="9" r="3"/>',
  logout: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="m16 17 5-5-5-5M21 12H9"/>',
  grid: '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>',
  list: '<path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/>',
  store: '<path d="M3 9 5 3h14l2 6"/><path d="M4 9v11h16V9"/><path d="M9 20v-6h6v6"/>',
  users: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8"/>',
  check: '<path d="M20 6 9 17l-5-5"/>',
  x: '<path d="M18 6 6 18M6 6l12 12"/>',
  back: '<path d="m15 18-6-6 6-6"/>',
  send: '<path d="m22 2-7 20-4-9-9-4z"/><path d="M22 2 11 13"/>',
  star: '<path d="m12 2 3.1 6.3 6.9 1-5 4.9 1.2 6.8-6.2-3.2L5.8 21 7 14.2 2 9.3l6.9-1z"/>',
  menu: '<path d="M3 6h18M3 12h18M3 18h18"/>',
  locate: '<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3"/><circle cx="12" cy="12" r="8"/>',
  shield: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="m9 12 2 2 4-4"/>',
  clock: '<circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>',
  chat: '<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>',
};
const icon = (name, size = 18) =>
  `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[name]}</svg>`;
const starIcon = (size = 14) =>
  `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">${ICONS.star}</svg>`;

function toast(title, body = '', type = 'info') {
  const el = document.createElement('div');
  el.className = `toast ${type === 'error' ? 'error' : ''}`;
  el.innerHTML = `<strong>${esc(title)}</strong>${body ? `<span>${esc(body)}</span>` : ''}`;
  document.getElementById('toasts').append(el);
  setTimeout(() => el.remove(), 5000);
}

class ApiError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

async function api(path, { method = 'GET', body } = {}) {
  let res;
  try {
    res = await fetch(path, {
      method,
      headers: {
        ...(body ? { 'Content-Type': 'application/json' } : {}),
        ...(state.token ? { Authorization: `Bearer ${state.token}` } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new ApiError(0, 'Tidak dapat terhubung ke server. Periksa koneksi internet kamu.');
  }
  const data = await res.json().catch(() => ({}));
  if (res.status === 401 && state.user) {
    signOut(false);
    toast('Sesi berakhir', 'Silakan masuk kembali.', 'error');
  }
  if (!res.ok) throw new ApiError(res.status, data.error || 'Terjadi kesalahan.');
  return data;
}

// ---------- maps ----------

const mapAlive = (map) => Boolean(map) && state.maps.includes(map);

function destroyMaps() {
  for (const m of state.maps) {
    m.stop();
    m.remove();
  }
  state.maps = [];
}

function makeMap(el, center, zoom = 13) {
  if (!window.L) {
    el.innerHTML = '<div class="map-fallback">Peta tidak dapat dimuat. Periksa koneksi internet kamu.</div>';
    return null;
  }
  // Zoom animations that outlive a view change make Leaflet throw on removed maps.
  const map = L.map(el, { scrollWheelZoom: false, zoomAnimation: false, fadeAnimation: false }).setView([center.lat, center.lng], zoom);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
  }).addTo(map);
  state.maps.push(map);
  setTimeout(() => mapAlive(map) && map.invalidateSize(), 60);
  return map;
}

const pinIcon = (kind) =>
  window.L &&
  L.divIcon({
    className: '',
    html: `<div class="pin pin-${kind}"></div>`,
    iconSize: kind === 'me' ? [18, 18] : [30, 30],
    iconAnchor: kind === 'me' ? [9, 9] : [15, 30],
    popupAnchor: [0, -28],
  });

// ---------- realtime ----------

function connectEvents() {
  state.events?.close();
  if (!state.token) return;
  const es = new EventSource(`/api/events?token=${encodeURIComponent(state.token)}`);
  es.addEventListener('notification', (e) => {
    const n = JSON.parse(e.data);
    state.notifications.unshift(n);
    state.unread += 1;
    updateBell();
    toast(n.title, n.body);
  });
  es.addEventListener('booking', (e) => {
    const booking = JSON.parse(e.data);
    const idx = state.bookings.findIndex((b) => b.id === booking.id);
    if (idx >= 0) state.bookings[idx] = booking;
    else state.bookings.unshift(booking);
    onBookingChanged(booking);
  });
  es.addEventListener('chat', (e) => {
    const { bookingId, message } = JSON.parse(e.data);
    const booking = state.bookings.find((b) => b.id === bookingId);
    if (booking && !booking.chat.some((m) => m.id === message.id)) booking.chat.push(message);
    appendChatMessage(bookingId, message);
  });
  es.addEventListener('location', (e) => {
    const data = JSON.parse(e.data);
    const booking = state.bookings.find((b) => b.id === data.bookingId);
    if (booking) Object.assign(booking, { providerPos: data.providerPos, customerPos: data.customerPos });
    updateTrackingMarkers(data.bookingId);
  });
  es.onerror = () => {
    if (!state.token) es.close();
  };
  state.events = es;
}

// ---------- session ----------

async function signIn(email, password) {
  const { token, user } = await api('/api/auth/login', { method: 'POST', body: { email, password } });
  state.token = token;
  state.user = user;
  localStorage.setItem(TOKEN_KEY, token);
  await loadSessionData();
  connectEvents();
  location.hash = defaultRoute();
  render();
}

function signOut(callServer = true) {
  if (callServer && state.token) api('/api/auth/logout', { method: 'POST' }).catch(() => {});
  stopSharingLocation();
  state.events?.close();
  Object.assign(state, { token: null, user: null, bookings: [], notifications: [], unread: 0 });
  localStorage.removeItem(TOKEN_KEY);
  location.hash = '';
  render();
}

async function loadSessionData() {
  const [bookings, notifications, categories] = await Promise.all([
    api('/api/bookings'),
    api('/api/notifications'),
    api('/api/categories'),
  ]);
  state.bookings = bookings.bookings;
  state.notifications = notifications.notifications;
  state.unread = notifications.unread;
  state.categories = categories.categories;
}

const defaultRoute = () => (state.user?.role === 'admin' ? '#/admin' : state.user?.role === 'provider' ? '#/bookings' : '#/explore');

// ---------- router ----------

function parseRoute() {
  const parts = location.hash.replace(/^#\/?/, '').split('/').filter(Boolean);
  return { name: parts[0] || '', id: parts[1] || null };
}

const isStale = (route) => {
  const now = parseRoute();
  return now.name !== route.name || now.id !== route.id || !document.getElementById('view');
};

function render() {
  destroyMaps();
  closeDrawer();
  if (!state.user) return renderLogin();

  const route = parseRoute();
  const role = state.user.role;
  const allowed = {
    customer: ['explore', 'provider', 'bookings', 'booking'],
    provider: ['bookings', 'booking'],
    admin: ['admin', 'booking', 'provider'],
  }[role];
  if (!allowed.includes(route.name)) {
    location.replace(defaultRoute());
    return;
  }

  if (role === 'admin') renderAdminShell(route);
  else renderNavShell(route);

  const $view = document.getElementById('view');
  const views = {
    explore: renderExplore,
    provider: renderProviderDetail,
    bookings: renderBookings,
    booking: renderBookingDetail,
    admin: renderAdmin,
  };
  views[route.name]($view, route);
  window.scrollTo(0, 0);
}

window.addEventListener('hashchange', render);

// ---------- login ----------

function renderLogin() {
  $app.innerHTML = `
    <main class="auth">
      <section class="auth-hero">
        <div class="brand"><img src="/assets/andallo-logo.png" alt="" /> Andallo</div>
        <div class="hero-copy">
          <h1>Jasa terpercaya, <span>dekat</span> dari rumahmu.</h1>
          <p class="lead">Cari penyedia jasa terverifikasi, cek jadwal yang masih kosong, lalu pantau kedatangannya secara langsung.</p>
          <div class="auth-points">
            <div>${icon('shield')} Penyedia terverifikasi dengan harga transparan</div>
            <div>${icon('clock')} Konfirmasi pesanan maksimal 2 menit</div>
            <div>${icon('pin')} Live tracking dan chat langsung dengan penyedia</div>
          </div>
        </div>
        <p class="small" style="opacity:.6">© ${new Date().getFullYear()} Andallo</p>
      </section>
      <section class="auth-panel">
        <form class="auth-form" id="login-form" novalidate>
          <div>
            <h2>Masuk ke Andallo</h2>
            <p class="muted">Gunakan akun kamu atau pilih akun demo di bawah.</p>
          </div>
          <div class="field">
            <label for="email">Email</label>
            <input class="input" id="email" name="email" type="email" autocomplete="username" required placeholder="nama@email.com" />
          </div>
          <div class="field">
            <label for="password">Kata sandi</label>
            <input class="input" id="password" name="password" type="password" autocomplete="current-password" required placeholder="••••••••" />
          </div>
          <p class="form-error" id="login-error" role="alert"></p>
          <button class="btn btn-primary btn-block" type="submit" id="login-submit">Masuk</button>
          <div class="divider">Akun demo · kata sandi demo123</div>
          <div class="demo-accounts">
            ${DEMO_ACCOUNTS.map(
              (a) => `
              <button type="button" class="demo-account" data-email="${a.email}">
                <span class="avatar">${initials(a.name)}</span>
                <span><strong>${esc(ROLE_LABEL[a.role])}</strong><br /><span class="small muted">${esc(a.email)}</span></span>
              </button>`,
            ).join('')}
          </div>
        </form>
      </section>
    </main>`;

  const form = document.getElementById('login-form');
  const $err = document.getElementById('login-error');
  const $btn = document.getElementById('login-submit');
  const submit = async (email, password) => {
    $err.textContent = '';
    if (!email || !password) {
      $err.textContent = 'Email dan kata sandi wajib diisi.';
      return;
    }
    $btn.disabled = true;
    $btn.textContent = 'Memproses…';
    try {
      await signIn(email, password);
    } catch (err) {
      $err.textContent = err.message;
      $btn.disabled = false;
      $btn.textContent = 'Masuk';
    }
  };
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    submit(form.email.value.trim(), form.password.value);
  });
  form.querySelectorAll('.demo-account').forEach((btn) =>
    btn.addEventListener('click', () => {
      form.email.value = btn.dataset.email;
      form.password.value = 'demo123';
      submit(btn.dataset.email, 'demo123');
    }),
  );
}

// ---------- shells ----------

const pendingCount = () => state.bookings.filter((b) => b.status === 'PENDING').length;

function navLinks(route) {
  const role = state.user.role;
  const links =
    role === 'customer'
      ? [
          { href: '#/explore', label: 'Cari Jasa', icon: 'search', active: ['explore', 'provider'] },
          { href: '#/bookings', label: 'Pesanan Saya', icon: 'calendar', active: ['bookings', 'booking'] },
        ]
      : [{ href: '#/bookings', label: 'Pesanan', icon: 'calendar', active: ['bookings', 'booking'], count: pendingCount() }];
  return links
    .map(
      (l) =>
        `<a class="nav-link ${l.active.includes(route.name) ? 'active' : ''}" href="${l.href}">${icon(l.icon)} ${l.label}${
          l.count ? ` <span class="nav-count" data-pending-count>${l.count}</span>` : ''
        }</a>`,
    )
    .join('');
}

function bellButton() {
  return `<button class="btn icon-btn" id="bell" aria-label="Notifikasi">${icon('bell', 20)}<span class="bell-dot" id="bell-dot" ${
    state.unread ? '' : 'hidden'
  }>${state.unread > 9 ? '9+' : state.unread}</span></button>`;
}

function renderNavShell(route) {
  const u = state.user;
  $app.innerHTML = `
    <header class="topbar">
      <div class="topbar-inner">
        <a class="logo" href="${defaultRoute()}"><img src="/assets/andallo-logo.png" alt="" /><span>Andallo<small>${
          u.role === 'provider' ? 'Dashboard Mitra' : 'Jasa di sekitarmu'
        }</small></span></a>
        <nav class="nav" aria-label="Navigasi utama">${navLinks(route)}</nav>
        <div class="spacer"></div>
        ${bellButton()}
        <div class="user-chip">
          <span class="avatar">${initials(u.name)}</span>
          <span class="who"><strong>${esc(u.name)}</strong><span>${ROLE_LABEL[u.role]}</span></span>
        </div>
        <button class="btn btn-ghost icon-btn" id="logout" aria-label="Keluar" title="Keluar">${icon('logout')}</button>
      </div>
    </header>
    <main class="page" id="view"></main>
    <nav class="bottom-nav" aria-label="Navigasi bawah">${navLinks(route)}</nav>`;
  bindShell();
}

function renderAdminShell(route) {
  const u = state.user;
  const tab = route.name === 'admin' ? route.id || 'overview' : 'bookings';
  const links = [
    { id: 'overview', label: 'Ringkasan', icon: 'grid' },
    { id: 'bookings', label: 'Pesanan', icon: 'calendar', count: pendingCount() },
    { id: 'providers', label: 'Penyedia', icon: 'store' },
    { id: 'users', label: 'Pengguna', icon: 'users' },
  ];
  $app.innerHTML = `
    <div class="admin" id="admin-shell">
      <aside class="sidebar" aria-label="Menu admin">
        <a class="logo" href="#/admin"><img src="/assets/andallo-logo.png" alt="" /><span>Andallo<small>Panel Admin</small></span></a>
        ${links
          .map(
            (l) =>
              `<a class="side-link ${tab === l.id ? 'active' : ''}" href="#/admin${l.id === 'overview' ? '' : '/' + l.id}">${icon(l.icon)} ${l.label}${
                l.count ? `<span class="nav-count" data-pending-count>${l.count}</span>` : ''
              }</a>`,
          )
          .join('')}
        <div class="side-footer">
          <div class="user-chip"><span class="avatar">${initials(u.name)}</span><span class="who"><strong>${esc(u.name)}</strong><span>${esc(u.email)}</span></span></div>
          <button class="btn btn-ghost" id="logout">${icon('logout')} Keluar</button>
        </div>
      </aside>
      <div class="admin-main">
        <header class="topbar">
          <div class="topbar-inner">
            <button class="btn btn-ghost icon-btn admin-top" id="menu-toggle" aria-label="Buka menu">${icon('menu')}</button>
            <strong>${esc(links.find((l) => l.id === tab)?.label || 'Admin')}</strong>
            <div class="spacer"></div>
            ${bellButton()}
          </div>
        </header>
        <main class="page" id="view"></main>
      </div>
    </div>`;
  bindShell();
  const shell = document.getElementById('admin-shell');
  document.getElementById('menu-toggle').addEventListener('click', () => shell.classList.toggle('menu-open'));
  shell.addEventListener('click', (e) => {
    if (shell.classList.contains('menu-open') && !e.target.closest('.sidebar') && !e.target.closest('#menu-toggle')) {
      shell.classList.remove('menu-open');
    }
  });
}

function bindShell() {
  document.getElementById('logout').addEventListener('click', () => signOut());
  document.getElementById('bell').addEventListener('click', openNotifications);
}

function updateBell() {
  const dot = document.getElementById('bell-dot');
  if (!dot) return;
  dot.hidden = !state.unread;
  dot.textContent = state.unread > 9 ? '9+' : state.unread;
}

function updatePendingCounts() {
  const count = pendingCount();
  document.querySelectorAll('[data-pending-count]').forEach((el) => {
    el.textContent = count;
    el.hidden = !count;
  });
}

// ---------- notifications drawer ----------

function openNotifications() {
  $modal.innerHTML = `
    <div class="drawer-backdrop" id="drawer-backdrop">
      <aside class="drawer" role="dialog" aria-modal="true" aria-label="Notifikasi">
        <div class="drawer-head">
          <strong>Notifikasi</strong>
          <div class="spacer"></div>
          <button class="btn btn-ghost icon-btn" id="drawer-close" aria-label="Tutup">${icon('x')}</button>
        </div>
        <div class="drawer-body">
          ${
            state.notifications.length
              ? state.notifications
                  .map(
                    (n) => `
                <a class="notif ${n.read ? '' : 'unread'}" href="${n.bookingId ? `#/booking/${n.bookingId}` : '#'}">
                  <strong>${esc(n.title)}</strong>
                  <p>${esc(n.body)}</p>
                  <time datetime="${esc(n.createdAt)}">${fmtRelative(n.createdAt)}</time>
                </a>`,
                  )
                  .join('')
              : `<div class="empty">${icon('bell', 36)}<h3>Belum ada notifikasi</h3><p>Update pesanan, chat, dan status akan muncul di sini secara real-time.</p></div>`
          }
        </div>
      </aside>
    </div>`;
  const close = () => closeDrawer();
  document.getElementById('drawer-close').addEventListener('click', close);
  document.getElementById('drawer-backdrop').addEventListener('click', (e) => {
    if (e.target.id === 'drawer-backdrop' || e.target.closest('.notif')) close();
  });
  document.addEventListener('keydown', escClose);
  if (state.unread) {
    api('/api/notifications/read', { method: 'POST' }).catch(() => {});
    state.notifications.forEach((n) => (n.read = true));
    state.unread = 0;
    updateBell();
  }
}

function escClose(e) {
  if (e.key === 'Escape') closeDrawer();
}

function closeDrawer() {
  $modal.innerHTML = '';
  document.removeEventListener('keydown', escClose);
}

// ---------- customer: explore ----------

function requestOrigin() {
  return new Promise((resolve) => {
    if (!navigator.geolocation) return resolve(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => resolve(null),
      { timeout: 8000, maximumAge: 60000 },
    );
  });
}

function renderExplore($view) {
  const f = state.filters;
  $view.innerHTML = `
    <section class="hero-search">
      <h1>Halo, ${esc(state.user.name.split(' ')[0])}! Butuh jasa apa hari ini?</h1>
      <p>Bandingkan harga, rating, dan jarak penyedia terdekat sebelum memesan.</p>
      <form class="search-bar" id="search-form" role="search">
        <label class="sr-only" for="q">Cari jasa</label>
        <input class="input" id="q" name="q" placeholder="Cari potong rambut, cleaning, servis AC, fotografer…" value="${esc(f.q)}" />
        <button class="btn btn-accent" type="submit">${icon('search')} Cari</button>
      </form>
    </section>
    <div class="filters">
      <div class="chips" id="category-chips">
        <button class="chip ${f.category ? '' : 'active'}" data-category="">Semua</button>
        ${state.categories.map((c) => `<button class="chip ${f.category === c ? 'active' : ''}" data-category="${esc(c)}">${esc(c)}</button>`).join('')}
      </div>
      <label class="sr-only" for="sort">Urutkan</label>
      <select class="input" id="sort">
        <option value="distance" ${f.sort === 'distance' ? 'selected' : ''}>Terdekat</option>
        <option value="rating" ${f.sort === 'rating' ? 'selected' : ''}>Rating tertinggi</option>
        <option value="price_asc" ${f.sort === 'price_asc' ? 'selected' : ''}>Harga terendah</option>
        <option value="price_desc" ${f.sort === 'price_desc' ? 'selected' : ''}>Harga tertinggi</option>
      </select>
    </div>
    <div class="location-note" id="location-note"></div>
    <div class="explore">
      <section aria-label="Daftar penyedia"><div id="provider-results"></div></section>
      <aside class="card explore-map"><div class="map" id="explore-map"></div></aside>
    </div>`;

  const map = makeMap(document.getElementById('explore-map'), state.origin || DEFAULT_ORIGIN, 13);
  const layer = map ? L.layerGroup().addTo(map) : null;

  const renderLocationNote = () => {
    document.getElementById('location-note').innerHTML = state.origin
      ? `${icon('pin', 16)} Jarak dihitung dari lokasi kamu saat ini.`
      : `${icon('pin', 16)} Jarak dihitung dari pusat Bekasi. <button class="btn btn-sm" id="use-location">${icon('locate', 16)} Gunakan lokasi saya</button>`;
    document.getElementById('use-location')?.addEventListener('click', async (e) => {
      e.target.disabled = true;
      const origin = await requestOrigin();
      if (!origin) {
        toast('Lokasi tidak tersedia', 'Izinkan akses lokasi di browser untuk menghitung jarak dari posisimu.', 'error');
        e.target.disabled = false;
        return;
      }
      state.origin = origin;
      renderLocationNote();
      load();
    });
  };
  renderLocationNote();

  const $results = document.getElementById('provider-results');
  let requestId = 0;
  async function load() {
    const current = ++requestId;
    $results.innerHTML = `<div class="provider-grid">${'<div class="skeleton skeleton-card"></div>'.repeat(6)}</div>`;
    const params = new URLSearchParams({ sort: f.sort });
    if (f.q) params.set('q', f.q);
    if (f.category) params.set('category', f.category);
    if (state.origin) {
      params.set('lat', state.origin.lat);
      params.set('lng', state.origin.lng);
    }
    try {
      const { providers, origin } = await api(`/api/providers?${params}`);
      if (current !== requestId) return;
      if (!providers.length) {
        $results.innerHTML = `<div class="card empty">${icon('search', 40)}<h3>Belum ada penyedia yang cocok</h3><p>Coba kata kunci lain atau pilih kategori “Semua”.</p><button class="btn" id="reset-filters">Reset pencarian</button></div>`;
        document.getElementById('reset-filters').addEventListener('click', () => {
          Object.assign(f, { q: '', category: '' });
          render();
        });
      } else {
        $results.innerHTML = `<p class="muted small" style="margin-bottom:10px">${providers.length} penyedia ditemukan</p><div class="provider-grid">${providers.map(providerCard).join('')}</div>`;
      }
      if (layer && mapAlive(map)) {
        layer.clearLayers();
        L.marker([origin.lat, origin.lng], { icon: pinIcon('me') }).bindPopup('Lokasi kamu').addTo(layer);
        const bounds = [[origin.lat, origin.lng]];
        for (const p of providers) {
          bounds.push([p.lat, p.lng]);
          L.marker([p.lat, p.lng], { icon: pinIcon('provider') })
            .bindPopup(`<strong>${esc(p.name)}</strong><br>${esc(p.service)} · ${rupiah(p.price)}<br><a href="#/provider/${p.id}">Lihat & pesan</a>`)
            .addTo(layer);
        }
        map.fitBounds(bounds, { padding: [30, 30], maxZoom: 14 });
      }
    } catch (err) {
      if (current !== requestId) return;
      $results.innerHTML = `<div class="error-box">${esc(err.message)} <button class="btn btn-sm" id="retry">Coba lagi</button></div>`;
      document.getElementById('retry').addEventListener('click', load);
    }
  }

  document.getElementById('search-form').addEventListener('submit', (e) => {
    e.preventDefault();
    f.q = e.target.q.value.trim();
    load();
  });
  document.getElementById('category-chips').addEventListener('click', (e) => {
    const chip = e.target.closest('[data-category]');
    if (!chip) return;
    f.category = chip.dataset.category;
    document.querySelectorAll('#category-chips .chip').forEach((c) => c.classList.toggle('active', c === chip));
    load();
  });
  document.getElementById('sort').addEventListener('change', (e) => {
    f.sort = e.target.value;
    load();
  });
  $results.addEventListener('click', (e) => {
    const card = e.target.closest('[data-provider]');
    if (card) location.hash = `#/provider/${card.dataset.provider}`;
  });
  load();
}

function providerCard(p) {
  return `
    <button class="card provider-card" data-provider="${p.id}" aria-label="${esc(p.name)}, ${esc(p.service)}">
      <div class="thumb">
        <img src="${esc(p.image)}" alt="" loading="lazy" />
        <span class="distance">${p.distanceKm.toLocaleString('id-ID')} km</span>
      </div>
      <div class="body">
        <span class="muted small">${esc(p.category)}</span>
        <h3>${esc(p.name)}</h3>
        <div class="meta"><span class="stars">${starIcon()} <span>${p.rating.toFixed(1)}</span></span><span>(${p.reviews} ulasan)</span><span>·</span><span>${esc(p.city)}</span></div>
        <div class="meta"><span>${esc(p.service)}</span><span class="spacer"></span><span class="price">${rupiah(p.price)}</span></div>
      </div>
    </button>`;
}

// ---------- provider detail + booking ----------

async function renderProviderDetail($view, route) {
  $view.innerHTML = `<div class="detail"><div class="skeleton" style="height:420px"></div><div class="skeleton" style="height:520px"></div></div>`;
  let provider;
  let booked;
  try {
    const data = await api(`/api/providers/${encodeURIComponent(route.id)}`);
    provider = data.provider;
    booked = new Set(data.bookedDates);
  } catch (err) {
    if (isStale(route)) return;
    $view.innerHTML = `<div class="card empty">${icon('store', 40)}<h3>Penyedia tidak ditemukan</h3><p>${esc(err.message)}</p><a class="btn" href="${defaultRoute()}">Kembali</a></div>`;
    return;
  }
  if (isStale(route)) return;
  const origin = state.origin || DEFAULT_ORIGIN;
  const distance = haversine(origin, provider).toFixed(1);
  const isCustomer = state.user.role === 'customer';

  $view.innerHTML = `
    <a class="btn btn-ghost btn-sm" href="${isCustomer ? '#/explore' : '#/admin/providers'}" style="margin-bottom:12px">${icon('back', 16)} Kembali</a>
    <div class="detail">
      <article class="card" style="overflow:hidden">
        <div class="detail-cover"><img src="${esc(provider.image)}" alt="Foto layanan ${esc(provider.name)}" /></div>
        <div class="detail-info">
          <span class="muted small">${esc(provider.category)} · ${esc(provider.city)}</span>
          <h1>${esc(provider.name)}</h1>
          <div class="row"><span class="stars">${starIcon(16)} <span>${provider.rating.toFixed(1)}</span></span><span class="muted">${provider.reviews} ulasan</span><span class="badge badge-ACCEPTED">${esc(provider.available)}</span></div>
          <p>${esc(provider.desc)}</p>
          <dl class="kv">
            <div><dt>Layanan</dt><dd>${esc(provider.service)}</dd></div>
            <div><dt>Harga mulai</dt><dd>${rupiah(provider.price)}</dd></div>
            <div><dt>Jarak</dt><dd>${distance} km</dd></div>
          </dl>
          <div class="mini-map" id="provider-map"></div>
        </div>
      </article>
      ${isCustomer ? bookingPanel(provider) : `<aside class="card booking-panel"><h2>Jadwal terisi</h2>${booked.size ? [...booked].map((d) => `<div class="row"><span class="badge badge-REJECTED">${fmtDate(d)}</span></div>`).join('') : '<p class="muted">Belum ada jadwal terisi.</p>'}</aside>`}
    </div>`;

  const map = makeMap(document.getElementById('provider-map'), provider, 14);
  if (map) L.marker([provider.lat, provider.lng], { icon: pinIcon('provider') }).bindPopup(esc(provider.name)).addTo(map);
  if (isCustomer) bindBookingPanel(provider, booked);
}

function haversine(a, b) {
  const r = (d) => (d * Math.PI) / 180;
  const h = Math.sin(r(b.lat - a.lat) / 2) ** 2 + Math.cos(r(a.lat)) * Math.cos(r(b.lat)) * Math.sin(r(b.lng - a.lng) / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(h));
}

function bookingPanel(provider) {
  return `
    <aside class="card booking-panel">
      <h2>Pesan ${esc(provider.service)}</h2>
      <div class="calendar" id="calendar"></div>
      <div class="legend"><span><i style="background:var(--green-700)"></i>Dipilih</span><span><i style="background:#fde8e8;border:1px solid #f5c2c2"></i>Sudah terisi</span><span><i style="background:#fff;border:1px solid var(--line)"></i>Tersedia</span></div>
      <div class="field">
        <label>Jam kedatangan</label>
        <div class="times" id="times">${TIME_SLOTS.map((t) => `<button type="button" class="time" data-time="${t}">${t}</button>`).join('')}</div>
      </div>
      <div class="field">
        <label for="note">Catatan untuk penyedia <span class="muted">(opsional)</span></label>
        <textarea class="input" id="note" maxlength="500" placeholder="Contoh: potong model undercut, rumah pagar hijau."></textarea>
      </div>
      <div class="summary">
        <div><span class="muted">Tanggal</span><span id="sum-date">—</span></div>
        <div><span class="muted">Jam</span><span id="sum-time">—</span></div>
        <div><span>Total</span><strong>${rupiah(provider.price)}</strong></div>
      </div>
      <p class="form-error" id="booking-error" role="alert"></p>
      <button class="btn btn-accent btn-block" id="book-btn" disabled>Pilih tanggal & jam</button>
      <p class="muted small">Penyedia akan menerima atau menolak dalam maksimal 2 menit. Pembayaran belum terhubung payment gateway.</p>
    </aside>`;
}

function bindBookingPanel(provider, booked) {
  const selection = { date: null, time: null };
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  let month = new Date(today.getFullYear(), today.getMonth(), 1);

  const $cal = document.getElementById('calendar');
  const $btn = document.getElementById('book-btn');
  const $err = document.getElementById('booking-error');

  const refresh = () => {
    document.getElementById('sum-date').textContent = selection.date ? fmtDate(selection.date) : '—';
    document.getElementById('sum-time').textContent = selection.time || '—';
    $btn.disabled = !(selection.date && selection.time);
    $btn.textContent = $btn.disabled ? 'Pilih tanggal & jam' : 'Kirim pesanan';
  };

  const drawCalendar = () => {
    const first = new Date(month);
    const offset = (first.getDay() + 6) % 7;
    const days = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
    const isCurrentMonth = month.getFullYear() === today.getFullYear() && month.getMonth() === today.getMonth();
    let cells = '<span class="blank day"></span>'.repeat(offset);
    for (let d = 1; d <= days; d++) {
      const date = new Date(month.getFullYear(), month.getMonth(), d);
      const iso = localIso(date);
      const past = date < today;
      const isBooked = booked.has(iso);
      const cls = past ? 'past' : isBooked ? 'booked' : selection.date === iso ? 'selected' : '';
      cells += `<button type="button" class="day ${cls}" data-date="${iso}" ${past || isBooked ? 'disabled' : ''} aria-label="${fmtDate(iso)}${isBooked ? ', sudah terisi' : ''}">${d}</button>`;
    }
    $cal.innerHTML = `
      <div class="calendar-head">
        <button type="button" class="btn btn-ghost btn-sm" id="prev-month" ${isCurrentMonth ? 'disabled' : ''} aria-label="Bulan sebelumnya">${icon('back', 16)}</button>
        <strong>${month.toLocaleDateString('id-ID', { month: 'long', year: 'numeric' })}</strong>
        <button type="button" class="btn btn-ghost btn-sm" id="next-month" aria-label="Bulan berikutnya" style="transform:scaleX(-1)">${icon('back', 16)}</button>
      </div>
      <div class="calendar-grid">${['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min'].map((d) => `<span class="dow">${d}</span>`).join('')}${cells}</div>`;
    document.getElementById('prev-month').onclick = () => {
      month = new Date(month.getFullYear(), month.getMonth() - 1, 1);
      drawCalendar();
    };
    document.getElementById('next-month').onclick = () => {
      month = new Date(month.getFullYear(), month.getMonth() + 1, 1);
      drawCalendar();
    };
  };

  $cal.addEventListener('click', (e) => {
    const day = e.target.closest('[data-date]');
    if (!day || day.disabled) return;
    selection.date = day.dataset.date;
    drawCalendar();
    refresh();
  });
  document.getElementById('times').addEventListener('click', (e) => {
    const t = e.target.closest('[data-time]');
    if (!t) return;
    selection.time = t.dataset.time;
    document.querySelectorAll('#times .time').forEach((b) => b.classList.toggle('selected', b === t));
    refresh();
  });
  $btn.addEventListener('click', async () => {
    $err.textContent = '';
    $btn.disabled = true;
    $btn.textContent = 'Mengirim…';
    try {
      const { booking } = await api('/api/bookings', {
        method: 'POST',
        body: {
          providerId: provider.id,
          date: selection.date,
          time: selection.time,
          note: document.getElementById('note').value,
          destination: state.origin || undefined,
        },
      });
      if (!state.bookings.some((b) => b.id === booking.id)) state.bookings.unshift(booking);
      location.hash = `#/booking/${booking.id}`;
    } catch (err) {
      $err.textContent = err.message;
      if (err.status === 409) {
        booked.add(selection.date);
        selection.date = null;
        drawCalendar();
      }
      refresh();
    }
  });

  drawCalendar();
  refresh();
}

// ---------- bookings list ----------

const BOOKING_TABS = [
  { id: 'active', label: 'Aktif', match: (b) => ['PENDING', 'ACCEPTED', 'ON_THE_WAY', 'IN_PROGRESS'].includes(b.status) },
  { id: 'done', label: 'Selesai', match: (b) => b.status === 'SELESAI' },
  { id: 'closed', label: 'Dibatalkan / Ditolak', match: (b) => ['REJECTED', 'EXPIRED', 'CANCELLED'].includes(b.status) },
];
let bookingTab = 'active';

function renderBookings($view) {
  const isProvider = state.user.role === 'provider';
  const pending = state.bookings.filter((b) => b.status === 'PENDING');
  const tab = BOOKING_TABS.find((t) => t.id === bookingTab);
  const list = state.bookings.filter(tab.match);

  $view.innerHTML = `
    <div class="page-head">
      <div>
        <h1>${isProvider ? 'Pesanan Masuk' : 'Pesanan Saya'}</h1>
        <p>${isProvider ? 'Terima atau tolak pesanan baru dalam 2 menit, lalu perbarui status layanan.' : 'Pantau status, chat, dan live tracking semua pesananmu.'}</p>
      </div>
      ${isProvider ? '' : `<a class="btn btn-primary" href="#/explore">${icon('search')} Pesan jasa baru</a>`}
    </div>
    ${
      isProvider && pending.length
        ? `<section class="stack" style="margin-bottom:24px"><h2 style="font-size:1.05rem">Butuh respons sekarang (${pending.length})</h2><div class="booking-list">${pending.map(bookingItem).join('')}</div></section>`
        : ''
    }
    <div class="tabs" role="tablist">
      ${BOOKING_TABS.map((t) => `<button class="chip ${t.id === bookingTab ? 'active' : ''}" role="tab" aria-selected="${t.id === bookingTab}" data-tab="${t.id}">${t.label} (${state.bookings.filter(t.match).length})</button>`).join('')}
    </div>
    <div class="booking-list">
      ${
        list.length
          ? list.map(bookingItem).join('')
          : `<div class="card empty">${icon('calendar', 40)}<h3>${bookingTab === 'active' ? 'Belum ada pesanan aktif' : 'Belum ada pesanan di sini'}</h3><p>${
              isProvider ? 'Pesanan baru dari customer akan muncul otomatis secara real-time.' : 'Temukan penyedia terdekat dan pesan jadwal yang masih tersedia.'
            }</p>${isProvider ? '' : '<a class="btn btn-primary" href="#/explore">Cari jasa</a>'}</div>`
      }
    </div>`;

  $view.querySelector('.tabs').addEventListener('click', (e) => {
    const t = e.target.closest('[data-tab]');
    if (!t) return;
    bookingTab = t.dataset.tab;
    renderBookings($view);
  });
  bindBookingActions($view);
}

function bookingItem(b) {
  const isCustomer = state.user.role === 'customer';
  const who = isCustomer ? b.provider?.name : b.customer?.name;
  return `
    <article class="card booking-item" data-booking-row="${b.id}">
      <img src="${esc(b.provider?.image)}" alt="" loading="lazy" />
      <div>
        <div class="row" style="gap:8px"><h3>${esc(who)}</h3><span class="badge badge-${b.status}">${esc(b.statusLabel)}</span></div>
        <p class="muted small">#${b.id} · ${esc(b.provider?.service)} · ${fmtDate(b.date)} ${esc(b.time)} · ${rupiah(b.total)}</p>
        ${b.note ? `<p class="small" style="margin-top:4px">“${esc(b.note)}”</p>` : ''}
        ${b.status === 'PENDING' ? countdownHtml(b) : ''}
      </div>
      <div class="actions">${bookingActions(b)}</div>
    </article>`;
}

function countdownHtml(b) {
  return `<p class="small" style="margin-top:6px">Sisa waktu respons: <span class="countdown" data-countdown="${esc(b.approvalExpiresAt)}">--:--</span></p><div class="countdown-bar"><span data-countdown-bar="${esc(b.approvalExpiresAt)}"></span></div>`;
}

function bookingActions(b, { detail = false } = {}) {
  const role = state.user.role;
  const buttons = [];
  if (b.status === 'PENDING' && role !== 'customer') {
    buttons.push(`<button class="btn btn-primary btn-sm" data-decision="accept" data-id="${b.id}">${icon('check', 16)} Terima</button>`);
    buttons.push(`<button class="btn btn-danger btn-sm" data-decision="reject" data-id="${b.id}">${icon('x', 16)} Tolak</button>`);
  }
  if (NEXT_ACTION[b.status] && role !== 'customer') {
    buttons.push(`<button class="btn btn-primary btn-sm" data-status="${NEXT_ACTION[b.status].status}" data-id="${b.id}">${NEXT_ACTION[b.status].label}</button>`);
  }
  if (role === 'customer' && ['PENDING', 'ACCEPTED'].includes(b.status)) {
    buttons.push(`<button class="btn btn-danger btn-sm" data-status="CANCELLED" data-id="${b.id}">Batalkan</button>`);
  }
  if (role === 'admin' && ['ACCEPTED', 'ON_THE_WAY', 'IN_PROGRESS'].includes(b.status)) {
    buttons.push(`<button class="btn btn-danger btn-sm" data-status="CANCELLED" data-id="${b.id}">Batalkan</button>`);
  }
  if (!detail) buttons.push(`<a class="btn btn-sm" href="#/booking/${b.id}">${icon('chat', 16)} Detail</a>`);
  return buttons.join('');
}

function bindBookingActions(root) {
  root.addEventListener('click', async (e) => {
    const btn = e.target.closest('[data-decision], [data-status]');
    if (!btn) return;
    const id = btn.dataset.id;
    if (btn.dataset.status === 'CANCELLED' && !confirm('Batalkan pesanan ini?')) return;
    btn.disabled = true;
    try {
      const { booking } = btn.dataset.decision
        ? await api(`/api/bookings/${id}/decision`, { method: 'POST', body: { decision: btn.dataset.decision } })
        : await api(`/api/bookings/${id}/status`, { method: 'POST', body: { status: btn.dataset.status } });
      const idx = state.bookings.findIndex((b) => b.id === booking.id);
      if (idx >= 0) state.bookings[idx] = booking;
      onBookingChanged(booking);
    } catch (err) {
      toast('Gagal memperbarui pesanan', err.message, 'error');
      btn.disabled = false;
    }
  });
}

function onBookingChanged(booking) {
  updatePendingCounts();
  const route = parseRoute();
  const $view = document.getElementById('view');
  if (!$view) return;
  if (route.name === 'bookings') renderBookings($view);
  else if (route.name === 'admin' && (route.id === 'bookings' || !route.id)) renderAdmin($view, route);
  else if (route.name === 'booking' && Number(route.id) === booking.id) refreshBookingDetail(booking);
}

// ---------- booking detail (tracking, chat, rating) ----------

let tracking = null;

async function renderBookingDetail($view, route) {
  tracking = null;
  $view.innerHTML = `<div class="booking-detail"><div class="skeleton" style="height:520px"></div><div class="skeleton" style="height:520px"></div></div>`;
  let booking;
  try {
    booking = (await api(`/api/bookings/${encodeURIComponent(route.id)}`)).booking;
  } catch (err) {
    if (isStale(route)) return;
    $view.innerHTML = `<div class="card empty">${icon('calendar', 40)}<h3>Pesanan tidak ditemukan</h3><p>${esc(err.message)}</p><a class="btn" href="${defaultRoute()}">Kembali</a></div>`;
    return;
  }
  const idx = state.bookings.findIndex((b) => b.id === booking.id);
  if (idx >= 0) state.bookings[idx] = booking;
  else state.bookings.unshift(booking);

  const role = state.user.role;
  let templates = [];
  if (role !== 'admin') templates = (await api('/api/chat-templates').catch(() => ({ templates: [] }))).templates;
  if (isStale(route)) return;
  const backHref = role === 'admin' ? '#/admin/bookings' : '#/bookings';
  const counterpart = role === 'customer' ? booking.provider?.name : booking.customer?.name;

  $view.innerHTML = `
    <a class="btn btn-ghost btn-sm" href="${backHref}" style="margin-bottom:12px">${icon('back', 16)} Semua pesanan</a>
    <div class="page-head">
      <div>
        <h1>Pesanan #${booking.id}</h1>
        <p>${esc(booking.provider?.service)} · ${esc(counterpart)} · ${fmtDate(booking.date)} pukul ${esc(booking.time)}</p>
      </div>
      <div class="row" id="bd-actions"></div>
    </div>
    <div class="booking-detail">
      <div class="stack">
        <section class="card" style="overflow:hidden">
          <div class="track-map" id="track-map"></div>
          <div class="track-meta" id="bd-track-meta"></div>
        </section>
        <section class="card">
          <div class="timeline" id="bd-timeline"></div>
        </section>
        <section class="card" id="bd-rating" hidden></section>
      </div>
      <section class="card chat" aria-label="Chat pesanan">
        <div class="chat-head"><span class="avatar">${initials(counterpart)}</span><div><strong>${esc(counterpart)}</strong><p class="muted small">${role === 'admin' ? 'Memantau percakapan' : 'Chat pesanan · dibantu AI Andallo'}</p></div></div>
        <div class="chat-body" id="chat-body"></div>
        ${
          role === 'admin'
            ? ''
            : `<div class="chat-templates" id="chat-templates">${templates.map((t) => `<button class="chip" type="button">${esc(t)}</button>`).join('')}</div>
        <form class="chat-form" id="chat-form">
          <label class="sr-only" for="chat-input">Tulis pesan</label>
          <input class="input" id="chat-input" maxlength="1000" autocomplete="off" placeholder="Tulis pesan…" />
          <button class="btn btn-primary" type="submit" aria-label="Kirim">${icon('send')}</button>
        </form>`
        }
      </section>
    </div>`;

  const chatBody = document.getElementById('chat-body');
  chatBody.innerHTML = booking.chat.length ? booking.chat.map(chatMessageHtml).join('') : chatEmptyHtml();
  chatBody.scrollTop = chatBody.scrollHeight;

  const map = makeMap(document.getElementById('track-map'), booking.destination || DEFAULT_ORIGIN, 14);
  tracking = { bookingId: booking.id, map, markers: {} };
  updateTrackingMarkers(booking.id, true);

  if (role !== 'admin') {
    const form = document.getElementById('chat-form');
    const input = document.getElementById('chat-input');
    const send = async (text) => {
      if (!text.trim()) return;
      input.value = '';
      try {
        const { chat } = await api(`/api/bookings/${booking.id}/chat`, { method: 'POST', body: { text } });
        const current = state.bookings.find((b) => b.id === booking.id);
        if (current) current.chat = chat;
        chat.forEach((m) => appendChatMessage(booking.id, m));
      } catch (err) {
        input.value = text;
        toast('Pesan gagal dikirim', err.message, 'error');
      }
    };
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      send(input.value);
    });
    document.getElementById('chat-templates').addEventListener('click', (e) => {
      const chip = e.target.closest('.chip');
      if (chip) send(chip.textContent);
    });
  }

  bindBookingActions(document.getElementById('bd-actions'));
  refreshBookingDetail(booking);
}

function refreshBookingDetail(booking) {
  const $actions = document.getElementById('bd-actions');
  if (!$actions) return;
  const role = state.user.role;
  $actions.innerHTML = `<span class="badge badge-${booking.status}">${esc(booking.statusLabel)}</span>${bookingActions(booking, { detail: true })}`;

  const closed = ['REJECTED', 'EXPIRED', 'CANCELLED'].includes(booking.status);
  const currentIdx = LIFECYCLE.findIndex((s) => s.status === booking.status);
  document.getElementById('bd-timeline').innerHTML = closed
    ? `<div class="timeline-step current"><span class="dot"></span><div><strong>${esc(booking.statusLabel)}</strong><span class="small">${
        booking.status === 'EXPIRED'
          ? 'Penyedia tidak merespons dalam 2 menit. Tanggal ini kembali tersedia.'
          : booking.status === 'REJECTED'
            ? 'Penyedia menolak pesanan. Silakan pilih penyedia atau tanggal lain.'
            : 'Pesanan dibatalkan.'
      }</span></div></div>`
    : LIFECYCLE.map(
        (s, i) => `
        <div class="timeline-step ${i < currentIdx || booking.status === 'SELESAI' ? 'done' : i === currentIdx ? 'current' : ''}">
          <span class="dot"></span>
          <div><strong>${s.label}</strong><span class="small">${i === 0 && booking.status === 'PENDING' ? countdownHtml(booking) : s.hint}</span></div>
        </div>`,
      ).join('');

  const $meta = document.getElementById('bd-track-meta');
  const canShare = role !== 'admin' && TRACKABLE.has(booking.status);
  const sharing = state.geoBookingId === booking.id;
  if (!canShare && sharing) stopSharingLocation();
  $meta.innerHTML = `
    <span class="row small muted" style="gap:14px">
      <span><span class="pin pin-provider" style="display:inline-block;width:12px;height:12px;border-width:2px"></span> Penyedia</span>
      <span><span class="pin pin-customer" style="display:inline-block;width:12px;height:12px;border-width:2px"></span> Customer</span>
      <span><span class="pin pin-destination" style="display:inline-block;width:12px;height:12px;border-width:2px"></span> Tujuan</span>
    </span>
    <span class="spacer"></span>
    ${
      canShare
        ? `<button class="btn btn-sm ${sharing ? 'btn-danger' : 'btn-primary'}" id="share-location">${icon('locate', 16)} ${sharing ? 'Hentikan berbagi lokasi' : 'Bagikan lokasi live'}</button>`
        : `<span class="small muted">${TRACKABLE.has(booking.status) ? 'Live tracking aktif' : 'Live tracking aktif setelah pesanan diterima'}</span>`
    }`;
  document.getElementById('share-location')?.addEventListener('click', () => {
    if (state.geoBookingId === booking.id) stopSharingLocation();
    else startSharingLocation(booking.id);
    refreshBookingDetail(state.bookings.find((b) => b.id === booking.id) || booking);
  });

  const $rating = document.getElementById('bd-rating');
  if (booking.status === 'SELESAI' && (booking.rated || role === 'customer')) {
    $rating.hidden = false;
    if (booking.rated) {
      $rating.innerHTML = `<div class="rating"><strong>Rating diberikan</strong><div class="stars">${starIcon(20).repeat(booking.rating?.stars || 0)}</div>${
        booking.rating?.comment ? `<p class="muted">“${esc(booking.rating.comment)}”</p>` : ''
      }</div>`;
    } else {
      let stars = 0;
      $rating.innerHTML = `
        <form class="rating" id="rating-form">
          <strong>Bagaimana layanan ${esc(booking.provider?.name)}?</strong>
          <div class="star-input" role="radiogroup" aria-label="Rating">${[1, 2, 3, 4, 5].map((n) => `<button type="button" data-star="${n}" aria-label="${n} bintang">${starIcon(28)}</button>`).join('')}</div>
          <textarea class="input" name="comment" maxlength="500" placeholder="Ceritakan pengalamanmu (opsional)"></textarea>
          <p class="form-error" id="rating-error"></p>
          <button class="btn btn-accent" type="submit">Kirim rating</button>
        </form>`;
      const form = document.getElementById('rating-form');
      form.querySelector('.star-input').addEventListener('click', (e) => {
        const b = e.target.closest('[data-star]');
        if (!b) return;
        stars = Number(b.dataset.star);
        form.querySelectorAll('[data-star]').forEach((s) => s.classList.toggle('on', Number(s.dataset.star) <= stars));
      });
      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        if (!stars) {
          document.getElementById('rating-error').textContent = 'Pilih jumlah bintang terlebih dahulu.';
          return;
        }
        try {
          const { booking: updated } = await api(`/api/bookings/${booking.id}/rating`, {
            method: 'POST',
            body: { stars, comment: form.comment.value },
          });
          const idx = state.bookings.findIndex((b) => b.id === updated.id);
          if (idx >= 0) state.bookings[idx] = updated;
          refreshBookingDetail(updated);
          toast('Terima kasih!', 'Rating kamu membantu customer lain memilih penyedia.');
        } catch (err) {
          document.getElementById('rating-error').textContent = err.message;
        }
      });
    }
  } else {
    $rating.hidden = true;
  }
  tickCountdowns();
}

function updateTrackingMarkers(bookingId, fit = false) {
  if (!tracking || tracking.bookingId !== bookingId || !mapAlive(tracking.map)) return;
  const booking = state.bookings.find((b) => b.id === bookingId);
  if (!booking) return;
  const points = {
    provider: booking.providerPos,
    customer: booking.customerPos,
    destination: booking.destination,
  };
  const labels = { provider: booking.provider?.name || 'Penyedia', customer: booking.customer?.name || 'Customer', destination: 'Lokasi tujuan' };
  const bounds = [];
  for (const [kind, pos] of Object.entries(points)) {
    if (!pos) continue;
    bounds.push([pos.lat, pos.lng]);
    if (tracking.markers[kind]) tracking.markers[kind].setLatLng([pos.lat, pos.lng]);
    else tracking.markers[kind] = L.marker([pos.lat, pos.lng], { icon: pinIcon(kind) }).bindPopup(esc(labels[kind])).addTo(tracking.map);
  }
  if (fit && bounds.length > 1) tracking.map.fitBounds(bounds, { padding: [40, 40], maxZoom: 15 });
}

function startSharingLocation(bookingId) {
  if (!navigator.geolocation) {
    toast('Lokasi tidak didukung', 'Browser ini tidak mendukung geolokasi.', 'error');
    return;
  }
  stopSharingLocation();
  state.geoBookingId = bookingId;
  state.geoWatch = navigator.geolocation.watchPosition(
    (pos) => {
      api(`/api/bookings/${bookingId}/location`, {
        method: 'POST',
        body: { lat: pos.coords.latitude, lng: pos.coords.longitude },
      }).catch((err) => {
        toast('Gagal mengirim lokasi', err.message, 'error');
        stopSharingLocation();
      });
    },
    () => {
      toast('Akses lokasi ditolak', 'Izinkan akses lokasi di browser agar posisi kamu tampil di peta.', 'error');
      stopSharingLocation();
      const booking = state.bookings.find((b) => b.id === bookingId);
      if (booking) refreshBookingDetail(booking);
    },
    { enableHighAccuracy: true, maximumAge: 10000, timeout: 20000 },
  );
}

function stopSharingLocation() {
  if (state.geoWatch !== null) navigator.geolocation.clearWatch(state.geoWatch);
  state.geoWatch = null;
  state.geoBookingId = null;
}

const chatEmptyHtml = () => `<div class="empty small" data-chat-empty>${icon('chat', 32)}<p>Belum ada pesan. Gunakan pertanyaan cepat di bawah untuk memulai.</p></div>`;

function chatMessageHtml(m) {
  const mine = m.sender === state.user.role && m.sender !== 'ai' && (m.senderName ? m.senderName === state.user.name : true);
  const from = m.sender === 'ai' ? 'AI Andallo' : m.senderName || ROLE_LABEL[m.sender] || m.sender;
  return `<div class="msg ${mine ? 'mine' : ''} ${m.sender === 'ai' ? 'ai' : ''}" data-msg="${m.id}"><div class="from">${esc(from)}</div>${esc(m.text)}<time>${fmtTime(m.createdAt)}</time></div>`;
}

function appendChatMessage(bookingId, message) {
  if (!tracking || tracking.bookingId !== bookingId) return;
  const body = document.getElementById('chat-body');
  if (!body || body.querySelector(`[data-msg="${message.id}"]`)) return;
  body.querySelector('[data-chat-empty]')?.remove();
  body.insertAdjacentHTML('beforeend', chatMessageHtml(message));
  body.scrollTop = body.scrollHeight;
}

// ---------- admin ----------

async function renderAdmin($view, route) {
  const tab = route.id || 'overview';
  if (tab === 'bookings') return renderAdminBookings($view);
  if (tab === 'providers') return renderAdminProviders($view);
  if (tab === 'users') return renderAdminUsers($view);

  $view.innerHTML = `<div class="stats">${'<div class="skeleton" style="height:92px"></div>'.repeat(4)}</div>`;
  let data;
  try {
    data = await api('/api/admin/overview');
  } catch (err) {
    $view.innerHTML = `<div class="error-box">${esc(err.message)}</div>`;
    return;
  }
  const { stats } = data;
  const max = Math.max(1, ...Object.values(stats.byStatus));
  const labels = Object.fromEntries(LIFECYCLE.map((s) => [s.status, s.label]));
  Object.assign(labels, { REJECTED: 'Ditolak', EXPIRED: 'Kedaluwarsa', CANCELLED: 'Dibatalkan' });
  const pending = state.bookings.filter((b) => b.status === 'PENDING');
  $view.innerHTML = `
    <div class="page-head"><div><h1>Ringkasan</h1><p>Kondisi marketplace Andallo hari ini.</p></div></div>
    <div class="stats">
      <div class="card stat"><span>Total pesanan</span><strong>${stats.bookings}</strong></div>
      <div class="card stat"><span>Penyedia terdaftar</span><strong>${stats.providers}</strong></div>
      <div class="card stat"><span>Pengguna</span><strong>${stats.users}</strong></div>
      <div class="card stat"><span>Nilai transaksi selesai</span><strong>${rupiah(stats.revenue)}</strong></div>
    </div>
    <div class="detail">
      <section class="stack">
        <h2 style="font-size:1.05rem">Menunggu persetujuan (${pending.length})</h2>
        <div class="booking-list" id="admin-pending">${
          pending.length ? pending.map(bookingItem).join('') : `<div class="card empty">${icon('check', 36)}<h3>Semua pesanan sudah direspons</h3><p>Pesanan baru akan muncul di sini secara real-time.</p></div>`
        }</div>
      </section>
      <section class="card status-bars">
        <h2 style="font-size:1.05rem">Pesanan per status</h2>
        ${Object.entries(stats.byStatus)
          .map(([s, n]) => `<div class="status-bar"><span>${labels[s] || s}</span><span class="track"><span style="width:${(n / max) * 100}%"></span></span><strong>${n}</strong></div>`)
          .join('')}
      </section>
    </div>`;
  bindBookingActions(document.getElementById('admin-pending'));
}

function renderAdminBookings($view) {
  const list = state.bookings;
  $view.innerHTML = `
    <div class="page-head"><div><h1>Semua Pesanan</h1><p>Terima, tolak, atau batalkan pesanan atas nama penyedia.</p></div></div>
    <section class="card table-wrap">
      ${
        list.length
          ? `<table>
        <thead><tr><th>ID</th><th>Customer</th><th>Penyedia</th><th>Jadwal</th><th>Total</th><th>Status</th><th>Aksi</th></tr></thead>
        <tbody>${list
          .map(
            (b) => `<tr>
            <td><a href="#/booking/${b.id}">#${b.id}</a></td>
            <td>${esc(b.customer?.name)}</td>
            <td>${esc(b.provider?.name)}<br><span class="muted small">${esc(b.provider?.service)}</span></td>
            <td>${fmtDate(b.date)}<br><span class="muted small">${esc(b.time)}</span></td>
            <td>${rupiah(b.total)}</td>
            <td><span class="badge badge-${b.status}">${esc(b.statusLabel)}</span>${b.status === 'PENDING' ? `<br><span class="countdown small" data-countdown="${esc(b.approvalExpiresAt)}">--:--</span>` : ''}</td>
            <td><div class="actions">${bookingActions(b)}</div></td>
          </tr>`,
          )
          .join('')}</tbody>
      </table>`
          : `<div class="empty">${icon('calendar', 40)}<h3>Belum ada pesanan</h3><p>Pesanan customer akan tampil di sini.</p></div>`
      }
    </section>`;
  bindBookingActions($view);
  tickCountdowns();
}

async function renderAdminProviders($view) {
  $view.innerHTML = `<div class="skeleton" style="height:400px"></div>`;
  try {
    const { providers } = await api('/api/providers?sort=rating');
    $view.innerHTML = `
      <div class="page-head"><div><h1>Penyedia</h1><p>${providers.length} penyedia terverifikasi di Andallo.</p></div></div>
      <section class="card table-wrap"><table>
        <thead><tr><th>Nama</th><th>Kategori</th><th>Layanan</th><th>Kota</th><th>Harga</th><th>Rating</th><th></th></tr></thead>
        <tbody>${providers
          .map(
            (p) => `<tr><td><strong>${esc(p.name)}</strong></td><td>${esc(p.category)}</td><td>${esc(p.service)}</td><td>${esc(p.city)}</td><td>${rupiah(p.price)}</td><td><span class="stars">${starIcon()} <span>${p.rating.toFixed(1)}</span></span> <span class="muted small">(${p.reviews})</span></td><td><a class="btn btn-sm" href="#/provider/${p.id}">Lihat</a></td></tr>`,
          )
          .join('')}</tbody>
      </table></section>`;
  } catch (err) {
    $view.innerHTML = `<div class="error-box">${esc(err.message)}</div>`;
  }
}

async function renderAdminUsers($view) {
  $view.innerHTML = `<div class="skeleton" style="height:300px"></div>`;
  try {
    const { users } = await api('/api/admin/overview');
    $view.innerHTML = `
      <div class="page-head"><div><h1>Pengguna</h1><p>Akun yang dapat masuk ke Andallo.</p></div></div>
      <section class="card table-wrap"><table>
        <thead><tr><th>Nama</th><th>Email</th><th>Peran</th><th>WhatsApp</th></tr></thead>
        <tbody>${users
          .map(
            (u) => `<tr><td><div class="row"><span class="avatar" style="width:30px;height:30px;font-size:.72rem">${initials(u.name)}</span>${esc(u.name)}</div></td><td>${esc(u.email)}</td><td>${ROLE_LABEL[u.role] || esc(u.role)}</td><td>${esc(u.phone || '—')}</td></tr>`,
          )
          .join('')}</tbody>
      </table></section>`;
  } catch (err) {
    $view.innerHTML = `<div class="error-box">${esc(err.message)}</div>`;
  }
}

// ---------- countdown ticker ----------

function tickCountdowns() {
  const now = Date.now();
  document.querySelectorAll('[data-countdown]').forEach((el) => {
    const left = Math.max(0, Date.parse(el.dataset.countdown) - now);
    const s = Math.ceil(left / 1000);
    el.textContent = left ? `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}` : 'Waktu habis';
  });
  document.querySelectorAll('[data-countdown-bar]').forEach((el) => {
    const left = Math.max(0, Date.parse(el.dataset.countdownBar) - now);
    el.style.width = `${(left / 120000) * 100}%`;
  });
}
setInterval(tickCountdowns, 1000);

// ---------- boot ----------

async function boot() {
  if (state.token) {
    try {
      state.user = (await api('/api/me')).user;
      await loadSessionData();
      connectEvents();
    } catch {
      state.token = null;
      state.user = null;
      localStorage.removeItem(TOKEN_KEY);
    }
  }
  render();
}

boot();
