"use client";

import { useEffect, useRef, useState } from "react";

import type { NearbyPerson } from "@/lib/companynow/types";

type Coordinates = { latitude: number; longitude: number };
type MapNearbyPerson = NearbyPerson & { approximate_latitude: number; approximate_longitude: number };

type LeafletLayerTarget = LeafletMap | LeafletLayerGroup;
type LeafletMap = {
  fitBounds: (bounds: unknown, options?: { padding?: [number, number]; maxZoom?: number }) => LeafletMap;
  invalidateSize: () => LeafletMap;
  remove: () => void;
  setView: (center: [number, number], zoom: number, options?: { animate?: boolean }) => LeafletMap;
};
type LeafletLayerGroup = {
  addTo: (map: LeafletMap) => LeafletLayerGroup;
  clearLayers: () => LeafletLayerGroup;
};
type LeafletMarker = {
  addTo: (target: LeafletLayerTarget) => LeafletMarker;
  bindPopup: (html: string, options?: { closeButton?: boolean; maxWidth?: number }) => LeafletMarker;
  on: (event: string, handler: () => void) => LeafletMarker;
};
type LeafletNamespace = {
  circle: (center: [number, number], options: Record<string, unknown>) => { addTo: (target: LeafletLayerTarget) => unknown };
  control: { zoom: (options: { position: string }) => { addTo: (map: LeafletMap) => unknown } };
  divIcon: (options: Record<string, unknown>) => unknown;
  latLngBounds: (points: [number, number][]) => unknown;
  layerGroup: () => LeafletLayerGroup;
  map: (element: HTMLElement, options: Record<string, unknown>) => LeafletMap;
  marker: (center: [number, number], options: Record<string, unknown>) => LeafletMarker;
  tileLayer: (url: string, options: Record<string, unknown>) => { addTo: (map: LeafletMap) => unknown };
};

const LEAFLET_CSS_ID = "companynow-leaflet-css";
const LEAFLET_SCRIPT_ID = "companynow-leaflet-script";
const LEAFLET_CSS_URL = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
const LEAFLET_SCRIPT_URL = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";
let leafletPromise: Promise<LeafletNamespace> | null = null;

function leafletFromWindow() {
  return (window as typeof window & { L?: LeafletNamespace }).L;
}

function loadLeaflet() {
  const existing = leafletFromWindow();
  if (existing) return Promise.resolve(existing);
  if (leafletPromise) return leafletPromise;

  leafletPromise = new Promise<LeafletNamespace>((resolve, reject) => {
    if (!document.getElementById(LEAFLET_CSS_ID)) {
      const link = document.createElement("link");
      link.id = LEAFLET_CSS_ID;
      link.rel = "stylesheet";
      link.href = LEAFLET_CSS_URL;
      link.integrity = "sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY=";
      link.crossOrigin = "anonymous";
      document.head.appendChild(link);
    }

    const currentScript = document.getElementById(LEAFLET_SCRIPT_ID) as HTMLScriptElement | null;
    const script = currentScript ?? document.createElement("script");
    if (!currentScript) {
      script.id = LEAFLET_SCRIPT_ID;
      script.src = LEAFLET_SCRIPT_URL;
      script.integrity = "sha256-20nQCchB9co0qIjJZRGuk2/Z9VM+kNiyxNV1lvTlZBo=";
      script.crossOrigin = "anonymous";
      document.head.appendChild(script);
    }

    const finish = () => {
      const loaded = leafletFromWindow();
      if (loaded) resolve(loaded);
      else reject(new Error("The nearby map library did not load."));
    };
    script.addEventListener("load", finish, { once: true });
    script.addEventListener("error", () => reject(new Error("Could not load the nearby map.")), { once: true });
    if (leafletFromWindow()) finish();
  });

  return leafletPromise;
}

function escapeHtml(value: string) {
  return value.replace(/[&<>'"]/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "'": "&#039;",
    '"': "&quot;",
  })[character] ?? character);
}

function zoomForRadius(radius: number) {
  if (radius <= 300) return 16;
  if (radius <= 700) return 15;
  if (radius <= 1200) return 14;
  return 13;
}

function appMarkerHtml(person: NearbyPerson, selected: boolean) {
  const initial = escapeHtml(person.display_name.charAt(0).toUpperCase());
  return `
    <div class="companynow-map-pin${selected ? " is-selected" : ""}" aria-label="${escapeHtml(person.display_name)} is open to connect">
      <svg viewBox="0 0 64 64" aria-hidden="true">
        <rect width="64" height="64" rx="18" fill="#07110f"></rect>
        <circle cx="23" cy="27" r="10" fill="#6ee7b7"></circle>
        <circle cx="41" cy="27" r="10" fill="#a7f3d0"></circle>
        <path d="M15 49c4-10 10-15 17-15s13 5 17 15" fill="none" stroke="#ecfdf5" stroke-width="6" stroke-linecap="round"></path>
      </svg>
      <span class="companynow-map-live-dot"></span>
      <span class="companynow-map-initial">${initial}</span>
    </div>`;
}

function selfMarkerHtml() {
  return `
    <div class="companynow-self-pin" aria-label="Your approximate map centre">
      <span></span>
    </div>`;
}

