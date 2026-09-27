import { api, ApiError } from './js/api.js';
import { bumpGeneration, isCurrent, setCity, setCoords, setSession, state, toggleCompare } from './js/store.js';
import { confirmDialog, emptyState, errorBox, esc, formatDate, formatLongDate, icon, initials, lightbox, logo, rupiah, skeletonCards, starRow, STATUS_LABEL, toast } from './js/ui.js';

const CITIES = ['Tangerang', 'Jakarta', 'Bekasi', 'Bandung', 'Depok'];
const TIMES = ['08:00', '09:00', '10:00', '11:00', '13:00', '14:00', '15:00', '16:00', '17:00'];

const parseRoute = () => {
  const raw = (location.hash || '#/').replace(/^#/, '');
  const [path, query = ''] = raw.split('?');
  const parts = path.split('/').filter(Boolean);
  return { parts, params: Object.fromEntries(new URLSearchParams(query)), path: `/${parts.join('/')}` };
};

const cityOptions = (selected, label = 'Semua lokasi') =>
  `<option value="">${label}</option>${CITIES.map((city) => `<option value="${city}" ${city === selected ? 'selected' : ''}>${city}</option>`).join('')}`;

const categoryOptions = (selected, label = 'Semua kategori') =>
  `<option value="">${label}</option>${state.categories.map((category) => `<option value="${category.id}" ${category.id === selected ? 'selected' : ''}>${esc(category.name)}</option>`).join('')}`;

const bookHref = (id) => (state.user?.role === 'customer' ? `#/pesan/${id}` : `#/masuk?lanjut=${encodeURIComponent(`/pesan/${id}`)}`);

function serviceCard(service) {
  return `
    <article class="card service-card">
      <a class="media" href="#/jasa/${service.id}">
        <img src="${esc(service.images?.[0])}" alt="" />
        ${service.providerVerified ? '<span class="badge">Terverifikasi</span>' : ''}
      </a>
      <div class="body">
        <p class="small muted">${esc(service.categoryName)} · ${esc(service.city)}${service.distanceKm != null ? ` · ${service.distanceKm} km` : ''}</p>
        <h3><a class="plain" href="#/jasa/${service.id}">${esc(service.name)}</a></h3>
        <p class="small">${esc(service.providerName)}</p>
        ${starRow(service.rating, service.reviewCount)}
        <p class="small muted">Harga mulai <span class="price">${rupiah(service.price)}</span></p>
        <div class="card-actions">
          <a class="btn btn-sm" href="#/jasa/${service.id}">Lihat Detail</a>
          <a class="btn btn-sm btn-primary" href="${bookHref(service.id)}">Pesan Sekarang</a>
        </div>
      </div>
    </article>`;
}

function paintPublic(route) {
  const user = state.user;
  const active = route.parts[0] || '';
  const links = [
    ['', 'Beranda'],
    ['jelajah', 'Jelajahi Jasa'],
    ['cara-kerja', 'Cara Kerja'],
    ['tentang', 'Tentang'],
  ];
  const account =
    user?.role === 'admin'
      ? `<a class="btn btn-sm btn-midnight" href="#/admin">Dasbor</a>`
      : user
        ? `<a class="${active === 'akun' ? 'active' : ''}" href="#/akun">Akun Saya</a>`
        : `<a class="${active === 'masuk' ? 'active' : ''}" href="#/masuk">Masuk</a><a class="btn btn-sm btn-primary" href="#/daftar">Daftar</a>`;
  document.getElementById('app').innerHTML = `
    <header class="topbar">
      <div class="topbar-inner">
        <a class="brand" href="#/">${logo()}</a>
        <button class="icon-btn menu-btn" id="menu-btn" aria-label="Menu">${icon('menu')}</button>
        <nav class="nav-links" id="nav-links">
          ${links.map(([href, label]) => `<a class="${active === href ? 'active' : ''}" href="#/${href}">${label}</a>`).join('')}
          ${state.compare.length ? `<a class="${active === 'bandingkan' ? 'active' : ''}" href="#/bandingkan">Bandingkan (${state.compare.length})</a>` : ''}
          ${account}
          ${user ? '<button class="btn btn-sm btn-ghost" id="logout" type="button">Keluar</button>' : ''}
        </nav>
      </div>
    </header>
    <main class="page" id="view"></main>
    <footer class="footer"><div class="footer-inner"><div><strong>Andallo</strong><p class="muted">Andallo, jasa andalanmu setiap saat.</p></div><p class="small muted">Bandung · Jakarta · Bekasi · Tangerang · Depok</p></div></footer>`;
  document.getElementById('menu-btn').onclick = () => document.getElementById('nav-links').classList.toggle('open');
  document.getElementById('logout')?.addEventListener('click', logout);
  return document.getElementById('view');
}

function paintAdmin(route) {
  const section = route.parts[1] || '';
  const links = [
    ['', 'Ringkasan'],
    ['penyedia', 'Penyedia'],
    ['jasa', 'Jasa'],
    ['kategori', 'Kategori'],
    ['pesanan', 'Pesanan'],
    ['ulasan', 'Ulasan'],
    ['pelanggan', 'Pelanggan'],
    ['pengaturan', 'Pengaturan'],
  ];
  document.getElementById('app').innerHTML = `
    <div class="admin" id="admin-shell">
      <aside class="side">
        <a class="brand" href="#/">${logo()}</a>
        ${links.map(([href, label]) => `<a class="${section === href ? 'active' : ''}" href="#/admin${href ? `/${href}` : ''}">${label}</a>`).join('')}
        <div class="foot">
          <p class="small muted">${esc(state.user.name)}</p>
          <button class="btn btn-sm" id="logout" type="button">Keluar</button>
          <a class="small" href="#/">Lihat situs</a>
        </div>
      </aside>
      <div class="admin-main">
        <button class="btn btn-sm admin-toggle" id="admin-toggle" type="button">${icon('menu')} Menu</button>
        <div id="view"></div>
      </div>
    </div>`;
  document.getElementById('logout').onclick = logout;
  document.getElementById('admin-toggle').onclick = () => document.getElementById('admin-shell').classList.toggle('open');
  return document.getElementById('view');
}

async function logout() {
  await api('/api/auth/logout', { method: 'POST' }).catch(() => {});
  setSession('', null);
  location.hash = '/';
}

async function pageHome(view, _route, stale) {
  view.innerHTML = `<div class="skeleton-card"></div>`;
  try {
    const [{ services }] = await Promise.all([api('/api/services?featured=1&sort=rating')]);
    if (stale()) return;
    view.innerHTML = `
      <section class="section" style="margin-top:8px">
        <div class="section-head"><div><p class="kicker">Kategori</p><h2>Pilih jenis jasa</h2></div></div>
        <div class="cat-grid">
          ${state.categories
            .map(
              (category) => `<a class="card cat-card" href="#/jelajah?category=${category.id}">
                <span class="cat-ico">${icon('search', 18)}</span>
                <span><strong>${esc(category.name)}</strong><span class="small muted">${category.serviceCount} jasa</span></span>
              </a>`,
            )
            .join('')}
        </div>
      </section>
      <section class="section">
        <div class="section-head"><div><p class="kicker">Pilihan Andallo</p><h2>Jasa yang sering dipesan</h2></div><a class="btn btn-sm" href="#/jelajah">Lihat semua</a></div>
        ${services.length ? `<div class="card-grid">${services.map(serviceCard).join('')}</div>` : emptyState({ title: 'Belum ada jasa unggulan', text: 'Admin dapat menandai jasa sebagai unggulan.' })}
      </section>
      <section class="section">
        <div class="section-head"><div><h2>Tiga langkah, tanpa pindah aplikasi</h2><p class="muted">Portofolio, harga, ulasan, dan pemesanan ada di halaman yang sama.</p></div></div>
        <div class="steps">
          <article class="card step"><em>01</em><h3>Cari</h3><p class="muted">Saring berdasarkan kota, harga, dan rating.</p></article>
          <article class="card step"><em>02</em><h3>Bandingkan</h3><p class="muted">Lihat paket, ulasan pelanggan, dan portofolio.</p></article>
          <article class="card step"><em>03</em><h3>Pesan</h3><p class="muted">Pilih jadwal. Status pesanan bisa dipantau di akun Anda.</p></article>
        </div>
      </section>`;
  } catch (error) {
    if (!stale()) view.innerHTML = errorBox(error.message);
  }
}

function homeHero() {
  return `
    <section class="hero">
      <div class="hero-inner">
        <div>
          <p class="kicker">Andallo, jasa andalanmu setiap saat.</p>
          <h1>Temukan Jasa Terbaik di Sekitarmu</h1>
          <p class="lead">Temukan, bandingkan, dan pesan jasa terpercaya di satu tempat.</p>
          <div class="hero-actions">
            <a class="btn btn-primary" href="#/jelajah">Jelajahi Jasa</a>
            <a class="btn" href="#/daftar" style="background:#fff">Daftar Sekarang</a>
          </div>
        </div>
        <aside class="hero-note">
          <strong>Tidak perlu berpindah-pindah media sosial.</strong>
          <p>Harga, ulasan dari transaksi Andallo, dan portofolio penyedia dikumpulkan di satu halaman.</p>
        </aside>
      </div>
    </section>
    <form class="search-panel" id="home-search">
      <input class="input" name="q" placeholder="Anda sedang mencari jasa apa?" aria-label="Anda sedang mencari jasa apa?" />
      <select class="select" name="city" aria-label="Lokasi Anda">${cityOptions(state.city, 'Lokasi Anda')}</select>
      <button class="btn btn-midnight" type="submit">${icon('search')} Cari</button>
    </form>`;
}

async function pageExplore(view, route, stale) {
  const params = route.params;
  view.innerHTML = `
    <div class="section-head"><div><h1 class="display" style="font-size:2.4rem">Jelajahi jasa</h1><p class="muted">Saring sesuai kebutuhan, lalu bandingkan sebelum memesan.</p></div></div>
    <div class="filters">
      <form class="card filter-card" id="filters">
        <label class="field">Cari<input class="input" name="q" value="${esc(params.q || '')}" placeholder="Nama jasa atau penyedia" /></label>
        <label class="field">Kategori<select class="select" name="category">${categoryOptions(params.category || '')}</select></label>
        <label class="field">Lokasi<select class="select" name="city">${cityOptions(params.city || state.city)}</select></label>
        <div class="two">
          <label class="field">Harga min<input class="input" name="minPrice" type="number" min="0" value="${esc(params.minPrice || '')}" /></label>
          <label class="field">Harga max<input class="input" name="maxPrice" type="number" min="0" value="${esc(params.maxPrice || '')}" /></label>
        </div>
        <label class="field">Rating minimal
          <select class="select" name="minRating">
            ${['', '3', '4', '4.5'].map((value) => `<option value="${value}" ${params.minRating === value ? 'selected' : ''}>${value ? `${value.replace('.', ',')} ke atas` : 'Semua'}</option>`).join('')}
          </select>
        </label>
        <label class="check"><input type="checkbox" name="available" ${params.available === '1' ? 'checked' : ''}/> Hanya yang tersedia</label>
        <label class="field">Urutkan
          <select class="select" name="sort">
            ${[
              ['recommended', 'Rekomendasi'],
              ['price_asc', 'Harga terendah'],
              ['rating', 'Rating tertinggi'],
              ['nearest', 'Terdekat'],
            ].map(([value, label]) => `<option value="${value}" ${(params.sort || 'recommended') === value ? 'selected' : ''}>${label}</option>`).join('')}
          </select>
        </label>
        <button class="btn btn-primary" type="submit">Terapkan</button>
        <button class="btn btn-sm" type="button" id="use-location">${icon('pin', 16)} Gunakan lokasi saya</button>
      </form>
      <div id="results">${skeletonCards()}</div>
    </div>`;
  const form = document.getElementById('filters');
  const apply = () => {
    const data = new FormData(form);
    const next = new URLSearchParams();
    for (const [key, value] of data.entries()) if (String(value).trim()) next.set(key, String(value).trim());
    if (form.available.checked) next.set('available', '1');
    setCity(String(data.get('city') || ''));
    const hash = `/jelajah${next.toString() ? `?${next}` : ''}`;
    if (location.hash.replace(/^#/, '') === hash) load();
    else location.hash = hash;
  };
  form.onsubmit = (event) => {
    event.preventDefault();
    apply();
  };
  document.getElementById('use-location').onclick = () => {
    if (!navigator.geolocation) return toast('Lokasi tidak didukung', 'Browser ini tidak menyediakan lokasi.', 'error');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        toast('Lokasi tersimpan', 'Jarak dihitung dari posisi Anda.');
        load();
      },
      () => toast('Lokasi ditolak', 'Izinkan akses lokasi untuk mengurutkan yang terdekat.', 'error'),
      { timeout: 8000 },
    );
  };

  async function load() {
    const results = document.getElementById('results');
    if (!results) return;
    results.innerHTML = skeletonCards();
    const query = new URLSearchParams();
    for (const key of ['q', 'category', 'city', 'minPrice', 'maxPrice', 'minRating', 'available', 'sort']) {
      if (route.params[key]) query.set(key, route.params[key]);
    }
    if (state.coords) {
      query.set('lat', state.coords.lat);
      query.set('lng', state.coords.lng);
    }
    try {
      const { services } = await api(`/api/services?${query}`);
      if (stale()) return;
      results.innerHTML = services.length
        ? `<p class="small muted" style="margin-bottom:10px">${services.length} jasa ditemukan</p><div class="card-grid">${services.map(serviceCard).join('')}</div>`
        : emptyState({ title: 'Tidak ada jasa yang cocok', text: 'Coba longgarkan filter atau pilih kategori lain.', action: '<a class="btn" href="#/jelajah">Reset filter</a>' });
    } catch (error) {
      if (!stale()) results.innerHTML = errorBox(error.message);
    }
  }
  load();
}

async function pageService(view, route, stale) {
  view.innerHTML = skeletonCards(1);
  try {
    const data = await api(`/api/services/${route.parts[1]}`);
    if (stale()) return;
    let saved = false;
    if (state.user?.role === 'customer') {
      const mine = await api('/api/saved');
      saved = mine.services.some((item) => item.id === data.service.id);
    }
    if (stale()) return;
    const service = data.service;
    view.innerHTML = `
      <p class="small muted" style="margin-bottom:10px"><a href="#/jelajah">Jelajahi</a> / ${esc(service.categoryName)}</p>
      <div class="layout">
        <div class="stack">
          <div class="cover"><img src="${esc(service.images[0])}" alt="${esc(service.name)}" /></div>
          <div class="thumbs">${service.images.map((image, index) => `<button type="button" data-photo="${index}"><img src="${esc(image)}" alt="" /></button>`).join('')}</div>
          <article class="card pad">
            <p class="small muted">${esc(service.categoryName)} · ${esc(service.city)}</p>
            <h1 class="display" style="font-size:2.2rem">${esc(service.name)}</h1>
            <p><a href="#/penyedia/${service.providerId}">${esc(service.providerName)}</a> ${service.providerVerified ? '· Terverifikasi' : ''}</p>
            ${starRow(service.rating, service.reviewCount)}
            <p>${esc(service.description)}</p>
            <p class="small muted">${icon('pin', 14)} ${esc(service.location)}</p>
          </article>
          <section>
            <h2>Paket</h2>
            <div class="packages" style="margin-top:10px">
              ${service.packages
                .map(
                  (pkg) => `<a class="package" href="${bookHref(service.id)}">
                    <strong>${esc(pkg.name)}</strong>
                    <span class="muted small">${esc(pkg.description)} · ${esc(pkg.duration || '')}</span>
                    <span class="price">${rupiah(pkg.price)}</span>
                  </a>`,
                )
                .join('')}
            </div>
          </section>
          <section>
            <div class="section-head"><h2>Portofolio</h2><a href="#/penyedia/${service.providerId}">Lihat semua</a></div>
            <div class="folio-grid">${data.portfolio.map((item, index) => folioCard(item, index)).join('') || '<p class="muted">Belum ada portofolio.</p>'}</div>
          </section>
          <section>
            <h2>Ulasan</h2>
            <div class="reviews" style="margin-top:10px">${data.reviews.map(reviewCard).join('') || '<p class="muted">Belum ada ulasan dari transaksi Andallo.</p>'}</div>
          </section>
        </div>
        <aside class="card summary">
          <p class="small muted">Harga mulai</p>
          <p class="total">${rupiah(service.price)}</p>
          <p class="small muted">Belum termasuk biaya platform ${data.quote.platformFeePercent}%.</p>
          <a class="btn btn-primary btn-block" href="${bookHref(service.id)}">Pesan Sekarang</a>
          <button class="btn btn-block" id="compare" type="button">${icon('arrow', 16)} ${state.compare.includes(service.id) ? 'Tersimpan di bandingkan' : 'Bandingkan'}</button>
          <button class="btn btn-block" id="save" type="button">${icon('heart', 16)} ${saved ? 'Tersimpan' : 'Simpan'}</button>
          <p class="small muted">${service.available ? 'Jadwal masih bisa dipilih.' : 'Saat ini tidak menerima pesanan baru.'}</p>
        </aside>
      </div>`;
    view.querySelectorAll('[data-photo]').forEach((button) => {
      button.onclick = () => lightbox(service.images.map((image) => ({ image, title: service.name })), Number(button.dataset.photo));
    });
    bindFolio(view, data.portfolio);
    document.getElementById('compare').onclick = () => {
      const result = toggleCompare(service.id);
      if (!result.ok) return toast('Bandingkan', result.reason, 'error');
      toast(result.saved ? 'Ditambahkan' : 'Dihapus dari daftar', 'Buka menu Bandingkan untuk melihatnya.');
      draw();
    };
    document.getElementById('save').onclick = async () => {
      if (state.user?.role !== 'customer') {
        location.hash = `/masuk?lanjut=${encodeURIComponent(`/jasa/${service.id}`)}`;
        return;
      }
      try {
        if (saved) await api(`/api/saved/${service.id}`, { method: 'DELETE' });
        else await api('/api/saved', { method: 'POST', body: { serviceId: service.id } });
        toast(saved ? 'Dihapus dari simpanan' : 'Jasa disimpan');
        draw();
      } catch (error) {
        toast('Gagal menyimpan', error.message, 'error');
      }
    };
  } catch (error) {
    if (!stale()) view.innerHTML = errorBox(error.message);
  }
}

function folioCard(item, index) {
  return `<button class="card folio" type="button" data-folio="${index}"><img src="${esc(item.image)}" alt="" /><figcaption><strong>${esc(item.title)}</strong><span class="small muted">${esc(item.category)} · ${formatDate(item.date)}</span></figcaption></button>`;
}

function bindFolio(view, items) {
  view.querySelectorAll('[data-folio]').forEach((button) => {
    button.onclick = () => lightbox(items, Number(button.dataset.folio));
  });
}

function reviewCard(review) {
  return `<article class="card review"><span class="avatar">${esc(initials(review.customerName))}</span><div><strong>${esc(review.customerName)}</strong> ${starRow(review.rating, null)}<p>${esc(review.text)}</p><p class="small muted">${esc(review.serviceName)} · Pesanan ${esc(review.bookingId)} · ${formatDate(review.createdAt)}</p></div></article>`;
}

async function pageProvider(view, route, stale) {
  view.innerHTML = skeletonCards(2);
  try {
    const data = await api(`/api/providers/${route.parts[1]}`);
    if (stale()) return;
    const provider = data.provider;
    view.innerHTML = `
      <article class="card pad" style="margin-bottom:16px">
        <div class="row"><span class="avatar">${esc(initials(provider.businessName))}</span><div><p class="small muted">${esc(provider.categoryName)} · ${esc(provider.city)}</p><h1 class="display" style="font-size:2rem">${esc(provider.businessName)}</h1><p class="small">${esc(provider.name)} ${provider.verified ? '· Terverifikasi' : ''}</p></div></div>
        <p>${esc(provider.description)}</p>
        <p class="small muted">${esc(provider.location)} · ${starRow(provider.rating, provider.reviewCount)}</p>
      </article>
      <h2>Portofolio</h2>
      <div class="folio-grid" style="margin:12px 0 22px">${data.portfolio.length ? data.portfolio.map(folioCard).join('') : '<p class="muted">Belum ada portofolio.</p>'}</div>
      <h2>Jasa</h2>
      <div class="card-grid" style="margin-top:12px">${data.services.map(serviceCard).join('') || '<p class="muted">Belum ada jasa aktif.</p>'}</div>`;
    bindFolio(view, data.portfolio);
  } catch (error) {
    if (!stale()) view.innerHTML = errorBox(error.message);
  }
}

async function pageCompare(view, _route, stale) {
  if (!state.compare.length) {
    view.innerHTML = emptyState({ title: 'Belum ada jasa untuk dibandingkan', text: 'Buka detail jasa lalu pilih Bandingkan. Maksimal 3 jasa.', action: '<a class="btn btn-primary" href="#/jelajah">Jelajahi jasa</a>' });
    return;
  }
  view.innerHTML = skeletonCards(1);
  try {
    const items = await Promise.all(state.compare.map((id) => api(`/api/services/${id}`).catch(() => null)));
    if (stale()) return;
    const services = items.filter(Boolean).map((item) => item.service);
    view.innerHTML = `
      <div class="section-head"><div><h1 class="display" style="font-size:2.2rem">Bandingkan jasa</h1><p class="muted">Harga, rating, dan lokasi berdampingan.</p></div></div>
      <div class="card table-wrap"><table class="compare-table"><tbody>
        <tr><th>Jasa</th>${services.map((service) => `<td><a href="#/jasa/${service.id}"><strong>${esc(service.name)}</strong></a><br><span class="small muted">${esc(service.providerName)}</span></td>`).join('')}</tr>
        <tr><th>Kategori</th>${services.map((service) => `<td>${esc(service.categoryName)}</td>`).join('')}</tr>
        <tr><th>Lokasi</th>${services.map((service) => `<td>${esc(service.city)}</td>`).join('')}</tr>
        <tr><th>Harga mulai</th>${services.map((service) => `<td class="price">${rupiah(service.price)}</td>`).join('')}</tr>
        <tr><th>Rating</th>${services.map((service) => `<td>${service.rating ? service.rating.toFixed(1) : 'Baru'} (${service.reviewCount})</td>`).join('')}</tr>
        <tr><th>Paket</th>${services.map((service) => `<td>${service.packages.map((pkg) => `${esc(pkg.name)} · ${rupiah(pkg.price)}`).join('<br>')}</td>`).join('')}</tr>
        <tr><th></th>${services.map((service) => `<td><a class="btn btn-sm btn-primary" href="${bookHref(service.id)}">Pesan</a> <button class="btn btn-sm" data-remove="${service.id}" type="button">Hapus</button></td>`).join('')}</tr>
      </tbody></table></div>`;
    view.querySelectorAll('[data-remove]').forEach((button) => {
      button.onclick = () => {
        toggleCompare(button.dataset.remove);
        draw();
      };
    });
  } catch (error) {
    if (!stale()) view.innerHTML = errorBox(error.message);
  }
}

function todayJakarta() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta' }).format(new Date());
}

