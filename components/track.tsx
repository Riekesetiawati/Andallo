'use client';

import { useEffect, useState } from 'react';
import { LeafletMap } from './map';

export function TrackMap({ bookingId, role, provider, initial }: { bookingId: string; share?: boolean; role: 'customer' | 'provider'; provider: { lat: number; lng: number }; customer: null; initial: { lat: number; lng: number; recorded_at: string } | null }) {
  const [point, setPoint] = useState(initial);
  const [error, setError] = useState('');
  useEffect(() => {
    if (role !== 'provider') {
      const source = new EventSource('/api/realtime');
      source.onmessage = (event) => {
        const data = JSON.parse(event.data);
        const hit = (data.locations || []).find((item: { booking_id: string }) => item.booking_id === bookingId);
        if (hit) setPoint(hit);
      };
      return () => source.close();
    }
    if (!navigator.geolocation) {
      queueMicrotask(() => setError('Peramban ini tidak mendukung lokasi.'));
      return;
    }
    const watch = navigator.geolocation.watchPosition(async (position) => {
      const body = { bookingId, lat: position.coords.latitude, lng: position.coords.longitude };
      const response = await fetch('/api/location', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const data = await response.json();
      if (!response.ok) setError(data.error || 'Lokasi gagal dikirim.');
      else setPoint({ ...body, recorded_at: new Date().toISOString() });
    }, () => setError('Izin lokasi ditolak. Pelacakan tidak dimulai.'), { enableHighAccuracy: true });
    return () => navigator.geolocation.clearWatch(watch);
  }, [bookingId, role]);
  const markers = [
    { lat: provider.lat, lng: provider.lng, label: 'Titik mitra', color: '#1f7a4d' },
    ...(point ? [{ lat: point.lat, lng: point.lng, label: 'Posisi terkini', color: '#e36b1e' }] : []),
  ];
  return (
    <div className="grid gap-2">
      <LeafletMap center={point || provider} markers={markers} />
      <p className="text-sm text-muted">{point ? `Pembaruan terakhir ${new Date(point.recorded_at).toLocaleTimeString('id-ID')}` : 'Menunggu posisi mitra.'}</p>
      {error ? <p className="text-sm text-red-700">{error}</p> : null}
    </div>
  );
}
