'use client';

import React, { useEffect, useRef } from 'react';
import { Pharmacy } from '@/lib/types';

export interface MapViewProps {
  pharmacies: {
    pharmacy: Pharmacy;
    band?: 'in' | 'low' | 'out';
    distanceKm?: number | null;
  }[];
  userLocation?: { lat: number; lng: number } | null;
  center?: [number, number];
  zoom?: number;
}

export function MapView({
  pharmacies,
  userLocation,
  center = [6.9271, 79.8612],
  zoom = 11,
}: MapViewProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const markersLayerRef = useRef<any>(null);

  useEffect(() => {
    if (typeof window === 'undefined' || !mapContainerRef.current) return;

    let isMounted = true;

    // Dynamically load leaflet
    import('leaflet').then((L) => {
      if (!isMounted || !mapContainerRef.current) return;

      // Initialize map instance if not already initialized
      if (!mapInstanceRef.current) {
        const map = L.map(mapContainerRef.current).setView(center, zoom);

        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          attribution:
            '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
          maxZoom: 18,
        }).addTo(map);

        const markersLayer = L.layerGroup().addTo(map);
        markersLayerRef.current = markersLayer;
        mapInstanceRef.current = map;
      }

      const map = mapInstanceRef.current;
      const markersLayer = markersLayerRef.current;

      if (!markersLayer) return;

      // Clear previous markers
      markersLayer.clearLayers();

      const pointsToFit: [number, number][] = [];

      // Render user location marker if available
      if (
        userLocation &&
        typeof userLocation.lat === 'number' &&
        typeof userLocation.lng === 'number'
      ) {
        const userIcon = L.divIcon({
          className: 'user-gps-marker',
          html: `
            <div style="position: relative; width: 36px; height: 36px; display: flex; align-items: center; justify-content: center;">
              <div style="position: absolute; width: 36px; height: 36px; border-radius: 50%; background: rgba(2, 132, 199, 0.25); border: 1.5px solid rgba(2, 132, 199, 0.6); animation: gpsRingPulse 2s ease-out infinite;"></div>
              <div style="position: relative; width: 14px; height: 14px; border-radius: 50%; background: #0284c7; border: 2.5px solid #ffffff; box-shadow: 0 2px 6px rgba(0,0,0,0.35);"></div>
            </div>
          `,
          iconSize: [36, 36],
          iconAnchor: [18, 18],
        });

        const userMarker = L.marker([userLocation.lat, userLocation.lng], {
          icon: userIcon,
          zIndexOffset: 2000,
        });

        userMarker.bindPopup(`
          <div style="font-family: sans-serif; font-size: 12px; line-height: 1.4;">
            <div style="display: flex; align-items: center; gap: 4px; font-weight: bold; color: #0284c7; font-size: 13px;">
              <span>📍 Your Location</span>
            </div>
            <span style="color: #64748b; font-size: 11px;">Current GPS coordinates active</span><br/>
            <span style="display: inline-block; margin-top: 4px; font-size: 10px; color: #0369a1; background: #e0f2fe; padding: 2px 6px; border-radius: 4px; font-weight: 600;">
              Showing nearest pharmacies
            </span>
          </div>
        `);

        markersLayer.addLayer(userMarker);
        pointsToFit.push([userLocation.lat, userLocation.lng]);
      }

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

        const marker = L.marker([pharmacy.lat, pharmacy.lng], { icon: customIcon });
        marker.bindPopup(popupContent);
        markersLayer.addLayer(marker);
      });

      // Viewport auto-framing
      if (
        userLocation &&
        typeof userLocation.lat === 'number' &&
        typeof userLocation.lng === 'number'
      ) {
        // Collect nearby pharmacies to frame with user
        const validNearby = pharmacies
          .filter((p) => p.pharmacy.lat && p.pharmacy.lng)
          .slice(0, 6);
        validNearby.forEach((p) => pointsToFit.push([p.pharmacy.lat, p.pharmacy.lng]));

        if (pointsToFit.length > 1) {
          const bounds = L.latLngBounds(pointsToFit);
          map.fitBounds(bounds, { padding: [45, 45], maxZoom: 14 });
        } else {
          map.setView([userLocation.lat, userLocation.lng], 14);
        }
      } else if (
        pharmacies.length > 0 &&
        pharmacies[0].pharmacy.lat &&
        pharmacies[0].pharmacy.lng
      ) {
        const pharmPoints: [number, number][] = pharmacies
          .filter((p) => p.pharmacy.lat && p.pharmacy.lng)
          .slice(0, 10)
          .map((p) => [p.pharmacy.lat, p.pharmacy.lng]);

        if (pharmPoints.length > 1) {
          const bounds = L.latLngBounds(pharmPoints);
          map.fitBounds(bounds, { padding: [40, 40], maxZoom: 13 });
        } else {
          map.setView([pharmacies[0].pharmacy.lat, pharmacies[0].pharmacy.lng], zoom);
        }
      }
    });

    return () => {
      isMounted = false;
    };
  }, [pharmacies, userLocation, center, zoom]);

  // Clean up Leaflet on unmount
  useEffect(() => {
    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
        markersLayerRef.current = null;
      }
    };
  }, []);

  return (
    <div className="w-full rounded-lg overflow-hidden border border-slate-300 shadow-xs relative bg-slate-100">
      <div ref={mapContainerRef} className="w-full h-72 sm:h-80" />

      {/* Discrete Map Legend */}
      <div className="absolute bottom-2 left-2 z-[400] bg-white/95 backdrop-blur-xs px-2.5 py-1.5 rounded-md border border-slate-200 shadow-2xs text-[11px] flex flex-wrap items-center gap-3">
        {userLocation && (
          <div className="flex items-center gap-1.5 font-semibold text-[#0284c7]">
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-sky-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-[#0284c7]"></span>
            </span>
            <span>You</span>
          </div>
        )}
        <div className="flex items-center gap-1 text-slate-700">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block"></span>
          <span>In stock</span>
        </div>
        <div className="flex items-center gap-1 text-slate-700">
          <span className="w-2.5 h-2.5 rounded-full bg-amber-500 inline-block"></span>
          <span>Low</span>
        </div>
        <div className="flex items-center gap-1 text-slate-700">
          <span className="w-2.5 h-2.5 rounded-full bg-red-500 inline-block"></span>
          <span>Out</span>
        </div>
      </div>
    </div>
  );
}
