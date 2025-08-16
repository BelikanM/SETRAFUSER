// src/components/GPS.js
import React, { useState, useEffect, useContext, useCallback, useRef } from "react";
import { MapContainer, TileLayer, Marker, Popup, Circle, LayersControl } from "react-leaflet";
import { useQuery } from "@tanstack/react-query";
import { UserContext } from "../context/UserContext";
import $ from "jquery";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

// Correction bug icônes Leaflet
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: require("leaflet/dist/images/marker-icon-2x.png"),
  iconUrl: require("leaflet/dist/images/marker-icon.png"),
  shadowUrl: require("leaflet/dist/images/marker-shadow.png"),
});

// Icônes utilisateurs personnalisées
const createCustomIcon = (role, isGroup = false, isCurrentUser = false) => {
  if (isGroup) {
    return L.divIcon({
      html: `<div style="
        background:#9333ea; width:40px; height:40px;
        border-radius:50%; display:flex; justify-content:center; align-items:center;
        font-weight:bold; color:white; font-size:16px; border:3px solid white; box-shadow:0 0 6px #444;">
        👥
      </div>`,
      iconSize: [40, 40],
      iconAnchor: [20, 20],
    });
  }

  const roles = {
    admin: { color: "#dc2626", label: "👑" },
    employee: { color: "#2563eb", label: "👷" },
  };
  const r = roles[role] || roles.employee;

  return L.divIcon({
    html: `<div style="
      background:${isCurrentUser ? "#10b981" : r.color};
      width:35px; height:35px; border-radius:50%;
      display:flex; justify-content:center; align-items:center;
      font-size:18px; border:2px solid white; box-shadow:0 0 6px #333;">
      ${isCurrentUser ? "👤" : r.label}
    </div>`,
    iconSize: [35, 35],
    iconAnchor: [17, 17],
  });
};

