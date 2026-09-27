import crypto from 'node:crypto';
import { DomainError } from './errors.js';

export const CITIES = {
  Tangerang: { lat: -6.1783, lng: 106.6319 },
  Jakarta: { lat: -6.2088, lng: 106.8456 },
  Bekasi: { lat: -6.2383, lng: 106.9756 },
  Bandung: { lat: -6.9175, lng: 107.6191 },
  Depok: { lat: -6.4025, lng: 106.7942 },
};

export const TIME_SLOTS = ['08:00', '09:00', '10:00', '11:00', '13:00', '14:00', '15:00', '16:00', '17:00'];

export const BOOKING_STATUSES = ['pending', 'confirmed', 'completed', 'cancelled'];

const COLLECTIONS = ['users', 'categories', 'providers', 'services', 'portfolios', 'reviews', 'bookings', 'savedServices', 'revokedTokens', 'resetTokens'];

export function haversineKm(a, b) {
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(h));
}

export function todayJakarta() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta' }).format(new Date());
}

function id(prefix) {
  return `${prefix}_${crypto.randomBytes(5).toString('hex')}`;
}

function clean(value, max) {
  if (typeof value !== 'string') return '';
  return value.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '').trim().slice(0, max);
}

function emailOf(value) {
  const email = clean(value, 200).toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new DomainError(400, 'Format email tidak valid.');
  return email;
}

function phoneOf(value) {
  const phone = clean(value, 20).replace(/[\s-]/g, '');
  if (!/^(08\d{8,12}|62\d{9,13})$/.test(phone)) {
    throw new DomainError(400, 'Nomor telepon harus diawali 08 atau 62.');
  }
  return phone;
}

function passwordOf(value) {
  const password = typeof value === 'string' ? value : '';
  if (password.length < 8) throw new DomainError(400, 'Kata sandi minimal 8 karakter.');
  if (!/[A-Za-z]/.test(password) || !/\d/.test(password)) {
    throw new DomainError(400, 'Kata sandi harus memuat huruf dan angka.');
  }
  return password;
}

function httpsUrl(value) {
  const url = clean(value, 500);
  if (!/^https:\/\/\S+$/.test(url)) throw new DomainError(400, 'Alamat gambar harus berupa tautan https.');
  return url;
}

function cityOf(value) {
  const city = clean(value, 40);
  if (!CITIES[city]) throw new DomainError(400, 'Pilih lokasi yang tersedia: Tangerang, Jakarta, Bekasi, Bandung, atau Depok.');
  return city;
}

function money(value) {
  const n = Number(value);
  if (!Number.isInteger(n) || n < 1000) throw new DomainError(400, 'Harga minimal Rp1.000.');
  return n;
}

function bool(value, fallback = false) {
  if (value === undefined) return fallback;
  return Boolean(value);
}

export function ensureShape(db) {
  for (const key of COLLECTIONS) if (!Array.isArray(db[key])) db[key] = [];
  if (!db.settings || typeof db.settings !== 'object') {
    db.settings = { platformFeePercent: 5, supportEmail: 'halo@andallo.id' };
  }
  if (!Number.isFinite(db.settings.platformFeePercent)) db.settings.platformFeePercent = 5;
}

