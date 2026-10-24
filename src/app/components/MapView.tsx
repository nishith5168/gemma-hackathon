'use client';

import React, { useEffect, useRef } from 'react';
import { Pharmacy } from '@/lib/types';

interface MapViewProps {
  pharmacies: {
    pharmacy: Pharmacy;
    band?: 'in' | 'low' | 'out';
    distanceKm?: number | null;
  }[];
  center?: [number, number];
  zoom?: number;
}

export function MapView({
  pharmacies,
  center = [6.9271, 79.8612],
  zoom = 11,
}: MapViewProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);

  useEffect(() => {
    if (typeof window === 'undefined' || !mapContainerRef.current) return;

    let isMounted = true;

    // Dynamically load leaflet
    import('leaflet').then((L) => {
      if (!isMounted || !mapContainerRef.current) return;

      if (!mapInstanceRef.current) {
        const map = L.map(mapContainerRef.current).setView(center, zoom);

        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          attribution:
            '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
          maxZoom: 18,
        }).addTo(map);

        mapInstanceRef.current = map;
      }

      const map = mapInstanceRef.current;

      // Clear existing markers
      map.eachLayer((layer: any) => {
        if (layer instanceof L.Marker) {
          map.removeLayer(layer);
        }
      });

      // Custom icon colors per band
      pharmacies.forEach(({ pharmacy, band, distanceKm }) => {
        if (!pharmacy.lat || !pharmacy.lng) return;

        const pinColor =
          band === 'in' ? '#10b981' : band === 'low' ? '#f59e0b' : '#ef4444';

        const customIcon = L.divIcon({
          className: 'custom-map-pin',
          html: `<div style="background-color: ${pinColor}; width: 22px; height: 22px; border-radius: 50%; border: 2.5px solid white; box-shadow: 0 2px 6px rgba(0,0,0,0.3); display: flex; align-items: center; justify-content: center; color: white; font-size: 10px; font-weight: bold;"></div>`,
          iconSize: [22, 22],
          iconAnchor: [11, 11],
        });

        const popupContent = `
          <div style="font-family: sans-serif; font-size: 12px; line-height: 1.4;">
            <strong style="color: #0f172a; font-size: 13px;">${pharmacy.name}</strong><br/>
            <span style="color: #64748b;">${pharmacy.address}</span><br/>
            <span style="display: inline-block; margin-top: 4px; padding: 2px 6px; border-radius: 4px; font-weight: bold; font-size: 10px; background-color: ${
              band === 'in' ? '#d1fae5' : band === 'low' ? '#fef3c7' : '#fee2e2'
            }; color: ${
          band === 'in' ? '#065f46' : band === 'low' ? '#92400e' : '#991b1b'
        };">
              ${band === 'in' ? 'IN STOCK' : band === 'low' ? 'LOW STOCK' : 'OUT OF STOCK'}
            </span>
            ${distanceKm !== undefined && distanceKm !== null ? `<br/><span style="color: #005691; font-weight: 600;">${distanceKm} km away</span>` : ''}
          </div>
        `;

        L.marker([pharmacy.lat, pharmacy.lng], { icon: customIcon })
          .addTo(map)
          .bindPopup(popupContent);
      });

      if (pharmacies.length > 0 && pharmacies[0].pharmacy.lat) {
        map.setView([pharmacies[0].pharmacy.lat, pharmacies[0].pharmacy.lng], zoom);
      }
    });

    return () => {
      isMounted = false;
    };
  }, [pharmacies, center, zoom]);

  return (
    <div className="w-full h-72 sm:h-80 rounded-lg overflow-hidden border border-slate-300 shadow-xs relative">
      <div ref={mapContainerRef} className="w-full h-full" />
    </div>
  );
}
