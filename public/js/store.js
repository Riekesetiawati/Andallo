export const state = {
  token: localStorage.getItem('andallo.token') || '',
  user: null,
  city: localStorage.getItem('andallo.city') || '',
  coords: JSON.parse(localStorage.getItem('andallo.coords') || 'null'),
  compare: JSON.parse(localStorage.getItem('andallo.compare') || '[]'),
  categories: [],
  settings: { platformFeePercent: 5, supportEmail: 'halo@andallo.id' },
};

let generation = 0;

export function bumpGeneration() {
  generation += 1;
  return generation;
}

export function isCurrent(generationId) {
  return generationId === generation;
}

export function setSession(token, user) {
  state.token = token || '';
  state.user = user || null;
  if (state.token) localStorage.setItem('andallo.token', state.token);
  else localStorage.removeItem('andallo.token');
}

export function setCity(city) {
  state.city = city || '';
  if (state.city) localStorage.setItem('andallo.city', state.city);
  else localStorage.removeItem('andallo.city');
}

export function setCoords(coords) {
  state.coords = coords;
  if (coords) localStorage.setItem('andallo.coords', JSON.stringify(coords));
  else localStorage.removeItem('andallo.coords');
}

export function toggleCompare(serviceId) {
  const exists = state.compare.includes(serviceId);
  if (exists) state.compare = state.compare.filter((id) => id !== serviceId);
  else if (state.compare.length >= 3) return { ok: false, reason: 'Maksimal 3 jasa untuk dibandingkan.' };
  else state.compare = [...state.compare, serviceId];
  localStorage.setItem('andallo.compare', JSON.stringify(state.compare));
  return { ok: true, saved: !exists };
}