export function createData(db) {
  ensureShape(db);

  const byId = (list, itemId) => list.find((item) => item.id === itemId);
  const categoryName = (categoryId) => byId(db.categories, categoryId)?.name || '';
  const providerOf = (providerId) => byId(db.providers, providerId);
  const serviceOf = (serviceId) => byId(db.services, serviceId);

  function reviewsFor(serviceId) {
    return db.reviews.filter((r) => r.serviceId === serviceId);
  }

  function ratingOf(serviceId) {
    const list = reviewsFor(serviceId);
    if (!list.length) return { rating: 0, reviewCount: 0 };
    const avg = list.reduce((sum, r) => sum + r.rating, 0) / list.length;
    return { rating: Math.round(avg * 10) / 10, reviewCount: list.length };
  }

  function startingPrice(service) {
    const prices = (service.packages || []).map((p) => p.price);
    return prices.length ? Math.min(...prices) : 0;
  }

  function quote(price) {
    const platformFee = Math.round((price * db.settings.platformFeePercent) / 100);
    return { price, platformFee, platformFeePercent: db.settings.platformFeePercent, total: price + platformFee };
  }

  function publicUser(user) {
    if (!user) return null;
    const { passwordHash, ...rest } = user;
    return rest;
  }

  function publicReview(review) {
    const service = serviceOf(review.serviceId);
    return {
      id: review.id,
      bookingId: review.bookingId,
      serviceId: review.serviceId,
      serviceName: service?.name || review.serviceName,
      providerId: review.providerId,
      customerName: review.customerName,
      rating: review.rating,
      text: review.text,
      createdAt: review.createdAt,
    };
  }

  function serviceCard(service, origin) {
    const provider = providerOf(service.providerId);
    const { rating, reviewCount } = ratingOf(service.id);
    const point = { lat: service.lat, lng: service.lng };
    return {
      id: service.id,
      name: service.name,
      description: service.description,
      categoryId: service.categoryId,
      categoryName: categoryName(service.categoryId),
      providerId: service.providerId,
      providerName: provider?.businessName || '',
      providerImage: provider?.image || '',
      providerVerified: Boolean(provider?.verified),
      city: service.city,
      location: service.location,
      lat: service.lat,
      lng: service.lng,
      images: service.images,
      packages: service.packages,
      price: startingPrice(service),
      rating,
      reviewCount,
      available: Boolean(service.available && service.active && provider?.active),
      active: service.active,
      featured: Boolean(service.featured),
      distanceKm: origin ? Math.round(haversineKm(origin, point) * 10) / 10 : null,
    };
  }

  function visibleService(service) {
    const provider = providerOf(service.providerId);
    return Boolean(service?.active && provider?.active);
  }

  function listServices({ q = '', category = '', city = '', minPrice, maxPrice, minRating, available, featured, sort = 'recommended', lat, lng, manage = false } = {}) {
    const origin = Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng } : city && CITIES[city] ? CITIES[city] : null;
    let list = db.services.filter((service) => (manage ? true : visibleService(service)));
    if (category) list = list.filter((s) => s.categoryId === category || categoryName(s.categoryId).toLowerCase() === category.toLowerCase());
    if (city) list = list.filter((s) => s.city === city);
    if (featured === true) list = list.filter((s) => s.featured);
    if (available === true) list = list.filter((s) => s.available && visibleService(s));
    if (available === false) list = list.filter((s) => !s.available);
    const query = q.toLowerCase();
    if (query) {
      list = list.filter((s) => {
        const provider = providerOf(s.providerId);
        return [s.name, s.description, provider?.businessName, provider?.name, categoryName(s.categoryId)]
          .filter(Boolean)
          .some((field) => field.toLowerCase().includes(query));
      });
    }
    let cards = list.map((s) => serviceCard(s, origin));
    if (minPrice != null) cards = cards.filter((s) => s.price >= minPrice);
    if (maxPrice != null) cards = cards.filter((s) => s.price <= maxPrice);
    if (minRating != null) cards = cards.filter((s) => s.rating >= minRating);
    const sorters = {
      recommended: (a, b) => Number(b.featured) - Number(a.featured) || b.rating - a.rating || a.price - b.price,
      price_asc: (a, b) => a.price - b.price,
      rating: (a, b) => b.rating - a.rating || b.reviewCount - a.reviewCount,
      nearest: (a, b) => (a.distanceKm ?? 9999) - (b.distanceKm ?? 9999),
    };
    cards.sort(sorters[sort] || sorters.recommended);
    return cards;
  }

  function takenSlots(serviceId) {
    return db.bookings
      .filter((b) => b.serviceId === serviceId && (b.status === 'pending' || b.status === 'confirmed'))
      .map((b) => ({ date: b.date, time: b.time }));
  }

  function getService(serviceId, { manage = false } = {}) {
    const service = serviceOf(serviceId);
    if (!service || (!manage && !visibleService(service))) throw new DomainError(404, 'Jasa tidak ditemukan.');
    const provider = providerOf(service.providerId);
    const card = serviceCard(service, CITIES[service.city]);
    return {
      service: card,
      provider: provider ? publicProvider(provider) : null,
      portfolio: db.portfolios.filter((p) => p.providerId === service.providerId || p.serviceId === service.id),
      reviews: reviewsFor(service.id).map(publicReview).sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt)),
      takenSlots: takenSlots(service.id),
      quote: quote(card.price),
    };
  }

  function packagesOf(input, previous = []) {
    if (!Array.isArray(input) || !input.length) throw new DomainError(400, 'Minimal satu paket layanan.');
    return input.slice(0, 6).map((pkg, index) => ({
      id: clean(pkg.id, 40) || previous[index]?.id || id('pkg'),
      name: clean(pkg.name, 80) || (() => { throw new DomainError(400, 'Nama paket wajib diisi.'); })(),
      description: clean(pkg.description, 300),
      price: money(pkg.price),
      duration: clean(pkg.duration, 40),
    }));
  }

  function imagesOf(input) {
    if (!Array.isArray(input) || !input.length) throw new DomainError(400, 'Minimal satu foto layanan.');
    return input.slice(0, 8).map(httpsUrl);
  }

  function writeService(current, input) {
    const provider = providerOf(input.providerId || current?.providerId);
    if (!provider) throw new DomainError(400, 'Penyedia jasa tidak ditemukan.');
    const category = byId(db.categories, input.categoryId || current?.categoryId);
    if (!category) throw new DomainError(400, 'Kategori tidak ditemukan.');
    const name = clean(input.name ?? current?.name, 120);
    if (name.length < 3) throw new DomainError(400, 'Nama jasa minimal 3 karakter.');
    const description = clean(input.description ?? current?.description, 2000);
    if (description.length < 20) throw new DomainError(400, 'Deskripsi jasa minimal 20 karakter.');
    const city = cityOf(input.city || current?.city);
    const location = clean(input.location ?? current?.location, 160);
    if (location.length < 3) throw new DomainError(400, 'Alamat atau area layanan wajib diisi.');
    const packages = input.packages ? packagesOf(input.packages, current?.packages) : current?.packages;
    const images = input.images ? imagesOf(input.images) : current?.images;
    if (!packages?.length) throw new DomainError(400, 'Minimal satu paket layanan.');
    if (!images?.length) throw new DomainError(400, 'Minimal satu foto layanan.');
    return {
      id: current?.id || id('svc'),
      providerId: provider.id,
      categoryId: category.id,
      name,
      description,
      city,
      location,
      lat: CITIES[city].lat + (current ? 0 : (Math.random() - 0.5) * 0.04),
      lng: CITIES[city].lng + (current ? 0 : (Math.random() - 0.5) * 0.04),
      images,
      packages,
      available: bool(input.available, current?.available ?? true),
      active: bool(input.active, current?.active ?? true),
      featured: bool(input.featured, current?.featured ?? false),
      createdAt: current?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
  }

  function createService(input) {
    const service = writeService(null, input);
    service.lat = CITIES[service.city].lat;
    service.lng = CITIES[service.city].lng;
    db.services.push(service);
    return serviceCard(service, CITIES[service.city]);
  }

  function updateService(serviceId, input) {
    const index = db.services.findIndex((s) => s.id === serviceId);
    if (index < 0) throw new DomainError(404, 'Jasa tidak ditemukan.');
    const next = writeService(db.services[index], { ...db.services[index], ...input });
    next.lat = db.services[index].lat;
    next.lng = db.services[index].lng;
    db.services[index] = next;
    return serviceCard(next, CITIES[next.city]);
  }

  function deleteService(serviceId) {
    const service = serviceOf(serviceId);
    if (!service) throw new DomainError(404, 'Jasa tidak ditemukan.');
    db.services = db.services.filter((s) => s.id !== serviceId);
    db.portfolios = db.portfolios.filter((p) => p.serviceId !== serviceId);
    db.savedServices = db.savedServices.filter((s) => s.serviceId !== serviceId);
    return { ok: true };
  }

  function publicProvider(provider) {
    const services = db.services.filter((s) => s.providerId === provider.id && s.active);
    const reviewList = db.reviews.filter((r) => r.providerId === provider.id);
    const rating = reviewList.length ? Math.round((reviewList.reduce((s, r) => s + r.rating, 0) / reviewList.length) * 10) / 10 : 0;
    return {
      id: provider.id,
      name: provider.name,
      businessName: provider.businessName,
      image: provider.image,
      description: provider.description,
      phone: provider.phone,
      email: provider.email,
      city: provider.city,
      location: provider.location,
      lat: provider.lat,
      lng: provider.lng,
      categoryId: provider.categoryId,
      categoryName: categoryName(provider.categoryId),
      verified: Boolean(provider.verified),
      active: Boolean(provider.active),
      rating,
      reviewCount: reviewList.length,
      serviceCount: services.length,
    };
  }

  function writeProvider(current, input) {
    const name = clean(input.name ?? current?.name, 80);
    const businessName = clean(input.businessName ?? current?.businessName, 80);
    if (name.length < 3) throw new DomainError(400, 'Nama penanggung jawab minimal 3 karakter.');
    if (businessName.length < 3) throw new DomainError(400, 'Nama usaha minimal 3 karakter.');
    const category = byId(db.categories, input.categoryId || current?.categoryId);
    if (!category) throw new DomainError(400, 'Kategori tidak ditemukan.');
    const description = clean(input.description ?? current?.description, 2000);
    if (description.length < 20) throw new DomainError(400, 'Deskripsi penyedia minimal 20 karakter.');
    const city = cityOf(input.city || current?.city);
    const location = clean(input.location ?? current?.location, 160);
    if (location.length < 3) throw new DomainError(400, 'Lokasi penyedia wajib diisi.');
    return {
      id: current?.id || id('prv'),
      name,
      businessName,
      image: httpsUrl(input.image || current?.image),
      description,
      phone: phoneOf(input.phone || current?.phone),
      email: emailOf(input.email || current?.email),
      city,
      location,
      lat: CITIES[city].lat,
      lng: CITIES[city].lng,
      categoryId: category.id,
      verified: bool(input.verified, current?.verified ?? false),
      active: bool(input.active, current?.active ?? true),
      createdAt: current?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
  }

  function listProviders({ manage = false, q = '' } = {}) {
    let list = db.providers.filter((p) => manage || p.active);
    const query = q.toLowerCase();
    if (query) {
      list = list.filter((p) => [p.businessName, p.name, p.city, categoryName(p.categoryId)].some((f) => f.toLowerCase().includes(query)));
    }
    return list.map(publicProvider);
  }

  function getProvider(providerId, { manage = false } = {}) {
    const provider = providerOf(providerId);
    if (!provider || (!manage && !provider.active)) throw new DomainError(404, 'Penyedia jasa tidak ditemukan.');
    return {
      provider: publicProvider(provider),
      services: db.services.filter((s) => s.providerId === provider.id && (manage || visibleService(s))).map((s) => serviceCard(s, CITIES[s.city])),
      portfolio: db.portfolios.filter((p) => p.providerId === provider.id),
      reviews: db.reviews.filter((r) => r.providerId === provider.id).map(publicReview),
    };
  }

  function createProvider(input) {
    const provider = writeProvider(null, input);
    db.providers.push(provider);
    return publicProvider(provider);
  }

  function updateProvider(providerId, input) {
    const index = db.providers.findIndex((p) => p.id === providerId);
    if (index < 0) throw new DomainError(404, 'Penyedia jasa tidak ditemukan.');
    db.providers[index] = writeProvider(db.providers[index], input);
    return publicProvider(db.providers[index]);
  }

  function deleteProvider(providerId) {
    const provider = providerOf(providerId);
    if (!provider) throw new DomainError(404, 'Penyedia jasa tidak ditemukan.');
    const open = db.bookings.some((b) => b.providerId === providerId && (b.status === 'pending' || b.status === 'confirmed'));
    if (open) throw new DomainError(409, 'Masih ada pesanan aktif. Nonaktifkan penyedia, atau selesaikan pesanannya lebih dulu.');
    const serviceIds = db.services.filter((s) => s.providerId === providerId).map((s) => s.id);
    db.providers = db.providers.filter((p) => p.id !== providerId);
    db.services = db.services.filter((s) => s.providerId !== providerId);
    db.portfolios = db.portfolios.filter((p) => p.providerId !== providerId);
    db.savedServices = db.savedServices.filter((s) => !serviceIds.includes(s.serviceId));
    return { ok: true };
  }

  function addPortfolio(providerId, input) {
    const provider = providerOf(providerId);
    if (!provider) throw new DomainError(404, 'Penyedia jasa tidak ditemukan.');
    const title = clean(input.title, 80);
    if (title.length < 3) throw new DomainError(400, 'Judul portofolio minimal 3 karakter.');
    const serviceId = input.serviceId || '';
    if (serviceId && !db.services.some((s) => s.id === serviceId && s.providerId === providerId)) {
      throw new DomainError(400, 'Jasa portofolio tidak sesuai dengan penyedia.');
    }
    const item = {
      id: id('prf'),
      providerId,
      serviceId: serviceId || null,
      title,
      description: clean(input.description, 400),
      category: clean(input.category, 40) || categoryName(provider.categoryId),
      date: /^\d{4}-\d{2}-\d{2}$/.test(input.date || '') ? input.date : todayJakarta(),
      image: httpsUrl(input.image),
    };
    db.portfolios.push(item);
    return item;
  }

  function deletePortfolio(itemId) {
    if (!db.portfolios.some((p) => p.id === itemId)) throw new DomainError(404, 'Portofolio tidak ditemukan.');
    db.portfolios = db.portfolios.filter((p) => p.id !== itemId);
    return { ok: true };
  }

  function listCategories() {
    return db.categories.map((category) => ({
      ...category,
      serviceCount: db.services.filter((s) => s.categoryId === category.id && visibleService(s)).length,
    }));
  }

  function createCategory(input) {
    const name = clean(input.name, 40);
    if (name.length < 3) throw new DomainError(400, 'Nama kategori minimal 3 karakter.');
    if (db.categories.some((c) => c.name.toLowerCase() === name.toLowerCase())) throw new DomainError(409, 'Kategori ini sudah ada.');
    const category = { id: id('cat'), name, slug: name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') };
    db.categories.push(category);
    return category;
  }

  function updateCategory(categoryId, input) {
    const category = byId(db.categories, categoryId);
    if (!category) throw new DomainError(404, 'Kategori tidak ditemukan.');
    const name = clean(input.name, 40);
    if (name.length < 3) throw new DomainError(400, 'Nama kategori minimal 3 karakter.');
    category.name = name;
    category.slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    return category;
  }

  function deleteCategory(categoryId) {
    if (!byId(db.categories, categoryId)) throw new DomainError(404, 'Kategori tidak ditemukan.');
    if (db.services.some((s) => s.categoryId === categoryId) || db.providers.some((p) => p.categoryId === categoryId)) {
      throw new DomainError(409, 'Kategori masih dipakai jasa atau penyedia.');
    }
    db.categories = db.categories.filter((c) => c.id !== categoryId);
    return { ok: true };
  }

  function bookingView(booking, viewer) {
    const service = serviceOf(booking.serviceId);
    const provider = providerOf(booking.providerId);
    const customer = db.users.find((u) => u.id === booking.customerId);
    const reviewed = db.reviews.some((r) => r.bookingId === booking.id);
    return {
      id: booking.id,
      customerId: booking.customerId,
      customerName: customer?.name || booking.customerName,
      customerEmail: viewer?.role === 'admin' ? customer?.email : undefined,
      serviceId: booking.serviceId,
      serviceName: service?.name || booking.serviceName,
      serviceImage: service?.images?.[0] || '',
      providerId: booking.providerId,
      providerName: provider?.businessName || booking.providerName,
      packageId: booking.packageId,
      packageName: booking.packageName,
      date: booking.date,
      time: booking.time,
      location: booking.location,
      notes: booking.notes,
      price: booking.price,
      platformFee: booking.platformFee,
      total: booking.total,
      status: booking.status,
      reviewed,
      createdAt: booking.createdAt,
      updatedAt: booking.updatedAt,
    };
  }

  function listBookings(user) {
    const list = user.role === 'admin' ? db.bookings : db.bookings.filter((b) => b.customerId === user.id);
    return list.map((b) => bookingView(b, user)).sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
  }

  function getBooking(user, bookingId) {
    const booking = byId(db.bookings, bookingId);
    if (!booking || (user.role !== 'admin' && booking.customerId !== user.id)) throw new DomainError(404, 'Pesanan tidak ditemukan.');
    return bookingView(booking, user);
  }

  function createBooking(user, input) {
    const service = serviceOf(input.serviceId);
    if (!service || !visibleService(service) || !service.available) throw new DomainError(404, 'Jasa tidak tersedia untuk dipesan.');
    const pkg = (service.packages || []).find((p) => p.id === input.packageId);
    if (!pkg) throw new DomainError(400, 'Pilih paket layanan.');
    const date = clean(input.date, 10);
    const time = clean(input.time, 5);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || date < todayJakarta()) throw new DomainError(400, 'Pilih tanggal hari ini atau setelahnya.');
    if (!TIME_SLOTS.includes(time)) throw new DomainError(400, 'Pilih jam yang tersedia.');
    const clash = db.bookings.some((b) => b.serviceId === service.id && b.date === date && b.time === time && (b.status === 'pending' || b.status === 'confirmed'));
    if (clash) throw new DomainError(409, 'Jadwal ini sudah dipesan. Silakan pilih jam lain.');
    const location = clean(input.location, 200);
    if (location.length < 5) throw new DomainError(400, 'Isi alamat layanan dengan lebih lengkap.');
    const provider = providerOf(service.providerId);
    const costs = quote(pkg.price);
    const number = db.bookings.reduce((max, b) => Math.max(max, Number(String(b.id).replace(/\D/g, '')) || 1000), 1000) + 1;
    const booking = {
      id: `ADL-${number}`,
      customerId: user.id,
      customerName: user.name,
      serviceId: service.id,
      serviceName: service.name,
      providerId: provider.id,
      providerName: provider.businessName,
      packageId: pkg.id,
      packageName: pkg.name,
      date,
      time,
      location,
      notes: clean(input.notes, 500),
      ...costs,
      status: 'pending',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    db.bookings.push(booking);
    return bookingView(booking, user);
  }

  function updateBooking(user, bookingId, input) {
    const booking = byId(db.bookings, bookingId);
    if (!booking || (user.role !== 'admin' && booking.customerId !== user.id)) throw new DomainError(404, 'Pesanan tidak ditemukan.');
    const next = clean(input.status, 20);
    if (!BOOKING_STATUSES.includes(next)) throw new DomainError(400, 'Status pesanan tidak valid.');
    if (user.role !== 'admin') {
      if (next !== 'cancelled') throw new DomainError(403, 'Anda hanya dapat membatalkan pesanan.');
      if (!['pending', 'confirmed'].includes(booking.status)) throw new DomainError(409, 'Pesanan ini tidak bisa dibatalkan.');
    }
    booking.status = next;
    booking.updatedAt = new Date().toISOString();
    return bookingView(booking, user);
  }

  function deleteBooking(user, bookingId) {
    if (user.role !== 'admin') throw new DomainError(403, 'Hanya admin yang dapat menghapus pesanan.');
    if (!byId(db.bookings, bookingId)) throw new DomainError(404, 'Pesanan tidak ditemukan.');
    db.bookings = db.bookings.filter((b) => b.id !== bookingId);
    db.reviews = db.reviews.filter((r) => r.bookingId !== bookingId);
    return { ok: true };
  }

  function listReviews({ serviceId, providerId, mine, user } = {}) {
    let list = db.reviews;
    if (serviceId) list = list.filter((r) => r.serviceId === serviceId);
    if (providerId) list = list.filter((r) => r.providerId === providerId);
    if (mine && user) list = list.filter((r) => r.customerId === user.id);
    return list.map(publicReview).sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
  }

  function createReview(user, input) {
    const booking = byId(db.bookings, input.bookingId);
    if (!booking || booking.customerId !== user.id) throw new DomainError(404, 'Pesanan tidak ditemukan.');
    if (booking.status !== 'completed') throw new DomainError(409, 'Ulasan hanya bisa diberikan setelah pesanan selesai.');
    if (db.reviews.some((r) => r.bookingId === booking.id)) throw new DomainError(409, 'Pesanan ini sudah diulas.');
    const rating = Number(input.rating);
    if (!Number.isInteger(rating) || rating < 1 || rating > 5) throw new DomainError(400, 'Nilai ulasan harus 1 sampai 5.');
    const text = clean(input.text, 1000);
    if (text.length < 10) throw new DomainError(400, 'Ulasan minimal 10 karakter.');
    const review = {
      id: id('rev'),
      bookingId: booking.id,
      serviceId: booking.serviceId,
      serviceName: booking.serviceName,
      providerId: booking.providerId,
      customerId: user.id,
      customerName: user.name,
      rating,
      text,
      createdAt: new Date().toISOString(),
    };
    db.reviews.push(review);
    return publicReview(review);
  }

  function listSaved(user) {
    return db.savedServices
      .filter((s) => s.customerId === user.id)
      .map((s) => {
        const service = serviceOf(s.serviceId);
        return service ? { ...serviceCard(service, CITIES[service.city]), savedAt: s.createdAt } : null;
      })
      .filter(Boolean);
  }

  function saveService(user, serviceId) {
    const service = serviceOf(serviceId);
    if (!service || !visibleService(service)) throw new DomainError(404, 'Jasa tidak ditemukan.');
    if (!db.savedServices.some((s) => s.customerId === user.id && s.serviceId === serviceId)) {
      db.savedServices.push({ id: id('sav'), customerId: user.id, serviceId, createdAt: new Date().toISOString() });
    }
    return { ok: true };
  }

  function unsaveService(user, serviceId) {
    db.savedServices = db.savedServices.filter((s) => !(s.customerId === user.id && s.serviceId === serviceId));
    return { ok: true };
  }

  function stats() {
    const completed = db.bookings.filter((b) => b.status === 'completed');
    const byStatus = Object.fromEntries(BOOKING_STATUSES.map((status) => [status, db.bookings.filter((b) => b.status === status).length]));
    return {
      customers: db.users.filter((u) => u.role === 'customer').length,
      providers: db.providers.length,
      services: db.services.length,
      bookings: db.bookings.length,
      completed: completed.length,
      cancelled: byStatus.cancelled || 0,
      revenue: completed.reduce((sum, b) => sum + b.total, 0),
      byStatus,
    };
  }

  function registerUser({ name, email, phone, passwordHash }) {
    const fullName = clean(name, 80);
    if (fullName.length < 3) throw new DomainError(400, 'Nama lengkap minimal 3 karakter.');
    const normalized = emailOf(email);
    if (db.users.some((u) => u.email === normalized)) throw new DomainError(409, 'Email ini sudah terdaftar. Silakan masuk.');
    const user = {
      id: id('usr'),
      name: fullName,
      email: normalized,
      phone: phoneOf(phone),
      passwordHash,
      role: 'customer',
      createdAt: new Date().toISOString(),
    };
    db.users.push(user);
    return publicUser(user);
  }

  function updateProfile(user, input) {
    const current = db.users.find((u) => u.id === user.id);
    if (!current) throw new DomainError(404, 'Pengguna tidak ditemukan.');
    if (input.name != null) {
      const name = clean(input.name, 80);
      if (name.length < 3) throw new DomainError(400, 'Nama lengkap minimal 3 karakter.');
      current.name = name;
    }
    if (input.phone != null) current.phone = phoneOf(input.phone);
    current.updatedAt = new Date().toISOString();
    return publicUser(current);
  }

  function getSettings() {
    return { platformFeePercent: db.settings.platformFeePercent, supportEmail: db.settings.supportEmail };
  }

  function updateSettings(input) {
    const percent = Number(input.platformFeePercent);
    if (!Number.isInteger(percent) || percent < 0 || percent > 30) throw new DomainError(400, 'Biaya platform harus 0 sampai 30 persen.');
    db.settings.platformFeePercent = percent;
    if (input.supportEmail) db.settings.supportEmail = emailOf(input.supportEmail);
    return getSettings();
  }

  return {
    publicUser,
    listServices,
    getService,
    createService,
    updateService,
    deleteService,
    listProviders,
    getProvider,
    createProvider,
    updateProvider,
    deleteProvider,
    addPortfolio,
    deletePortfolio,
    listCategories,
    createCategory,
    updateCategory,
    deleteCategory,
    listBookings,
    getBooking,
    createBooking,
    updateBooking,
    deleteBooking,
    listReviews,
    createReview,
    listSaved,
    saveService,
    unsaveService,
    stats,
    listCustomers: () => db.users.filter((u) => u.role === 'customer').map(publicUser),
    registerUser,
    updateProfile,
    getSettings,
    updateSettings,
    quote,
    findUserByEmail: (email) => db.users.find((u) => u.email === String(email || '').toLowerCase()) || null,
    findUserById: (userId) => db.users.find((u) => u.id === userId) || null,
  };
}
