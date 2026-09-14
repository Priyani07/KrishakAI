import { useEffect, useRef, useState } from "react";
import L, { type Map as LeafletMap } from "leaflet";
import "leaflet/dist/leaflet.css";
import markerIcon from "leaflet/dist/images/marker-icon.png";
import markerIcon2x from "leaflet/dist/images/marker-icon-2x.png";
import markerShadow from "leaflet/dist/images/marker-shadow.png";
import { cn } from "@/lib/utils";

export const NEUTRAL_INDIA_VIEWPORT = Object.freeze({ lat: 20.5937, lng: 78.9629 });
export const loadMapScript = (): Promise<void> => Promise.resolve();

let markerIconsConfigured = false;
function configureMarkerIcons() {
  if (markerIconsConfigured) return;
  delete (L.Icon.Default.prototype as unknown as { _getIconUrl?: unknown })._getIconUrl;
  L.Icon.Default.mergeOptions({ iconRetinaUrl: markerIcon2x, iconUrl: markerIcon, shadowUrl: markerShadow });
  markerIconsConfigured = true;
}

interface MapViewProps {
  className?: string;
  initialCenter?: { lat: number; lng: number };
  initialZoom?: number;
  onMapReady?: (map: LeafletMap, leaflet: typeof L) => void;
  loadingText?: string;
  errorText?: string;
}

export function MapView({
  className,
  initialCenter = NEUTRAL_INDIA_VIEWPORT,
  initialZoom = 5,
  onMapReady,
  loadingText = "Loading map…",
  errorText = "Map could not be loaded.",
}: MapViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const readyCallbackRef = useRef(onMapReady);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");

  useEffect(() => { readyCallbackRef.current = onMapReady; }, [onMapReady]);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    try {
      configureMarkerIcons();
      const map = L.map(containerRef.current, {
        center: [initialCenter.lat, initialCenter.lng],
        zoom: initialZoom,
        zoomControl: true,
        scrollWheelZoom: true,
      });
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        maxZoom: 19,
      }).addTo(map);
      mapRef.current = map;
      setStatus("ready");
      readyCallbackRef.current?.(map, L);
      window.setTimeout(() => map.invalidateSize(), 0);
    } catch {
      setStatus("error");
    }
    return () => {
      try { mapRef.current?.remove(); } catch { /* Map was already removed. */ }
      mapRef.current = null;
    };
    // Center and zoom are opening viewport values, intentionally read once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className={cn("map-view relative w-full h-[500px]", className)} aria-busy={status === "loading"}>
      <div ref={containerRef} className="h-full w-full" />
      {status === "loading" && <div className="map-sdk-state" role="status" aria-live="polite">{loadingText}</div>}
      {status === "error" && <div className="map-sdk-state map-sdk-state--error" role="alert">{errorText}</div>}
    </div>
  );
}