async function pageBook(view, route, stale) {
  view.innerHTML = skeletonCards(1);
  try {
    const data = await api(`/api/services/${route.parts[1]}`);
    if (stale()) return;
    const service = data.service;
    if (!service.available) {
      view.innerHTML = emptyState({ title: 'Jasa ini sedang tidak menerima pesanan', text: service.name, action: `<a class="btn" href="#/jasa/${service.id}">Kembali ke detail</a>` });
      return;
    }
    let month = new Date();
    let selectedDate = '';
    let selectedTime = '';
    let packageId = service.packages.find((pkg) => pkg.id === route.params.paket)?.id || service.packages[0].id;
    const taken = new Set(data.takenSlots.map((slot) => `${slot.date}|${slot.time}`));
    const drawForm = () => {
      const pkg = service.packages.find((item) => item.id === packageId);
      const fee = Math.round((pkg.price * state.settings.platformFeePercent) / 100);
      view.innerHTML = `
        <div class="section-head"><div><h1 class="display" style="font-size:2.2rem">Pesan jasa</h1><p class="muted">${esc(service.name)} · ${esc(service.providerName)}</p></div></div>
        <div class="layout">
          <form class="stack" id="book-form">
            <section class="card pad"><h2>1. Paket</h2><div class="packages" id="pkgs">${service.packages
              .map(
                (item) => `<button type="button" class="package ${item.id === packageId ? 'selected' : ''}" data-pkg="${item.id}"><strong>${esc(item.name)}</strong><span class="small muted">${esc(item.description)}</span><span class="price">${rupiah(item.price)}</span></button>`,
              )
              .join('')}</div></section>
            <section class="card pad"><h2>2. Tanggal</h2><div id="cal"></div></section>
            <section class="card pad"><h2>3. Jam</h2><div class="times" id="times">${TIMES.map((time) => `<button type="button" class="time ${time === selectedTime ? 'selected' : ''}" data-time="${time}" ${selectedDate && taken.has(`${selectedDate}|${time}`) ? 'disabled' : ''}>${time}</button>`).join('')}</div></section>
            <section class="card pad"><h2>4. Lokasi layanan</h2><label class="field">Alamat lengkap<textarea class="input" name="location" required minlength="5" placeholder="Nama gedung, jalan, dan patokan"></textarea></label><label class="field">Catatan tambahan<textarea class="input" name="notes" maxlength="500" placeholder="Contoh: tamu datang pukul 10, mohon datang lebih awal."></textarea></label></section>
            <p class="form-error" id="book-error"></p>
            <button class="btn btn-primary" type="submit">Konfirmasi pesanan</button>
          </form>
          <aside class="card summary">
            <h2>Ringkasan</h2>
            <div><span>Jasa</span><strong>${esc(service.name)}</strong></div>
            <div><span>Penyedia</span><span>${esc(service.providerName)}</span></div>
            <div><span>Paket</span><span>${esc(pkg.name)}</span></div>
            <div><span>Tanggal</span><span>${selectedDate ? formatLongDate(selectedDate) : '—'}</span></div>
            <div><span>Jam</span><span>${selectedTime || '—'}</span></div>
            <div class="line"><span>Harga</span><span>${rupiah(pkg.price)}</span></div>
            <div class="line"><span>Biaya platform ${state.settings.platformFeePercent}%</span><span>${rupiah(fee)}</span></div>
            <div class="line total"><span>Total</span><span>${rupiah(pkg.price + fee)}</span></div>
          </aside>
        </div>`;
      renderCalendar();
      document.getElementById('pkgs').onclick = (event) => {
        const button = event.target.closest('[data-pkg]');
        if (!button) return;
        packageId = button.dataset.pkg;
        const locationValue = view.querySelector('[name=location]').value;
        const notes = view.querySelector('[name=notes]').value;
        drawForm();
        view.querySelector('[name=location]').value = locationValue;
        view.querySelector('[name=notes]').value = notes;
      };
      document.getElementById('times').onclick = (event) => {
        const button = event.target.closest('[data-time]');
        if (!button || button.disabled) return;
        selectedTime = button.dataset.time;
        view.querySelectorAll('[data-time]').forEach((node) => node.classList.toggle('selected', node === button));
        drawSummaryOnly();
      };
      document.getElementById('book-form').onsubmit = submitBooking;
    };
    const drawSummaryOnly = () => {
      const pkg = service.packages.find((item) => item.id === packageId);
      const fee = Math.round((pkg.price * state.settings.platformFeePercent) / 100);
      const box = view.querySelector('.summary');
      if (!box) return;
      box.innerHTML = `<h2>Ringkasan</h2>
        <div><span>Jasa</span><strong>${esc(service.name)}</strong></div>
        <div><span>Penyedia</span><span>${esc(service.providerName)}</span></div>
        <div><span>Paket</span><span>${esc(pkg.name)}</span></div>
        <div><span>Tanggal</span><span>${selectedDate ? formatLongDate(selectedDate) : '—'}</span></div>
        <div><span>Jam</span><span>${selectedTime || '—'}</span></div>
        <div class="line"><span>Harga</span><span>${rupiah(pkg.price)}</span></div>
        <div class="line"><span>Biaya platform ${state.settings.platformFeePercent}%</span><span>${rupiah(fee)}</span></div>
        <div class="line total"><span>Total</span><span>${rupiah(pkg.price + fee)}</span></div>`;
    };
    const renderCalendar = () => {
      const year = month.getFullYear();
      const mon = month.getMonth();
      const offset = (new Date(year, mon, 1).getDay() + 6) % 7;
      const count = new Date(year, mon + 1, 0).getDate();
      const today = todayJakarta();
      let days = '<span class="dow">Sen</span><span class="dow">Sel</span><span class="dow">Rab</span><span class="dow">Kam</span><span class="dow">Jum</span><span class="dow">Sab</span><span class="dow">Min</span>';
      days += '<span></span>'.repeat(offset);
      for (let day = 1; day <= count; day += 1) {
        const iso = `${year}-${String(mon + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        const past = iso < today;
        days += `<button type="button" class="day ${iso === selectedDate ? 'selected' : ''}" data-date="${iso}" ${past ? 'disabled' : ''}>${day}</button>`;
      }
      document.getElementById('cal').innerHTML = `<div class="calendar"><div class="row"><button type="button" class="btn btn-sm" id="prev-month">‹</button><strong>${month.toLocaleDateString('id-ID', { month: 'long', year: 'numeric' })}</strong><button type="button" class="btn btn-sm" id="next-month">›</button></div><div class="cal-grid">${days}</div></div>`;
      document.getElementById('prev-month').onclick = () => {
        month = new Date(year, mon - 1, 1);
        renderCalendar();
      };
      document.getElementById('next-month').onclick = () => {
        month = new Date(year, mon + 1, 1);
        renderCalendar();
      };
      document.getElementById('cal').onclick = (event) => {
        const button = event.target.closest('[data-date]');
        if (!button || button.disabled) return;
        selectedDate = button.dataset.date;
        if (taken.has(`${selectedDate}|${selectedTime}`)) selectedTime = '';
        const locationValue = view.querySelector('[name=location]')?.value || '';
        const notes = view.querySelector('[name=notes]')?.value || '';
        drawForm();
        view.querySelector('[name=location]').value = locationValue;
        view.querySelector('[name=notes]').value = notes;
      };
    };
    async function submitBooking(event) {
      event.preventDefault();
      const error = document.getElementById('book-error');
      error.textContent = '';
      if (!selectedDate || !selectedTime) {
        error.textContent = 'Pilih tanggal dan jam terlebih dahulu.';
        return;
      }
      const button = event.target.querySelector('[type=submit]');
      button.disabled = true;
      try {
        const { booking } = await api('/api/bookings', {
          method: 'POST',
          body: { serviceId: service.id, packageId, date: selectedDate, time: selectedTime, location: event.target.location.value, notes: event.target.notes.value },
        });
        location.hash = `/pesanan/${booking.id}?baru=1`;
      } catch (err) {
        error.textContent = err.message;
        button.disabled = false;
      }
    }
    drawForm();
  } catch (error) {
    if (!stale()) view.innerHTML = errorBox(error.message);
  }
}

async function pageOrder(view, route, stale) {
  view.innerHTML = skeletonCards(1);
  try {
    const { booking } = await api(`/api/bookings/${route.parts[1]}`);
    if (stale()) return;
    const fresh = route.params.baru === '1';
    view.innerHTML = `
      ${fresh ? `<div class="success-banner"><strong>Pesanan berhasil</strong><span>Nomor pesanan Anda ${esc(booking.id)}. Simpan nomor ini untuk memantau status.</span></div>` : ''}
      <article class="card pad" style="margin-top:12px">
        <div class="row"><h1 class="display" style="font-size:2rem">${esc(booking.id)}</h1><span class="status status-${booking.status}">${STATUS_LABEL[booking.status]}</span></div>
        <p>${esc(booking.serviceName)}</p>
        <p class="muted">${esc(booking.providerName)} · ${esc(booking.packageName)}</p>
        <div class="line"><span>Tanggal</span><span>${formatLongDate(booking.date)} · ${esc(booking.time)}</span></div>
        <div class="line"><span>Lokasi</span><span>${esc(booking.location)}</span></div>
        ${booking.notes ? `<div class="line"><span>Catatan</span><span>${esc(booking.notes)}</span></div>` : ''}
        <div class="line"><span>Harga</span><span>${rupiah(booking.price)}</span></div>
        <div class="line"><span>Biaya platform</span><span>${rupiah(booking.platformFee)}</span></div>
        <div class="line total"><span>Total</span><span>${rupiah(booking.total)}</span></div>
        <div class="row">
          <a class="btn btn-sm" href="#/jasa/${booking.serviceId}">Lihat jasa</a>
          ${state.user?.role === 'customer' && ['pending', 'confirmed'].includes(booking.status) ? '<button class="btn btn-sm btn-danger" id="cancel" type="button">Batalkan pesanan</button>' : ''}
        </div>
      </article>
      <div id="review-box"></div>`;
    document.getElementById('cancel')?.addEventListener('click', async () => {
      const ok = await confirmDialog({ title: 'Batalkan pesanan?', text: 'Jadwal ini akan terbuka lagi untuk pelanggan lain.', confirm: 'Ya, batalkan', danger: true });
      if (!ok) return;
      try {
        await api(`/api/bookings/${booking.id}`, { method: 'PUT', body: { status: 'cancelled' } });
        toast('Pesanan dibatalkan');
        draw();
      } catch (error) {
        toast('Gagal membatalkan', error.message, 'error');
      }
    });
    if (state.user?.role === 'customer' && booking.status === 'completed' && !booking.reviewed) {
      document.getElementById('review-box').innerHTML = `
        <form class="card pad" id="review-form" style="margin-top:12px">
          <h2>Beri ulasan</h2>
          <p class="small muted">Ulasan hanya dibuka karena pesanan ini sudah selesai.</p>
          <div class="times" id="stars">${[1, 2, 3, 4, 5].map((n) => `<button type="button" class="time" data-star="${n}">${n}</button>`).join('')}</div>
          <label class="field">Ulasan<textarea class="input" name="text" minlength="10" required placeholder="Ceritakan pengalaman Anda, minimal 10 karakter."></textarea></label>
          <p class="form-error" id="review-error"></p>
          <button class="btn btn-primary" type="submit">Kirim ulasan</button>
        </form>`;
      let rating = 0;
      document.getElementById('stars').onclick = (event) => {
        const button = event.target.closest('[data-star]');
        if (!button) return;
        rating = Number(button.dataset.star);
        document.querySelectorAll('[data-star]').forEach((node) => node.classList.toggle('selected', Number(node.dataset.star) <= rating));
      };
      document.getElementById('review-form').onsubmit = async (event) => {
        event.preventDefault();
        if (!rating) {
          document.getElementById('review-error').textContent = 'Pilih nilai 1 sampai 5.';
          return;
        }
        try {
          await api('/api/reviews', { method: 'POST', body: { bookingId: booking.id, rating, text: event.target.text.value } });
          toast('Ulasan terkirim', 'Terima kasih, ulasan Anda tampil di halaman jasa.');
          location.hash = `/jasa/${booking.serviceId}`;
        } catch (error) {
          document.getElementById('review-error').textContent = error.message;
        }
      };
    } else if (booking.reviewed) {
      document.getElementById('review-box').innerHTML = '<p class="muted" style="margin-top:12px">Anda sudah memberi ulasan untuk pesanan ini.</p>';
    }
  } catch (error) {
    if (!stale()) view.innerHTML = errorBox(error.message);
  }
}

function pageHow(view) {
  view.innerHTML = `
    <h1 class="display" style="font-size:2.6rem">Cara kerja Andallo</h1>
    <p class="lead" style="color:var(--muted);margin:10px 0 20px">Andallo menggantikan kebiasaan membandingkan jasa lewat banyak akun media sosial.</p>
    <div class="steps">
      <article class="card step"><em>01 · Cari</em><h3>Temukan jasa di sekitar Anda</h3><p class="muted">Gunakan kata kunci, kategori, kota, rentang harga, dan rating. Urutkan dari yang terdekat bila lokasi diizinkan.</p></article>
      <article class="card step"><em>02 · Bandingkan</em><h3>Lihat harga yang tertulis</h3><p class="muted">Setiap jasa punya paket, portofolio, dan ulasan. Ulasan hanya berasal dari pesanan yang benar-benar selesai.</p></article>
      <article class="card step"><em>03 · Pesan</em><h3>Kunci jadwal di Andallo</h3><p class="muted">Pilih paket, tanggal, jam, dan alamat. Anda mendapat nomor pesanan dan dapat memantau statusnya.</p></article>
    </div>`;
}

function pageAbout(view) {
  view.innerHTML = `
    <div class="layout">
      <article class="stack">
        <p class="kicker">Tentang Andallo</p>
        <h1 class="display" style="font-size:2.8rem">Satu tempat untuk memilih jasa dengan lebih tenang.</h1>
        <p>Mencari fotografer, perias, katering, atau teknisi sering berarti membuka banyak percakapan yang berbeda. Portofolio ada di satu tempat, harga di tempat lain, dan ulasan sulit dilacak.</p>
        <p>Andallo mengumpulkan penyedia yang dikelola admin, harga paket yang tertulis, dan ulasan dari pelanggan yang sudah menyelesaikan pesanan. Anda bisa membandingkan, menyimpan, lalu memesan tanpa meninggalkan situs.</p>
      </article>
      <aside class="card pad">
        <h2>Yang bisa Anda lakukan</h2>
        <p>Mencari jasa di Tangerang, Jakarta, Bekasi, Bandung, dan Depok.</p>
        <p>Membandingkan hingga tiga jasa sekaligus.</p>
        <p>Menyimpan jasa dan memantau pesanan dari akun Anda.</p>
        <a class="btn btn-primary" href="#/daftar" style="margin-top:8px">Daftar Sekarang</a>
      </aside>
    </div>`;
}

function authShell(title, text, body) {
  return `<form class="card auth-wrap" id="auth-form"><a class="brand" href="#/">${logo()}</a><h1 class="display" style="font-size:2rem">${title}</h1><p class="muted">${text}</p>${body}<p class="form-error" id="auth-error"></p></form>`;
}

function pageLogin(view, route) {
  view.innerHTML = authShell('Masuk', 'Gunakan akun pelanggan atau admin.', `
    <label class="field">Email<input class="input" name="email" type="email" required autocomplete="username" /></label>
    <label class="field">Kata sandi<input class="input" name="password" type="password" required autocomplete="current-password" /></label>
    <button class="btn btn-primary" type="submit">Masuk</button>
    <p class="small"><a href="#/lupa-sandi">Lupa kata sandi?</a> · <a href="#/daftar">Daftar</a></p>
    <div class="demo"><p class="small muted">Akun demo · kata sandi Demo1234</p>
      <button class="btn" type="button" data-demo="rieke@andallo.com">Pelanggan · rieke@andallo.com</button>
      <button class="btn" type="button" data-demo="admin@andallo.com">Admin · admin@andallo.com</button>
    </div>`);
  const form = document.getElementById('auth-form');
  const submit = async (email, password) => {
    document.getElementById('auth-error').textContent = '';
    try {
      const data = await api('/api/auth/login', { method: 'POST', body: { email, password } });
      setSession(data.token, data.user);
      const next = route.params.lanjut;
      location.hash = next && next.startsWith('/') ? next : data.user.role === 'admin' ? '/admin' : '/akun';
    } catch (error) {
      document.getElementById('auth-error').textContent = error.message;
    }
  };
  form.onsubmit = (event) => {
    event.preventDefault();
    submit(form.email.value.trim(), form.password.value);
  };
  form.querySelectorAll('[data-demo]').forEach((button) => {
    button.onclick = () => submit(button.dataset.demo, 'Demo1234');
  });
}

function pageRegister(view, route) {
  view.innerHTML = authShell('Daftar', 'Buat akun pelanggan. Penyedia jasa didaftarkan oleh admin.', `
    <label class="field">Nama lengkap<input class="input" name="name" required minlength="3" autocomplete="name" /></label>
    <label class="field">Email<input class="input" name="email" type="email" required autocomplete="email" /></label>
    <label class="field">Nomor telepon<input class="input" name="phone" required placeholder="08xxxxxxxxxx" /></label>
    <label class="field">Kata sandi<input class="input" name="password" type="password" required minlength="8" autocomplete="new-password" /></label>
    <label class="field">Ulangi kata sandi<input class="input" name="confirmPassword" type="password" required minlength="8" /></label>
    <button class="btn btn-primary" type="submit">Daftar</button>
    <p class="small">Sudah punya akun? <a href="#/masuk">Masuk</a></p>`);
  document.getElementById('auth-form').onsubmit = async (event) => {
    event.preventDefault();
    const form = event.target;
    const error = document.getElementById('auth-error');
    error.textContent = '';
    if (form.password.value !== form.confirmPassword.value) {
      error.textContent = 'Konfirmasi kata sandi tidak sama.';
      return;
    }
    try {
      const data = await api('/api/auth/register', {
        method: 'POST',
        body: { name: form.name.value, email: form.email.value, phone: form.phone.value, password: form.password.value, confirmPassword: form.confirmPassword.value },
      });
      setSession(data.token, data.user);
      toast('Akun dibuat', 'Selamat datang di Andallo.');
      location.hash = route.params.lanjut?.startsWith('/') ? route.params.lanjut : '/akun';
    } catch (err) {
      error.textContent = err.message;
    }
  };
}

function pageForgot(view) {
  view.innerHTML = authShell('Lupa kata sandi', 'Kami buatkan tautan untuk mengatur ulang kata sandi.', `
    <label class="field">Email<input class="input" name="email" type="email" required /></label>
    <button class="btn btn-primary" type="submit">Buat tautan</button>
    <div id="reset-result"></div>`);
  document.getElementById('auth-form').onsubmit = async (event) => {
    event.preventDefault();
    try {
      const data = await api('/api/auth/forgot', { method: 'POST', body: { email: event.target.email.value } });
      document.getElementById('reset-result').innerHTML = `<p>${esc(data.message)}</p>${data.demoResetPath ? `<p class="small">Mode demo, email belum terhubung. <a href="${esc(data.demoResetPath)}">Buka tautan reset</a></p>` : ''}`;
    } catch (error) {
      document.getElementById('auth-error').textContent = error.message;
    }
  };
}

function pageReset(view, route) {
  view.innerHTML = authShell('Atur kata sandi baru', 'Gunakan minimal 8 karakter, dengan huruf dan angka.', `
    <label class="field">Kata sandi baru<input class="input" name="password" type="password" required minlength="8" /></label>
    <button class="btn btn-primary" type="submit">Simpan kata sandi</button>`);
  document.getElementById('auth-form').onsubmit = async (event) => {
    event.preventDefault();
    try {
      const data = await api('/api/auth/reset', { method: 'POST', body: { token: route.params.token || '', password: event.target.password.value } });
      toast('Berhasil', data.message);
      location.hash = '/masuk';
    } catch (error) {
      document.getElementById('auth-error').textContent = error.message;
    }
  };
}

async function pageAccount(view, route, stale) {
  const tab = route.parts[1] || 'ringkasan';
  const tabs = [
    ['', 'Ringkasan'],
    ['pesanan', 'Pesanan saya'],
    ['simpanan', 'Tersimpan'],
    ['ulasan', 'Ulasan'],
    ['profil', 'Profil'],
    ['pengaturan', 'Pengaturan'],
  ];
  const tabActive = (href) => (href === '' ? tab === 'ringkasan' : tab === href);
  view.innerHTML = `<div class="tabs">${tabs.map(([href, label]) => `<a class="tab ${tabActive(href) ? 'active' : ''}" href="#/akun${href ? `/${href}` : ''}">${label}</a>`).join('')}</div><div id="account-body">${skeletonCards(2)}</div>`;
  const body = document.getElementById('account-body');
  try {
    if (tab === 'profil') return accountProfile(body);
    if (tab === 'pengaturan') return accountSettings(body);
    if (tab === 'simpanan') return accountSaved(body, stale);
    if (tab === 'ulasan') return accountReviews(body, stale);
    const { bookings } = await api('/api/bookings');
    if (stale()) return;
    if (tab === 'pesanan') {
      const filter = route.params.status || 'all';
      const today = todayJakarta();
      const match = {
        all: () => true,
        upcoming: (item) => ['pending', 'confirmed'].includes(item.status) && item.date >= today,
        completed: (item) => item.status === 'completed',
        cancelled: (item) => item.status === 'cancelled',
      };
      body.innerHTML = `
        <div class="chips" style="margin-bottom:12px">
          ${[
            ['all', 'Semua'],
            ['upcoming', 'Akan datang'],
            ['completed', 'Selesai'],
            ['cancelled', 'Dibatalkan'],
          ].map(([id, label]) => `<a class="chip ${filter === id ? 'active' : ''}" href="#/akun/pesanan?status=${id}">${label}</a>`).join('')}
        </div>
        <div class="list">${bookings.filter(match[filter] || match.all).map(bookingRow).join('') || emptyState({ title: 'Belum ada pesanan di sini', text: 'Pesanan yang Anda buat akan muncul di daftar ini.', action: '<a class="btn btn-primary" href="#/jelajah">Cari jasa</a>' })}</div>`;
      return;
    }
    const today = todayJakarta();
    const upcoming = bookings.filter((item) => ['pending', 'confirmed'].includes(item.status) && item.date >= today);
    body.innerHTML = `
      <div class="stats">
        <div class="card stat"><span>Total pesanan</span><strong>${bookings.length}</strong></div>
        <div class="card stat"><span>Akan datang</span><strong>${upcoming.length}</strong></div>
        <div class="card stat"><span>Selesai</span><strong>${bookings.filter((item) => item.status === 'completed').length}</strong></div>
        <div class="card stat"><span>Dibatalkan</span><strong>${bookings.filter((item) => item.status === 'cancelled').length}</strong></div>
      </div>
      <h2 style="margin:18px 0 10px">Pesanan terdekat</h2>
      <div class="list">${upcoming.slice(0, 3).map(bookingRow).join('') || emptyState({ title: 'Tidak ada jadwal dekat', text: 'Kalau Anda memesan jasa, jadwalnya tampil di sini.' })}</div>`;
  } catch (error) {
    if (!stale()) body.innerHTML = errorBox(error.message);
  }
}

function bookingRow(booking) {
  return `<article class="card booking-row"><img src="${esc(booking.serviceImage)}" alt="" /><div><div class="row"><strong>${esc(booking.serviceName)}</strong><span class="status status-${booking.status}">${STATUS_LABEL[booking.status]}</span></div><p class="small muted">${esc(booking.id)} · ${esc(booking.providerName)} · ${formatDate(booking.date)} ${esc(booking.time)}</p><p class="price">${rupiah(booking.total)}</p></div><a class="btn btn-sm actions" href="#/pesanan/${booking.id}">Detail</a></article>`;
}

async function accountSaved(body, stale) {
  const { services } = await api('/api/saved');
  if (stale()) return;
  body.innerHTML = services.length ? `<div class="card-grid">${services.map(serviceCard).join('')}</div>` : emptyState({ title: 'Belum ada jasa tersimpan', text: 'Buka detail jasa dan pilih Simpan.', action: '<a class="btn btn-primary" href="#/jelajah">Jelajahi jasa</a>' });
}

async function accountReviews(body, stale) {
  const { reviews } = await api('/api/reviews?mine=1');
  if (stale()) return;
  body.innerHTML = reviews.length ? `<div class="reviews">${reviews.map(reviewCard).join('')}</div>` : emptyState({ title: 'Anda belum menulis ulasan', text: 'Ulasan bisa dikirim setelah pesanan berstatus selesai.' });
}

function accountProfile(body) {
  const user = state.user;
  body.innerHTML = `
    <div class="layout">
      <form class="card pad" id="profile-form">
        <h2>Profil</h2>
        <label class="field">Nama<input class="input" name="name" value="${esc(user.name)}" required minlength="3" /></label>
        <label class="field">Email<input class="input" value="${esc(user.email)}" disabled /></label>
        <label class="field">Telepon<input class="input" name="phone" value="${esc(user.phone)}" required /></label>
        <p class="form-error" id="profile-error"></p>
        <button class="btn btn-primary" type="submit">Simpan profil</button>
      </form>
      <aside class="card pad">
        <h2>Akun</h2>
        <p class="muted">Kata sandi diubah dari menu Pengaturan.</p>
        <a class="btn" href="#/akun/pengaturan">Buka pengaturan</a>
      </aside>
    </div>`;
  document.getElementById('profile-form').onsubmit = async (event) => {
    event.preventDefault();
    try {
      const data = await api('/api/me', { method: 'PUT', body: { name: event.target.name.value, phone: event.target.phone.value } });
      state.user = data.user;
      toast('Profil diperbarui');
    } catch (error) {
      document.getElementById('profile-error').textContent = error.message;
    }
  };
}

function accountSettings(body) {
  body.innerHTML = `
    <form class="card pad form-grid" id="password-form" style="max-width:520px">
      <h2>Kata sandi</h2>
      <p class="small muted">Minimal 8 karakter, berisi huruf dan angka.</p>
      <label class="field">Kata sandi saat ini<input class="input" name="currentPassword" type="password" required autocomplete="current-password" /></label>
      <label class="field">Kata sandi baru<input class="input" name="password" type="password" required minlength="8" autocomplete="new-password" /></label>
      <p class="form-error" id="password-error"></p>
      <button class="btn btn-primary" type="submit">Perbarui kata sandi</button>
    </form>`;
  document.getElementById('password-form').onsubmit = async (event) => {
    event.preventDefault();
    try {
      await api('/api/me/password', { method: 'PUT', body: { currentPassword: event.target.currentPassword.value, password: event.target.password.value } });
      event.target.reset();
      toast('Kata sandi diperbarui');
    } catch (error) {
      document.getElementById('password-error').textContent = error.message;
    }
  };
}

async function pageAdmin(view, route, stale) {
  const section = route.parts[1] || 'ringkasan';
  try {
    if (section === 'penyedia') return adminProviders(view, route, stale);
    if (section === 'jasa') return adminServices(view, route, stale);
    if (section === 'kategori') return adminCategories(view, stale);
    if (section === 'pesanan') return adminBookings(view, stale);
    if (section === 'ulasan') return adminReviews(view, stale);
    if (section === 'pelanggan') return adminCustomers(view, stale);
    if (section === 'pengaturan') return adminSettings(view, stale);
    const [{ stats }, { bookings }] = await Promise.all([api('/api/admin/stats'), api('/api/bookings')]);
    if (stale()) return;
    const max = Math.max(1, ...Object.values(stats.byStatus));
    view.innerHTML = `
      <h1 class="display" style="font-size:2.2rem;margin-bottom:14px">Ringkasan</h1>
      <div class="stats">
        ${[
          ['Pelanggan', stats.customers],
          ['Penyedia', stats.providers],
          ['Jasa', stats.services],
          ['Pesanan', stats.bookings],
          ['Selesai', stats.completed],
          ['Dibatalkan', stats.cancelled],
          ['Pendapatan', rupiah(stats.revenue)],
        ].map(([label, value]) => `<div class="card stat"><span>${label}</span><strong>${value}</strong></div>`).join('')}
      </div>
      <div class="layout" style="margin-top:16px">
        <section class="card bars"><h2>Pesanan per status</h2>${Object.entries(stats.byStatus)
          .map(([status, count]) => `<div class="bar"><span>${STATUS_LABEL[status]}</span><span class="track"><span style="width:${(count / max) * 100}%"></span></span><strong>${count}</strong></div>`)
          .join('')}</section>
        <section class="stack"><h2>Pesanan terbaru</h2>${bookings.slice(0, 5).map((booking) => `<a class="card pad" href="#/admin/pesanan"><strong>${esc(booking.id)}</strong><br><span class="small">${esc(booking.customerName)} · ${esc(booking.serviceName)}</span></a>`).join('')}</section>
      </div>`;
  } catch (error) {
    if (!stale()) view.innerHTML = errorBox(error.message);
  }
}

async function adminProviders(view, route, stale) {
  const id = route.parts[2];
  if (id) return providerEditor(view, id === 'baru' ? null : id, stale);
  const { providers } = await api('/api/providers?kelola=1');
  if (stale()) return;
  view.innerHTML = `
    <div class="section-head"><h1 class="display" style="font-size:2rem">Penyedia jasa</h1><a class="btn btn-primary" href="#/admin/penyedia/baru">Tambah penyedia</a></div>
    <div class="card table-wrap"><table><thead><tr><th>Usaha</th><th>Kota</th><th>Kategori</th><th>Status</th><th></th></tr></thead><tbody>
      ${providers
        .map(
          (provider) => `<tr><td><strong>${esc(provider.businessName)}</strong><br><span class="small muted">${esc(provider.name)}</span></td><td>${esc(provider.city)}</td><td>${esc(provider.categoryName)}</td><td>${provider.active ? 'Aktif' : 'Nonaktif'} ${provider.verified ? '· Terverifikasi' : ''}</td><td class="row"><a class="btn btn-sm" href="#/admin/penyedia/${provider.id}">Ubah</a><button class="btn btn-sm" data-toggle="${provider.id}" type="button">${provider.active ? 'Nonaktifkan' : 'Aktifkan'}</button><button class="btn btn-sm btn-danger" data-del="${provider.id}" type="button">Hapus</button></td></tr>`,
        )
        .join('')}
    </tbody></table></div>`;
  view.onclick = async (event) => {
    const toggle = event.target.closest('[data-toggle]');
    const del = event.target.closest('[data-del]');
    if (toggle) {
      const provider = providers.find((item) => item.id === toggle.dataset.toggle);
      await api(`/api/providers/${provider.id}`, { method: 'PUT', body: { active: !provider.active } });
      toast(provider.active ? 'Penyedia dinonaktifkan' : 'Penyedia diaktifkan');
      draw();
    }
    if (del) {
      const ok = await confirmDialog({ title: 'Hapus penyedia?', text: 'Jasa yang terhubung ikut terhapus. Pesanan aktif akan menolak penghapusan.', confirm: 'Hapus', danger: true });
      if (!ok) return;
      try {
        await api(`/api/providers/${del.dataset.del}`, { method: 'DELETE' });
        toast('Penyedia dihapus');
        draw();
      } catch (error) {
        toast('Tidak bisa dihapus', error.message, 'error');
      }
    }
  };
}

async function providerEditor(view, id, stale) {
  const existing = id ? (await api(`/api/providers/${id}?kelola=1`)).provider : null;
  if (stale()) return;
  const value = existing || { name: '', businessName: '', image: '', description: '', phone: '', email: '', city: 'Jakarta', location: '', categoryId: state.categories[0]?.id, verified: false, active: true };
  view.innerHTML = `
    <h1 class="display" style="font-size:2rem;margin-bottom:12px">${existing ? 'Ubah penyedia' : 'Penyedia baru'}</h1>
    <form class="card pad form-grid" id="provider-form">
      <div class="two"><label class="field">Nama penanggung jawab<input class="input" name="name" required value="${esc(value.name)}" /></label><label class="field">Nama usaha<input class="input" name="businessName" required value="${esc(value.businessName)}" /></label></div>
      <label class="field">Foto profil (tautan https)<input class="input" name="image" required value="${esc(value.image)}" /></label>
      <label class="field">Deskripsi<textarea class="input" name="description" required minlength="20">${esc(value.description)}</textarea></label>
      <div class="two"><label class="field">Telepon<input class="input" name="phone" required value="${esc(value.phone)}" /></label><label class="field">Email<input class="input" name="email" type="email" required value="${esc(value.email)}" /></label></div>
      <div class="two"><label class="field">Kota<select class="select" name="city">${cityOptions(value.city, 'Pilih kota')}</select></label><label class="field">Kategori<select class="select" name="categoryId">${categoryOptions(value.categoryId, 'Pilih kategori')}</select></label></div>
      <label class="field">Alamat / area<input class="input" name="location" required value="${esc(value.location)}" /></label>
      <label class="check"><input type="checkbox" name="verified" ${value.verified ? 'checked' : ''}/> Terverifikasi</label>
      <label class="check"><input type="checkbox" name="active" ${value.active ? 'checked' : ''}/> Aktif dan tampil ke pelanggan</label>
      <p class="form-error" id="form-error"></p>
      <button class="btn btn-primary" type="submit">Simpan</button>
    </form>
    ${existing ? `<form class="card pad form-grid" id="folio-form" style="margin-top:14px"><h2>Tambah portofolio</h2><label class="field">Judul<input class="input" name="title" required /></label><label class="field">Deskripsi<textarea class="input" name="description"></textarea></label><div class="two"><label class="field">Tanggal<input class="input" name="date" type="date" required /></label><label class="field">Foto https<input class="input" name="image" required /></label></div><button class="btn" type="submit">Tambah</button></form>` : ''}`;
  document.getElementById('provider-form').onsubmit = async (event) => {
    event.preventDefault();
    const form = event.target;
    const body = {
      name: form.name.value,
      businessName: form.businessName.value,
      image: form.image.value,
      description: form.description.value,
      phone: form.phone.value,
      email: form.email.value,
      city: form.city.value,
      categoryId: form.categoryId.value,
      location: form.location.value,
      verified: form.verified.checked,
      active: form.active.checked,
    };
    try {
      if (existing) await api(`/api/providers/${existing.id}`, { method: 'PUT', body });
      else await api('/api/providers', { method: 'POST', body });
      toast('Penyedia disimpan');
      location.hash = '/admin/penyedia';
    } catch (error) {
      document.getElementById('form-error').textContent = error.message;
    }
  };
  document.getElementById('folio-form')?.addEventListener('submit', async (event) => {
    event.preventDefault();
    try {
      await api(`/api/providers/${existing.id}/portfolio`, { method: 'POST', body: { title: event.target.title.value, description: event.target.description.value, date: event.target.date.value, image: event.target.image.value, category: existing.categoryName } });
      toast('Portofolio ditambahkan');
      event.target.reset();
    } catch (error) {
      toast('Gagal menambah portofolio', error.message, 'error');
    }
  });
}

async function adminServices(view, route, stale) {
  const id = route.parts[2];
  if (id) return serviceEditor(view, id === 'baru' ? null : id, stale);
  const { services } = await api('/api/services?kelola=1');
  if (stale()) return;
  view.innerHTML = `
    <div class="section-head"><h1 class="display" style="font-size:2rem">Jasa</h1><a class="btn btn-primary" href="#/admin/jasa/baru">Tambah jasa</a></div>
    <div class="card table-wrap"><table><thead><tr><th>Jasa</th><th>Penyedia</th><th>Harga mulai</th><th>Status</th><th></th></tr></thead><tbody>
      ${services.map((service) => `<tr><td><strong>${esc(service.name)}</strong><br><span class="small muted">${esc(service.categoryName)} · ${esc(service.city)}</span></td><td>${esc(service.providerName)}</td><td>${rupiah(service.price)}</td><td>${service.active ? 'Aktif' : 'Nonaktif'}${service.available ? '' : ' · Penuh'}${service.featured ? ' · Unggulan' : ''}</td><td><a class="btn btn-sm" href="#/admin/jasa/${service.id}">Ubah</a> <button class="btn btn-sm btn-danger" data-del="${service.id}" type="button">Hapus</button></td></tr>`).join('')}
    </tbody></table></div>`;
  view.onclick = async (event) => {
    const del = event.target.closest('[data-del]');
    if (!del) return;
    const ok = await confirmDialog({ title: 'Hapus jasa ini?', text: 'Jasa tidak lagi tampil di pencarian pelanggan.', confirm: 'Hapus', danger: true });
    if (!ok) return;
    await api(`/api/services/${del.dataset.del}`, { method: 'DELETE' });
    toast('Jasa dihapus');
    draw();
  };
}

async function serviceEditor(view, id, stale) {
  const [{ providers }, existingData] = await Promise.all([api('/api/providers?kelola=1'), id ? api(`/api/services/${id}?kelola=1`) : Promise.resolve(null)]);
  if (stale()) return;
  const existing = existingData?.service;
  const packages = existing?.packages?.length ? existing.packages : [{ name: '', description: '', price: '', duration: '' }];
  const images = existing?.images?.length ? existing.images : [''];
  view.innerHTML = `
    <h1 class="display" style="font-size:2rem;margin-bottom:12px">${existing ? 'Ubah jasa' : 'Jasa baru'}</h1>
    <form class="card pad form-grid" id="service-form">
      <label class="field">Nama jasa<input class="input" name="name" required value="${esc(existing?.name || '')}" /></label>
      <div class="two"><label class="field">Penyedia<select class="select" name="providerId">${providers.map((provider) => `<option value="${provider.id}" ${provider.id === existing?.providerId ? 'selected' : ''}>${esc(provider.businessName)}</option>`).join('')}</select></label>
      <label class="field">Kategori<select class="select" name="categoryId">${categoryOptions(existing?.categoryId || '', 'Pilih')}</select></label></div>
      <label class="field">Deskripsi<textarea class="input" name="description" required minlength="20">${esc(existing?.description || '')}</textarea></label>
      <div class="two"><label class="field">Kota<select class="select" name="city">${cityOptions(existing?.city || '', 'Pilih kota')}</select></label><label class="field">Area layanan<input class="input" name="location" required value="${esc(existing?.location || '')}" /></label></div>
      <div><div class="row"><strong>Paket</strong><button class="btn btn-sm" type="button" id="add-pkg">Tambah paket</button></div><div id="pkg-list" class="stack" style="margin-top:8px"></div></div>
      <div><div class="row"><strong>Foto (tautan https)</strong><button class="btn btn-sm" type="button" id="add-img">Tambah foto</button></div><div id="img-list" class="stack" style="margin-top:8px"></div></div>
      <label class="check"><input type="checkbox" name="available" ${existing?.available !== false ? 'checked' : ''}/> Menerima pesanan</label>
      <label class="check"><input type="checkbox" name="active" ${existing?.active !== false ? 'checked' : ''}/> Tampil di situs</label>
      <label class="check"><input type="checkbox" name="featured" ${existing?.featured ? 'checked' : ''}/> Jadikan unggulan</label>
      <p class="form-error" id="form-error"></p>
      <button class="btn btn-primary" type="submit">Simpan jasa</button>
    </form>`;
  const pkgList = document.getElementById('pkg-list');
  const imgList = document.getElementById('img-list');
  const addPkg = (pkg = { name: '', description: '', price: '', duration: '' }) => {
    const row = document.createElement('div');
    row.className = 'card pad';
    row.innerHTML = `<div class="two"><input class="input" data-name placeholder="Nama paket" value="${esc(pkg.name)}" /><input class="input" data-price type="number" placeholder="Harga" value="${esc(pkg.price)}" /></div><div class="two" style="margin-top:8px"><input class="input" data-duration placeholder="Durasi" value="${esc(pkg.duration || '')}" /><input class="input" data-desc placeholder="Deskripsi singkat" value="${esc(pkg.description || '')}" /></div>`;
    pkgList.append(row);
  };
  const addImg = (url = '') => {
    const row = document.createElement('input');
    row.className = 'input';
    row.dataset.image = '1';
    row.placeholder = 'https://';
    row.value = url;
    imgList.append(row);
  };
  packages.forEach(addPkg);
  images.forEach(addImg);
  document.getElementById('add-pkg').onclick = () => addPkg();
  document.getElementById('add-img').onclick = () => addImg();
  document.getElementById('service-form').onsubmit = async (event) => {
    event.preventDefault();
    const form = event.target;
    const body = {
      name: form.name.value,
      providerId: form.providerId.value,
      categoryId: form.categoryId.value,
      description: form.description.value,
      city: form.city.value,
      location: form.location.value,
      packages: [...pkgList.children].map((row) => ({ name: row.querySelector('[data-name]').value, price: Number(row.querySelector('[data-price]').value), duration: row.querySelector('[data-duration]').value, description: row.querySelector('[data-desc]').value })),
      images: [...imgList.querySelectorAll('[data-image]')].map((input) => input.value).filter(Boolean),
      available: form.available.checked,
      active: form.active.checked,
      featured: form.featured.checked,
    };
    try {
      if (existing) await api(`/api/services/${existing.id}`, { method: 'PUT', body });
      else await api('/api/services', { method: 'POST', body });
      toast('Jasa disimpan', 'Perubahan sudah tampil di situs pelanggan.');
      location.hash = '/admin/jasa';
    } catch (error) {
      document.getElementById('form-error').textContent = error.message;
    }
  };
}

async function adminCategories(view, stale) {
  const { categories } = await api('/api/categories');
  if (stale()) return;
  state.categories = categories;
  view.innerHTML = `
    <h1 class="display" style="font-size:2rem;margin-bottom:12px">Kategori</h1>
    <form class="card pad row" id="cat-form"><input class="input" name="name" placeholder="Nama kategori baru" required minlength="3" /><button class="btn btn-primary" type="submit">Tambah</button></form>
    <div class="card table-wrap" style="margin-top:12px"><table><thead><tr><th>Nama</th><th>Jumlah jasa</th><th></th></tr></thead><tbody>
      ${categories.map((category) => `<tr><td><input class="input" value="${esc(category.name)}" data-name="${category.id}" /></td><td>${category.serviceCount}</td><td class="row"><button class="btn btn-sm" data-save="${category.id}" type="button">Simpan</button><button class="btn btn-sm btn-danger" data-del="${category.id}" type="button">Hapus</button></td></tr>`).join('')}
    </tbody></table></div>`;
  document.getElementById('cat-form').onsubmit = async (event) => {
    event.preventDefault();
    try {
      await api('/api/categories', { method: 'POST', body: { name: event.target.name.value } });
      toast('Kategori ditambahkan');
      draw();
    } catch (error) {
      toast('Gagal', error.message, 'error');
    }
  };
  view.onclick = async (event) => {
    const save = event.target.closest('[data-save]');
    const del = event.target.closest('[data-del]');
    if (save) {
      const name = view.querySelector(`[data-name="${save.dataset.save}"]`).value;
      try {
        await api(`/api/categories/${save.dataset.save}`, { method: 'PUT', body: { name } });
        toast('Kategori diperbarui');
        draw();
      } catch (error) {
        toast('Gagal', error.message, 'error');
      }
    }
    if (del) {
      const ok = await confirmDialog({ title: 'Hapus kategori?', text: 'Hanya bisa jika tidak ada jasa atau penyedia yang memakainya.', confirm: 'Hapus', danger: true });
      if (!ok) return;
      try {
        await api(`/api/categories/${del.dataset.del}`, { method: 'DELETE' });
        toast('Kategori dihapus');
        draw();
      } catch (error) {
        toast('Tidak bisa dihapus', error.message, 'error');
      }
    }
  };
}

async function adminBookings(view, stale) {
  const { bookings } = await api('/api/bookings');
  if (stale()) return;
  view.innerHTML = `
    <h1 class="display" style="font-size:2rem;margin-bottom:12px">Pesanan</h1>
    <div class="card table-wrap"><table><thead><tr><th>ID</th><th>Pelanggan</th><th>Jasa</th><th>Jadwal</th><th>Total</th><th>Status</th></tr></thead><tbody>
      ${bookings
        .map(
          (booking) => `<tr><td><a href="#/pesanan/${booking.id}">${esc(booking.id)}</a></td><td>${esc(booking.customerName)}</td><td>${esc(booking.serviceName)}<br><span class="small muted">${esc(booking.providerName)}</span></td><td>${formatDate(booking.date)} ${esc(booking.time)}</td><td>${rupiah(booking.total)}</td><td><select class="select" data-status="${booking.id}">${Object.entries(STATUS_LABEL).map(([value, label]) => `<option value="${value}" ${booking.status === value ? 'selected' : ''}>${label}</option>`).join('')}</select></td></tr>`,
        )
        .join('')}
    </tbody></table></div>`;
  view.onchange = async (event) => {
    const select = event.target.closest('[data-status]');
    if (!select) return;
    try {
      await api(`/api/bookings/${select.dataset.status}`, { method: 'PUT', body: { status: select.value } });
      toast('Status diperbarui', 'Pelanggan akan melihat status yang baru.');
    } catch (error) {
      toast('Gagal', error.message, 'error');
    }
  };
}

async function adminReviews(view, stale) {
  const { reviews } = await api('/api/reviews');
  if (stale()) return;
  view.innerHTML = `<h1 class="display" style="font-size:2rem;margin-bottom:12px">Ulasan</h1><div class="reviews">${reviews.map(reviewCard).join('') || '<p class="muted">Belum ada ulasan.</p>'}</div>`;
}

async function adminCustomers(view, stale) {
  const { customers } = await api('/api/customers');
  if (stale()) return;
  view.innerHTML = `<h1 class="display" style="font-size:2rem;margin-bottom:12px">Pelanggan</h1><div class="card table-wrap"><table><thead><tr><th>Nama</th><th>Email</th><th>Telepon</th><th>Bergabung</th></tr></thead><tbody>
    ${customers.map((customer) => `<tr><td>${esc(customer.name)}</td><td>${esc(customer.email)}</td><td>${esc(customer.phone)}</td><td>${formatDate(customer.createdAt)}</td></tr>`).join('')}
  </tbody></table></div>`;
}

async function adminSettings(view, stale) {
  const { settings } = await api('/api/settings');
  if (stale()) return;
  view.innerHTML = `
    <h1 class="display" style="font-size:2rem;margin-bottom:12px">Pengaturan</h1>
    <form class="card pad form-grid" id="settings-form" style="max-width:520px">
      <label class="field">Biaya platform (%)<input class="input" name="platformFeePercent" type="number" min="0" max="30" required value="${settings.platformFeePercent}" /></label>
      <label class="field">Email dukungan<input class="input" name="supportEmail" type="email" required value="${esc(settings.supportEmail)}" /></label>
      <p class="small muted">Biaya ini ditambahkan pada setiap pesanan baru. Pesanan yang sudah dibuat tidak berubah.</p>
      <button class="btn btn-primary" type="submit">Simpan</button>
    </form>`;
  document.getElementById('settings-form').onsubmit = async (event) => {
    event.preventDefault();
    try {
      const data = await api('/api/settings', { method: 'PUT', body: { platformFeePercent: Number(event.target.platformFeePercent.value), supportEmail: event.target.supportEmail.value } });
      state.settings = data.settings;
      toast('Pengaturan disimpan');
    } catch (error) {
      toast('Gagal', error.message, 'error');
    }
  };
}

function draw() {
  const generation = bumpGeneration();
  const route = parseRoute();
  const stale = () => !isCurrent(generation);
  if (route.parts[0] === 'admin' && state.user?.role !== 'admin') {
    location.hash = `/masuk?lanjut=${encodeURIComponent(route.path)}`;
    return;
  }
  if (route.parts[0] === 'akun' && state.user?.role !== 'customer') {
    location.hash = state.user?.role === 'admin' ? '/admin' : `/masuk?lanjut=${encodeURIComponent(route.path + (location.hash.includes('?') ? `?${location.hash.split('?')[1]}` : ''))}`;
    return;
  }
  if (route.parts[0] === 'pesan' && state.user?.role !== 'customer') {
    location.hash = `/masuk?lanjut=${encodeURIComponent(`/pesan/${route.parts[1] || ''}`)}`;
    return;
  }
  const home = route.parts.length === 0;
  const view = route.parts[0] === 'admin' ? paintAdmin(route) : paintPublic(route);
  if (home) document.querySelector('.topbar').insertAdjacentHTML('afterend', homeHero());
  if (home) {
    document.getElementById('home-search').onsubmit = (event) => {
      event.preventDefault();
      const data = new FormData(event.target);
      setCity(String(data.get('city') || ''));
      const query = new URLSearchParams();
      if (data.get('q')) query.set('q', String(data.get('q')));
      if (data.get('city')) query.set('city', String(data.get('city')));
      location.hash = `/jelajah${query.toString() ? `?${query}` : ''}`;
    };
  }
  const pages = {
    '': pageHome,
    jelajah: pageExplore,
    'cara-kerja': pageHow,
    tentang: pageAbout,
    masuk: pageLogin,
    daftar: pageRegister,
    'lupa-sandi': pageForgot,
    'atur-sandi': pageReset,
    jasa: pageService,
    penyedia: pageProvider,
    bandingkan: pageCompare,
    pesan: pageBook,
    pesanan: pageOrder,
    akun: pageAccount,
    admin: pageAdmin,
  };
  const page = pages[route.parts[0] || ''];
  if (!page) {
    view.innerHTML = emptyState({ title: 'Halaman tidak ditemukan', text: 'Tautan ini tidak mengarah ke halaman Andallo.', action: '<a class="btn" href="#/">Ke beranda</a>' });
    return;
  }
  Promise.resolve(page(view, route, stale)).catch((error) => {
    if (!stale()) view.innerHTML = errorBox(error instanceof ApiError ? error.message : 'Halaman gagal dimuat.');
  });
}

async function boot() {
  try {
    if (state.token) {
      try {
        state.user = (await api('/api/me')).user;
      } catch {
        setSession('', null);
      }
    }
    const [categories, settings] = await Promise.all([api('/api/categories'), api('/api/settings')]);
    state.categories = categories.categories;
    state.settings = settings.settings;
  } catch (error) {
    document.getElementById('app').innerHTML = `<div class="page">${errorBox(error.message || 'Gagal memuat Andallo')}</div>`;
    return;
  }
  window.addEventListener('hashchange', draw);
  draw();
}

boot();
