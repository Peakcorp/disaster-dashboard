"use client";

import { MapContainer, TileLayer, Marker, Tooltip } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import type { DisasterEvent } from "@/types/event";

const US_CENTER: [number, number] = [39.8283, -98.5795];

// Keeps panning/zoom focused on North America — Alaska/Hawaii/PR fit within
// this box, so it stays "US-focused" instead of drifting into open ocean or
// other continents when a user scrolls the map.
const US_BOUNDS: [[number, number], [number, number]] = [
  [5, -175],
  [72, -50],
];

const STATUS_HEX: Record<DisasterEvent["status"], string> = {
  critical: "#ff3b3b",
  developing: "#ffb300",
  monitoring: "#eab308",
  resolved: "#6b7280",
};

function markerIcon(status: DisasterEvent["status"]) {
  const color = STATUS_HEX[status];
  const pulse = status === "critical";
  return L.divIcon({
    className: "",
    html: `
      <div style="position:relative;width:14px;height:14px;">
        ${pulse ? `<div class="pulse-marker" style="position:absolute;inset:0;color:${color};"></div>` : ""}
        <div style="position:absolute;inset:0;border-radius:9999px;background:${color};box-shadow:0 0 6px ${color};"></div>
      </div>
    `,
    iconSize: [14, 14],
    iconAnchor: [7, 7],
  });
}

export function DisasterMap({
  events,
  onSelect,
}: {
  events: DisasterEvent[];
  onSelect: (event: DisasterEvent) => void;
}) {
  const plottable = events.filter((e) => e.lat != null && e.lng != null);

  return (
    <MapContainer
      center={US_CENTER}
      zoom={4}
      minZoom={4}
      maxZoom={10}
      maxBounds={US_BOUNDS}
      maxBoundsViscosity={1.0}
      worldCopyJump={false}
      className="h-full w-full"
      preferCanvas
    >
      <TileLayer
        url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
        noWrap
      />
      {plottable.map((event) => (
        <Marker
          key={event.id}
          position={[event.lat as number, event.lng as number]}
          icon={markerIcon(event.status)}
          eventHandlers={{ click: () => onSelect(event) }}
        >
          <Tooltip direction="top" offset={[0, -8]}>
            {event.name}
          </Tooltip>
        </Marker>
      ))}
    </MapContainer>
  );
}
