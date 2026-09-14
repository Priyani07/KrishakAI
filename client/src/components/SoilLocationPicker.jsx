import React, { useEffect, useRef, useState } from "react";
import { MapView, NEUTRAL_INDIA_VIEWPORT } from "./Map";
import { normalizeCoordinates } from "../soilTestingExperience.js";

export function SoilLocationPicker({ initialCoordinates, onConfirm, onClose, t }) {
  const markerRef = useRef(null);
  const mapRef = useRef(null);
  const leafletRef = useRef(null);
  const [coordinates, setCoordinates] = useState(initialCoordinates || null);

  const setMarker = (next) => {
    const safe = normalizeCoordinates(next?.lat, next?.lng);
    if (!safe) return;
    setCoordinates(safe);
    if (markerRef.current) {
      markerRef.current.setLatLng([safe.lat, safe.lng]);
    } else if (mapRef.current && leafletRef.current) {
      const marker = leafletRef.current.marker([safe.lat, safe.lng], {
        draggable: true,
        title: t("You are here / selected marker"),
        alt: t("Drag to select a different field location"),
      }).addTo(mapRef.current);
      marker.on("dragend", () => {
        const position = marker.getLatLng();
        setMarker({ lat: position.lat, lng: position.lng });
      });
      markerRef.current = marker;
    }
    mapRef.current?.panTo([safe.lat, safe.lng]);
  };

  const handleMapReady = (map, leaflet) => {
    mapRef.current = map;
    leafletRef.current = leaflet;
    if (coordinates) setMarker(coordinates);
    map.on("click", (event) => setMarker({ lat: event.latlng.lat, lng: event.latlng.lng }));
  };

  useEffect(() => () => {
    try { mapRef.current?.off("click"); } catch { /* Already removed. */ }
    try { markerRef.current?.remove(); } catch { /* Already removed. */ }
    markerRef.current = null;
    mapRef.current = null;
    leafletRef.current = null;
  }, []);

  return (
    <div className="soil-map-dialog" role="dialog" aria-modal="true" aria-labelledby="soil-map-title">
      <div className="soil-map-dialog__head"><div><p className="eyebrow">{t("SOIL TESTING / MAP")}</p><h3 id="soil-map-title">{t("Select a field location")}</h3><p>{t("Tap the map or drag the marker, then confirm the exact field coordinates.")}</p></div><button type="button" className="icon-button" onClick={onClose} aria-label={t("Close map")}>×</button></div>
      <MapView className="soil-map" initialCenter={coordinates || NEUTRAL_INDIA_VIEWPORT} initialZoom={coordinates ? 11 : 5} onMapReady={handleMapReady} loadingText={t("Loading map…")} errorText={t("Map is temporarily unavailable. Use GPS or search instead.")}/>
      <p className="soil-map-coordinates">{coordinates ? <>{t("Selected coordinates")}: {coordinates.lat.toFixed(4)}, {coordinates.lng.toFixed(4)}</> : t("Tap the map to select field coordinates. The opening viewport is not your saved location.")}</p>
      <p className="soil-privacy-note">{t("Precise coordinates are used for this request and are not treated as a default location.")}</p>
      <div className="soil-map-dialog__actions"><button type="button" className="button button--quiet" onClick={onClose}>{t("Close map")}</button><button type="button" className="button button--leaf" disabled={!coordinates} onClick={() => onConfirm(coordinates)}>{t("Confirm map location")}</button></div>
    </div>
  );
}
