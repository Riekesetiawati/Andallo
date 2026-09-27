'use client';

import { useEffect, useRef } from 'react';
import 'leaflet/dist/leaflet.css';

type Marker = { lat: number; lng: number; label: string; color?: string };

export function LeafletMap({ center, markers = [], onPick }: { center: { lat: number; lng: number }; markers?: Marker[]; onPick?: (lat: number, lng: number) => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const pickRef = useRef(onPick);
  const markerKey = JSON.stringify(markers);
  useEffect(() => {
    pickRef.current = onPick;
  }, [onPick]);
  useEffect(() => {
    let map: import('leaflet').Map | null = null;
    let cancelled = false;
    const drawn = JSON.parse(markerKey) as Marker[];
    (async () => {
      const L = await import('leaflet');
      if (cancelled || !ref.current) return;
      map = L.map(ref.current).setView([center.lat, center.lng], 13);
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '&copy; OpenStreetMap' }).addTo(map);
      for (const marker of drawn) {
        L.circleMarker([marker.lat, marker.lng], { radius: 9, color: marker.color || '#0e3b2e', fillOpacity: 0.9 }).addTo(map).bindPopup(marker.label);
      }
      if (drawn.length > 1) {
        const line = L.polyline(drawn.map((marker) => [marker.lat, marker.lng] as [number, number]), { color: '#e36b1e' }).addTo(map);
        map.fitBounds(line.getBounds(), { padding: [24, 24] });
      }
      map.on('click', (event) => pickRef.current?.(event.latlng.lat, event.latlng.lng));
    })();
    return () => {
      cancelled = true;
      map?.remove();
    };
  }, [center.lat, center.lng, markerKey]);
  return <div ref={ref} className="h-72 overflow-hidden rounded-2xl border border-line" />;
}