export default function GPS() {
  const { user, token } = useContext(UserContext);
  const [currentLocation, setCurrentLocation] = useState(
    JSON.parse(localStorage.getItem("current_gps")) || null
  );
  const [search, setSearch] = useState("");
  const watchIdRef = useRef(null);

  // === API fetch USERS ===
  const fetchUsers = useCallback(async () => {
    if (!token) throw new Error("Token manquant");
    const response = await $.ajax({
      url: "http://localhost:5000/api/users",
      method: "GET",
      headers: { Authorization: `Bearer ${token}` },
    });
    return (Array.isArray(response) ? response : []).filter(
      (u) => ["employee", "admin"].includes(u.role) && u.isVerified && u.isApproved
    );
  }, [token]);

  const { data: users = [], isLoading, error } = useQuery({
    queryKey: ["users", "gps"],
    queryFn: fetchUsers,
    enabled: !!user && !!token,
    refetchInterval: 30000,
  });

  // === GPS LIVE utilisateur ===
  useEffect(() => {
    if (!navigator.geolocation || !user || !token) return;

    const sendPositionToServer = async (loc) => {
      try {
        await $.ajax({
          url: "http://localhost:5000/api/users/update-location",
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          data: JSON.stringify({
            userId: user._id,
            lat: loc.lat,
            lng: loc.lng,
            accuracy: loc.acc,
          }),
        });
      } catch (e) {
        console.error("Erreur POST localisation:", e);
      }
    };

    const updatePosition = (pos) => {
      const loc = { lat: pos.coords.latitude, lng: pos.coords.longitude, acc: pos.coords.accuracy };
      setCurrentLocation(loc);
      localStorage.setItem("current_gps", JSON.stringify(loc));
      sendPositionToServer(loc);
    };

    const errorHandler = (err) => console.error("Erreur GPS:", err);

    navigator.geolocation.getCurrentPosition(updatePosition, errorHandler, { enableHighAccuracy: true });
    watchIdRef.current = navigator.geolocation.watchPosition(updatePosition, errorHandler, { enableHighAccuracy: true });

    return () => {
      if (watchIdRef.current) navigator.geolocation.clearWatch(watchIdRef.current);
    };
  }, [user, token]);

  // === Filtrage recherche ===
  const filteredUsers = users.filter((u) =>
    `${u.firstName} ${u.lastName} ${u.email}`.toLowerCase().includes(search.toLowerCase())
  );

  // === Grouper les utilisateurs par position (arrondi) ===
  const groupByPosition = {};
  filteredUsers.forEach((u) => {
    const lat = u.lastLocation?.lat || 48.8566 + Math.random() * 0.01;
    const lng = u.lastLocation?.lng || 2.3522 + Math.random() * 0.01;
    const key = `${lat.toFixed(5)},${lng.toFixed(5)}`;
    if (!groupByPosition[key]) groupByPosition[key] = [];
    groupByPosition[key].push({ ...u, lat, lng });
  });

  const { BaseLayer } = LayersControl;

  if (!user) return <p>⚠️ Veuillez vous connecter</p>;
  if (isLoading) return <p>Chargement des utilisateurs...</p>;
  if (error) return <p>Erreur: {error.message}</p>;

  return (
    <div>
      <h2>📡 Carte GPS – Utilisateurs</h2>
      <div style={{ marginBottom: "10px" }}>
        <input
          type="text"
          style={{ width: "100%", padding: "8px", borderRadius: "6px" }}
          placeholder="🔎 Recherche prénom, nom ou email..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <MapContainer
        center={currentLocation ? [currentLocation.lat, currentLocation.lng] : [48.8566, 2.3522]}
        zoom={14}
        style={{ height: "600px", width: "100%", borderRadius: "10px" }}
      >
        <LayersControl position="topright">
          {/* 🌍 OpenStreetMap Standard */}
          <BaseLayer checked name="🌍 OpenStreetMap">
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/">OSM</a> contributors'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
          </BaseLayer>

          {/* 🇫🇷 OpenStreetMap France (plus rapide en EU) */}
          <BaseLayer name="🇫🇷 OSM France">
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.fr/">OSM France</a>'
              url="https://{s}.tile.openstreetmap.fr/osmfr/{z}/{x}/{y}.png"
            />
          </BaseLayer>

          {/* Humanitarian */}
          <BaseLayer name="🌐 Humanitarian">
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/">OSM</a> & HOT'
              url="https://{s}.tile.openstreetmap.fr/hot/{z}/{x}/{y}.png"
            />
          </BaseLayer>

          {/* Esri High-Res Satellite */}
          <BaseLayer name="🛰️ Esri Satellite (HD)">
            <TileLayer
              attribution="Tiles © Esri, Maxar, Earthstar Geographics"
              url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
            />
          </BaseLayer>

          {/* Esri World StreetMap */}
          <BaseLayer name="🛣️ Esri World StreetMap">
            <TileLayer
              attribution="Tiles © Esri"
              url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}"
            />
          </BaseLayer>

          {/* Topographique */}
          <BaseLayer name="⛰️ OpenTopoMap">
            <TileLayer
              attribution='&copy; <a href="https://opentopomap.org">OpenTopoMap</a>'
              url="https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png"
            />
          </BaseLayer>

          {/* Carto Voyager */}
          <BaseLayer name="🧭 Carto Voyager (Light)">
            <TileLayer
              attribution='&copy; OSM contributors &copy; CARTO'
              url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
              subdomains={["a","b","c","d"]}
            />
          </BaseLayer>

          <BaseLayer name="🌑 Carto Voyager (Dark)">
            <TileLayer
              attribution='&copy; OSM contributors &copy; CARTO'
              url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
              subdomains={["a","b","c","d"]}
            />
          </BaseLayer>
        </LayersControl>

        {/* Position utilisateur */}
        {currentLocation && (
          <>
            <Marker position={[currentLocation.lat, currentLocation.lng]} icon={createCustomIcon("employee", false, true)}>
              <Popup>
                🚀 <b>Vous êtes ici</b><br />
                Lat: {currentLocation.lat.toFixed(5)}<br />
                Lng: {currentLocation.lng.toFixed(5)}<br />
                Précision: ±{Math.round(currentLocation.acc)} m
              </Popup>
            </Marker>
            <Circle
              center={[currentLocation.lat, currentLocation.lng]}
              radius={currentLocation.acc || 30}
              pathOptions={{ color: "#10b981", fillOpacity: 0.15 }}
            />
          </>
        )}

        {/* Autres utilisateurs */}
        {Object.keys(groupByPosition).map((key) => {
          const group = groupByPosition[key];
          const { lat, lng } = group[0];

          if (group.length === 1) {
            const u = group[0];
            return (
              <Marker key={u._id} position={[lat, lng]} icon={createCustomIcon(u.role)}>
                <Popup>
                  <h4>{u.firstName} {u.lastName}</h4>
                  <p>📧 <a href={`mailto:${u.email}`}>{u.email}</a></p>
                  <p>{u.role === "admin" ? "👑 Admin" : "👷 Employé"}</p>
                </Popup>
              </Marker>
            );
          }

          return (
            <React.Fragment key={key}>
              <Marker position={[lat, lng]} icon={createCustomIcon(null, true)}>
                <Popup>
                  <h4>👥 {group.length} utilisateurs ici</h4>
                  <ul>
                    {group.map((u) => (
                      <li key={u._id}>
                        <b>{u.firstName} {u.lastName}</b> ({u.role === "admin" ? "👑" : "👷"})<br />
                        📧 <a href={`mailto:${u.email}`}>{u.email}</a>
                      </li>
                    ))}
                  </ul>
                </Popup>
              </Marker>
              <Circle center={[lat, lng]} radius={40} pathOptions={{ color: "#9333ea", fillOpacity: 0.15 }} />
            </React.Fragment>
          );
        })}
      </MapContainer>
    </div>
  );
}

