export const esc = (value) =>
  String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);

export const rupiah = (value) => `Rp${Number(value || 0).toLocaleString('id-ID')}`;

export const initials = (name) =>
  String(name || '?')
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase();

export function formatDate(iso) {
  if (!iso) return '';
  const date = iso.length === 10 ? new Date(`${iso}T00:00:00`) : new Date(iso);
  return date.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
}

export function formatLongDate(iso) {
  return new Date(`${iso}T00:00:00`).toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
}

export const STATUS_LABEL = {
  pending: 'Menunggu',
  confirmed: 'Dikonfirmasi',
  completed: 'Selesai',
  cancelled: 'Dibatalkan',
};

const ICONS = {
  search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
  pin: '<path d="M12 21s7-5.4 7-11a7 7 0 1 0-14 0c0 5.6 7 11 7 11z"/><circle cx="12" cy="10" r="2.2"/>',
  star: '<path d="m12 3 2.4 4.9 5.4.8-3.9 3.8.9 5.4L12 15.8 7.2 17.9l.9-5.4L4.2 8.7l5.4-.8z"/>',
  menu: '<path d="M4 7h16M4 12h16M4 17h16"/>',
  close: '<path d="M6 6l12 12M18 6 6 18"/>',
  check: '<path d="m5 12 5 5L20 7"/>',
  arrow: '<path d="M5 12h14M13 6l6 6-6 6"/>',
  user: '<circle cx="12" cy="8" r="3.2"/><path d="M5 19c1.4-3 3.8-4.5 7-4.5S17.6 16 19 19"/>',
  calendar: '<rect x="4" y="5" width="16" height="15" rx="2"/><path d="M8 3v4M16 3v4M4 10h16"/>',
  heart: '<path d="M12 19s-7-4.4-7-8.5A3.5 3.5 0 0 1 12 8a3.5 3.5 0 0 1 7 2.5C19 14.6 12 19 12 19z"/>',
};

export function icon(name, size = 18) {
  return `<svg class="icon" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[name] || ''}</svg>`;
}

export function starRow(rating, count) {
  const value = Number(rating) || 0;
  const label = value ? value.toFixed(1) : 'Baru';
  const reviews = count == null ? '' : count ? `${count} ulasan` : 'Belum ada ulasan';
  return `<span class="stars" aria-label="${esc(label)} dari 5">${icon('star', 15)} <strong>${esc(label)}</strong> <span>${esc(reviews)}</span></span>`;
}

export function logo(compact = false) {
  return `<span class="brand-mark" aria-hidden="true"><svg width="28" height="28" viewBox="0 0 32 32" fill="none"><path d="M16 3.5c5.2 6.4 8.2 10.4 8.2 14.2a8.2 8.2 0 1 1-16.4 0C7.8 13.9 10.8 9.9 16 3.5z" fill="currentColor"/><circle cx="16" cy="17.2" r="3.1" fill="#fff"/></svg></span>${compact ? '' : '<span>Andallo</span>'}`;
}

export function toast(title, body = '', type = 'info') {
  const node = document.createElement('div');
  node.className = `toast ${type === 'error' ? 'error' : ''}`;
  node.innerHTML = `<strong>${esc(title)}</strong>${body ? `<span>${esc(body)}</span>` : ''}`;
  document.getElementById('toasts').append(node);
  setTimeout(() => node.remove(), 4800);
}

export function confirmDialog({ title, text, confirm = 'Ya, lanjutkan', danger = false }) {
  const root = document.getElementById('modal-root');
  return new Promise((resolve) => {
    root.innerHTML = `
      <div class="modal-back" id="modal-back">
        <div class="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title">
          <h3 id="modal-title">${esc(title)}</h3>
          <p>${esc(text)}</p>
          <div class="row end">
            <button class="btn" id="modal-cancel" type="button">Batal</button>
            <button class="btn ${danger ? 'btn-danger' : 'btn-primary'}" id="modal-ok" type="button">${esc(confirm)}</button>
          </div>
        </div>
      </div>`;
    const close = (value) => {
      root.innerHTML = '';
      resolve(value);
    };
    document.getElementById('modal-cancel').onclick = () => close(false);
    document.getElementById('modal-ok').onclick = () => close(true);
    document.getElementById('modal-back').onclick = (event) => {
      if (event.target.id === 'modal-back') close(false);
    };
  });
}

export function lightbox(images, start = 0) {
  const root = document.getElementById('modal-root');
  let index = start;
  const draw = () => {
    const item = images[index];
    root.innerHTML = `
      <div class="lightbox" id="lightbox">
        <button class="icon-btn lightbox-close" id="lb-close" aria-label="Tutup">${icon('close', 20)}</button>
        <button class="icon-btn" id="lb-prev" aria-label="Sebelumnya">‹</button>
        <figure>
          <img src="${esc(item.image || item)}" alt="${esc(item.title || 'Foto portofolio')}" />
          ${item.title ? `<figcaption><strong>${esc(item.title)}</strong><span>${esc(item.category || '')}${item.date ? ` · ${esc(formatDate(item.date))}` : ''}</span><p>${esc(item.description || '')}</p></figcaption>` : ''}
        </figure>
        <button class="icon-btn" id="lb-next" aria-label="Berikutnya">›</button>
      </div>`;
    document.getElementById('lb-close').onclick = () => {
      root.innerHTML = '';
    };
    document.getElementById('lb-prev').onclick = () => {
      index = (index - 1 + images.length) % images.length;
      draw();
    };
    document.getElementById('lb-next').onclick = () => {
      index = (index + 1) % images.length;
      draw();
    };
  };
  draw();
}

export function skeletonCards(count = 6) {
  return `<div class="card-grid">${'<div class="skeleton-card"></div>'.repeat(count)}</div>`;
}

export function emptyState({ title, text, action = '' }) {
  return `<div class="empty"><h3>${esc(title)}</h3><p>${esc(text)}</p>${action}</div>`;
}

export function errorBox(message, retryId = 'retry') {
  return `<div class="error-box"><p>${esc(message)}</p><button class="btn" id="${retryId}" type="button">Coba lagi</button></div>`;
}

export function field(label, html, hint = '') {
  return `<label class="field"><span>${label}</span>${html}${hint ? `<small>${hint}</small>` : ''}</label>`;
}