export function NearbyMap({
  active,
  people,
  radius,
  selectedUserId,
  onSelect,
}: {
  active: boolean;
  people: NearbyPerson[];
  radius: number;
  selectedUserId: string | null;
  onSelect: (person: NearbyPerson) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [center, setCenter] = useState<Coordinates | null>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const overlayRef = useRef<LeafletLayerGroup | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    if (!active) {
      const timer = window.setTimeout(() => {
        mapRef.current?.remove();
        mapRef.current = null;
        overlayRef.current = null;
        setCenter(null);
      }, 0);
      return () => window.clearTimeout(timer);
    }
    if (!navigator.geolocation) {
      const timer = window.setTimeout(() => setLoadError("Location is not supported on this device."), 0);
      return () => window.clearTimeout(timer);
    }
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => setCenter({ latitude: coords.latitude, longitude: coords.longitude }),
      () => setLoadError("Allow location access to open the nearby map."),
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 15000 },
    );
  }, [active]);

  useEffect(() => () => {
    mapRef.current?.remove();
    mapRef.current = null;
    overlayRef.current = null;
  }, []);

  useEffect(() => {
    if (!center || !containerRef.current) return;
    let active = true;

    void loadLeaflet()
      .then((leaflet) => {
        if (!active || !containerRef.current) return;
        setLoadError(null);

        if (!mapRef.current) {
          mapRef.current = leaflet.map(containerRef.current, {
            attributionControl: true,
            minZoom: 12,
            maxZoom: 18,
            zoomControl: false,
          });
          leaflet.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
            maxZoom: 19,
          }).addTo(mapRef.current);
          leaflet.control.zoom({ position: "bottomright" }).addTo(mapRef.current);
          overlayRef.current = leaflet.layerGroup().addTo(mapRef.current);
        }

        const map = mapRef.current;
        const overlay = overlayRef.current;
        if (!map || !overlay) return;
        overlay.clearLayers();

        const selfPoint: [number, number] = [center.latitude, center.longitude];
        leaflet.circle(selfPoint, {
          color: "#6ee7b7",
          dashArray: "7 9",
          fillColor: "#6ee7b7",
          fillOpacity: 0.08,
          radius,
          weight: 2,
        }).addTo(overlay);
        leaflet.marker(selfPoint, {
          icon: leaflet.divIcon({
            className: "companynow-self-marker-shell",
            html: selfMarkerHtml(),
            iconAnchor: [14, 14],
            iconSize: [28, 28],
          }),
          interactive: false,
        }).addTo(overlay);

        const bounds: [number, number][] = [selfPoint];
        for (const person of people) {
          const mappedPerson = person as MapNearbyPerson;
          if (!Number.isFinite(mappedPerson.approximate_latitude) || !Number.isFinite(mappedPerson.approximate_longitude)) continue;
          const point: [number, number] = [mappedPerson.approximate_latitude, mappedPerson.approximate_longitude];
          bounds.push(point);
          const selected = person.user_id === selectedUserId;
          leaflet.marker(point, {
            icon: leaflet.divIcon({
              className: "companynow-map-marker-shell",
              html: appMarkerHtml(person, selected),
              iconAnchor: [28, 58],
              iconSize: [56, 62],
              popupAnchor: [0, -54],
            }),
            riseOnHover: true,
            title: `${person.display_name} · ${person.distance_label}`,
          })
            .addTo(overlay)
            .bindPopup(
              `<strong>${escapeHtml(person.display_name)}</strong><br><span>${escapeHtml(person.distance_label)}</span><br><small>${escapeHtml(person.status_text || "Open to conversation")}</small>`,
              { closeButton: false, maxWidth: 220 },
            )
            .on("click", () => onSelect(person));
        }

        if (people.length > 0) {
          map.fitBounds(leaflet.latLngBounds(bounds), { maxZoom: zoomForRadius(radius), padding: [42, 42] });
        } else {
          map.setView(selfPoint, zoomForRadius(radius), { animate: true });
        }
        window.setTimeout(() => map.invalidateSize(), 80);
      })
      .catch((error: unknown) => {
        if (active) setLoadError(error instanceof Error ? error.message : "Could not load the nearby map.");
      });

    return () => { active = false; };
  }, [center, onSelect, people, radius, selectedUserId]);

  if (!active || !center) {
    return <div className="grid min-h-80 place-items-center rounded-[2rem] border border-dashed border-white/15 bg-black/20 px-8 text-center"><div><p className="font-semibold">Your nearby map will appear here</p><p className="mt-2 text-sm text-white/45">Turn on Open to Connect and allow location access.</p></div></div>;
  }

  return <div className="relative overflow-hidden rounded-[2rem] border border-white/10 bg-[#0b1714]">
    <div ref={containerRef} className="h-[22rem] w-full" aria-label="Approximate map of people who are open to connect" />
    <div className="pointer-events-none absolute left-3 top-3 rounded-full border border-white/15 bg-[#07110f]/90 px-3 py-2 text-xs font-semibold text-emerald-100 backdrop-blur">Approximate positions</div>
    {loadError && <div className="absolute inset-x-3 bottom-3 rounded-2xl border border-red-300/20 bg-red-950/90 p-3 text-sm text-red-100">{loadError}</div>}
  </div>;
}
