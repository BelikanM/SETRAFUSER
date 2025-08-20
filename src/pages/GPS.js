// src/components/GPS.js
import React, { useState, useEffect, useContext, useCallback, useRef } from "react";
import { MapContainer, TileLayer, Marker, Circle, LayersControl } from "react-leaflet";
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
  const iconHtml = isGroup ? `
    <div style="
      background: linear-gradient(135deg, #9333ea, #7c3aed); 
      width:42px; height:42px; border-radius:50%; 
      display:flex; justify-content:center; align-items:center;
      font-weight:bold; color:white; font-size:16px; 
      border:3px solid rgba(255,255,255,0.9); 
      box-shadow: 0 4px 12px rgba(147,51,234,0.4), 0 0 0 2px rgba(147,51,234,0.2);
      backdrop-filter: blur(2px); cursor: pointer;
      transition: all 0.2s ease;">
      👥
    </div>` : (() => {
      const roles = {
        admin: { 
          color: "linear-gradient(135deg, #dc2626, #b91c1c)", 
          label: "👑",
          shadow: "rgba(220,38,38,0.4)"
        },
        employee: { 
          color: "linear-gradient(135deg, #2563eb, #1d4ed8)", 
          label: "👷",
          shadow: "rgba(37,99,235,0.4)"
        },
      };
      const r = roles[role] || roles.employee;
      
      return `
        <div style="
          background: ${isCurrentUser ? "linear-gradient(135deg, #10b981, #059669)" : r.color};
          width:37px; height:37px; border-radius:50%;
          display:flex; justify-content:center; align-items:center;
          font-size:18px; border:3px solid rgba(255,255,255,0.9); 
          box-shadow: 0 4px 12px ${isCurrentUser ? "rgba(16,185,129,0.4)" : r.shadow}, 
                      0 0 0 2px ${isCurrentUser ? "rgba(16,185,129,0.2)" : r.shadow.replace("0.4", "0.2")};
          backdrop-filter: blur(2px); cursor: pointer;
          transition: all 0.2s ease;">
          ${isCurrentUser ? "👤" : r.label}
        </div>`;
    })();

  return L.divIcon({
    html: iconHtml,
    iconSize: isGroup ? [42, 42] : [37, 37],
    iconAnchor: isGroup ? [21, 21] : [18, 18],
  });
};

// Configuration avancée des couches overlay optimisées
const createAdvancedSatelliteOverlays = () => {
  return [
    {
      name: "🏷️ Labels Premium",
      component: (
        <TileLayer
          attribution="&copy; OSM"
          url="https://{s}.basemaps.cartocdn.com/light_only_labels/{z}/{x}/{y}{r}.png"
          subdomains={["a","b","c","d"]}
          pane="overlayPane"
          opacity={0.95}
          className="overlay-labels-premium"
          updateWhenIdle={false}
          updateWhenZooming={false}
          keepBuffer={2}
        />
      )
    },
    {
      name: "🌃 Labels Nuit",
      component: (
        <TileLayer
          attribution="&copy; OSM"
          url="https://{s}.basemaps.cartocdn.com/dark_only_labels/{z}/{x}/{y}{r}.png"
          subdomains={["a","b","c","d"]}
          pane="overlayPane"
          opacity={0.85}
          className="overlay-labels-dark"
          updateWhenIdle={false}
          updateWhenZooming={false}
          keepBuffer={2}
        />
      )
    },
    {
      name: "🛣️ Routes Fluides",
      component: (
        <TileLayer
          attribution="&copy; OSM"
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          pane="overlayPane"
          opacity={0.25}
          className="overlay-roads-fluid"
          updateWhenIdle={false}
          updateWhenZooming={false}
          keepBuffer={1}
        />
      )
    },
    {
      name: "🏘️ Quartiers Soft",
      component: (
        <TileLayer
          attribution="&copy; OSM France"
          url="https://{s}.tile.openstreetmap.fr/osmfr/{z}/{x}/{y}.png"
          pane="overlayPane"
          opacity={0.18}
          className="overlay-districts-soft"
          updateWhenIdle={false}
          updateWhenZooming={false}
          keepBuffer={1}
        />
      )
    },
    {
      name: "🏢 Infrastructure",
      component: (
        <TileLayer
          attribution="&copy; OSM & HOT"
          url="https://{s}.tile.openstreetmap.fr/hot/{z}/{x}/{y}.png"
          pane="overlayPane"
          opacity={0.22}
          className="overlay-infrastructure-soft"
          updateWhenIdle={false}
          updateWhenZooming={false}
          keepBuffer={1}
        />
      )
    },
    {
      name: "🌊 Hydro Features",
      component: (
        <TileLayer
          attribution="&copy; OSM"
          url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager_labels_under/{z}/{x}/{y}{r}.png"
          subdomains={["a","b","c","d"]}
          pane="overlayPane"
          opacity={0.15}
          className="overlay-hydro-features"
          updateWhenIdle={false}
          updateWhenZooming={false}
          keepBuffer={1}
        />
      )
    }
  ];
};

export default function GPS() {
  const { user, token } = useContext(UserContext);
  const [currentLocation, setCurrentLocation] = useState(
    JSON.parse(localStorage.getItem("current_gps")) || null
  );
  const [search, setSearch] = useState("");
  const [activeOverlays, setActiveOverlays] = useState(new Set(["🏷️ Labels Premium"]));
  const [overlayIntensity, setOverlayIntensity] = useState(0.7);
  const [selectedUser, setSelectedUser] = useState(null);
  const [selectedGroup, setSelectedGroup] = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [satelliteControlsOpen, setSatelliteControlsOpen] = useState(false);
  const watchIdRef = useRef(null);
  const mapRef = useRef(null);

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

  // === Gestion des clics sur les marqueurs ===
  const handleMarkerClick = (userData, isGroup = false) => {
    if (isGroup) {
      setSelectedGroup(userData);
      setSelectedUser(null);
    } else {
      setSelectedUser(userData);
      setSelectedGroup(null);
    }
    setSidebarOpen(true);
    
    // Fermer tous les popups
    if (mapRef.current) {
      mapRef.current.closePopup();
    }
  };

  // === Optimisation des overlays avec debounce ===
  const [overlayTimeout, setOverlayTimeout] = useState(null);
  
  const handleOverlayChange = useCallback((overlayName, isChecked) => {
    if (overlayTimeout) clearTimeout(overlayTimeout);
    
    setOverlayTimeout(setTimeout(() => {
      const newOverlays = new Set(activeOverlays);
      if (isChecked) {
        newOverlays.add(overlayName);
      } else {
        newOverlays.delete(overlayName);
      }
      setActiveOverlays(newOverlays);
    }, 100));
  }, [activeOverlays, overlayTimeout]);

  // === Filtrage recherche ===
  const filteredUsers = users.filter((u) =>
    `${u.firstName} ${u.lastName} ${u.email}`.toLowerCase().includes(search.toLowerCase())
  );

  // === Grouper les utilisateurs par position ===
  const groupByPosition = {};
  filteredUsers.forEach((u) => {
    const lat = u.lastLocation?.lat || 48.8566 + Math.random() * 0.01;
    const lng = u.lastLocation?.lng || 2.3522 + Math.random() * 0.01;
    const key = `${lat.toFixed(5)},${lng.toFixed(5)}`;
    if (!groupByPosition[key]) groupByPosition[key] = [];
    groupByPosition[key].push({ ...u, lat, lng });
  });

  const { BaseLayer } = LayersControl;
  const satelliteOverlays = createAdvancedSatelliteOverlays();

  if (!user) return <p>⚠️ Veuillez vous connecter</p>;
  if (isLoading) return <p>Chargement des utilisateurs...</p>;
  if (error) return <p>Erreur: {error.message}</p>;

  return (
    <div style={{ position: "relative", height: "100vh", overflow: "hidden" }}>
      <style jsx>{`
        /* Styles optimisés pour performance et rendu */
        .overlay-labels-premium {
          mix-blend-mode: screen;
          filter: contrast(1.4) brightness(1.2) saturate(0.9) blur(0.2px);
          transform: translate3d(0,0,0);
          will-change: opacity;
          -webkit-font-smoothing: antialiased;
          transition: opacity 0.15s ease-out;
        }
        
        .overlay-labels-dark {
          mix-blend-mode: multiply;
          filter: contrast(1.6) brightness(0.8) saturate(1.1) blur(0.1px);
          transform: translate3d(0,0,0);
          will-change: opacity;
          transition: opacity 0.15s ease-out;
        }
        
        .overlay-roads-fluid {
          mix-blend-mode: soft-light;
          filter: contrast(0.8) brightness(1.1) saturate(0.6) blur(0.3px) hue-rotate(-10deg);
          transform: translate3d(0,0,0);
          will-change: opacity;
          transition: opacity 0.15s ease-out;
        }
        
        .overlay-districts-soft {
          mix-blend-mode: overlay;
          filter: contrast(0.7) brightness(1.05) saturate(0.5) blur(0.4px) opacity(0.8);
          transform: translate3d(0,0,0);
          will-change: opacity;
          transition: opacity 0.15s ease-out;
        }
        
        .overlay-infrastructure-soft {
          mix-blend-mode: color-burn;
          filter: contrast(0.9) brightness(1.15) saturate(0.4) blur(0.3px) sepia(0.1);
          transform: translate3d(0,0,0);
          will-change: opacity;
          transition: opacity 0.15s ease-out;
        }
        
        .overlay-hydro-features {
          mix-blend-mode: luminosity;
          filter: contrast(0.6) brightness(1.1) saturate(0.3) blur(0.5px) hue-rotate(15deg);
          transform: translate3d(0,0,0);
          will-change: opacity;
          transition: opacity 0.15s ease-out;
        }

        .leaflet-tile-container {
          filter: blur(0.05px);
          transform: translate3d(0,0,0);
          will-change: transform;
        }
        
        .leaflet-overlay-pane {
          backdrop-filter: blur(0.1px);
          -webkit-backdrop-filter: blur(0.1px);
        }

        .leaflet-control-layers {
          background: rgba(255, 255, 255, 0.98);
          backdrop-filter: blur(16px) saturate(180%);
          -webkit-backdrop-filter: blur(16px) saturate(180%);
          border: 1px solid rgba(255, 255, 255, 0.3);
          border-radius: 12px;
          box-shadow: 0 8px 32px rgba(0,0,0,0.12), 0 2px 8px rgba(0,0,0,0.05);
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          color: #1f2937 !important;
        }

        .leaflet-control-layers-base label,
        .leaflet-control-layers-overlays label {
          color: #1f2937 !important;
          font-weight: 500;
        }
        
        /* Bouton Satellite Toggle */
        .satellite-toggle-btn {
          position: absolute;
          top: 80px;
          right: ${sidebarOpen ? '320px' : '10px'};
          z-index: 1000;
          background: rgba(255, 255, 255, 0.98);
          backdrop-filter: blur(16px) saturate(180%);
          -webkit-backdrop-filter: blur(16px) saturate(180%);
          border: 1px solid rgba(255, 255, 255, 0.3);
          border-radius: 50%;
          width: 48px;
          height: 48px;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          box-shadow: 0 4px 16px rgba(0,0,0,0.1);
          transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
          font-size: 20px;
          color: #374151;
          will-change: transform, right;
        }

        .satellite-toggle-btn:hover {
          background: rgba(59, 130, 246, 0.1);
          transform: scale(1.05);
          box-shadow: 0 6px 20px rgba(0,0,0,0.15);
        }

        .satellite-toggle-btn:active {
          transform: scale(0.95);
        }
        
        .satellite-controls {
          position: absolute;
          top: 140px;
          right: ${sidebarOpen ? '320px' : '10px'};
          z-index: 999;
          background: rgba(255, 255, 255, 0.98);
          backdrop-filter: blur(20px) saturate(180%);
          -webkit-backdrop-filter: blur(20px) saturate(180%);
          padding: 20px;
          border-radius: 16px;
          border: 1px solid rgba(255, 255, 255, 0.3);
          box-shadow: 0 12px 40px rgba(0,0,0,0.15), 0 4px 16px rgba(0,0,0,0.08);
          max-width: 260px;
          min-width: 220px;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          transform: ${satelliteControlsOpen ? 'translateY(0) scale(1)' : 'translateY(-20px) scale(0.95)'};
          opacity: ${satelliteControlsOpen ? '1' : '0'};
          visibility: ${satelliteControlsOpen ? 'visible' : 'hidden'};
          transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
          will-change: transform, opacity, right;
        }

        .user-sidebar {
          position: absolute;
          top: 0;
          right: ${sidebarOpen ? '0' : '-320px'};
          width: 300px;
          height: 100%;
          background: rgba(255, 255, 255, 0.98);
          backdrop-filter: blur(25px) saturate(180%);
          -webkit-backdrop-filter: blur(25px) saturate(180%);
          border-left: 1px solid rgba(255, 255, 255, 0.3);
          box-shadow: -6px 0 40px rgba(0,0,0,0.12);
          z-index: 1001;
          transition: right 0.25s cubic-bezier(0.4, 0, 0.2, 1);
          overflow-y: auto;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          will-change: right;
        }

        .sidebar-header {
          padding: 24px 20px;
          border-bottom: 1px solid rgba(0,0,0,0.08);
          background: rgba(59, 130, 246, 0.03);
          position: sticky;
          top: 0;
          z-index: 10;
          backdrop-filter: blur(10px);
        }

        .sidebar-content {
          padding: 20px;
        }

        .close-btn {
          position: absolute;
          top: 18px;
          right: 18px;
          background: none;
          border: none;
          font-size: 22px;
          cursor: pointer;
          color: #6b7280;
          transition: all 0.2s ease;
          width: 32px;
          height: 32px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .close-btn:hover {
          color: #374151;
          background: rgba(0,0,0,0.05);
          transform: scale(1.1);
        }

        .user-card {
          background: white;
          border-radius: 16px;
          padding: 20px;
          margin-bottom: 16px;
          border: 1px solid rgba(0,0,0,0.04);
          box-shadow: 0 4px 16px rgba(0,0,0,0.06);
          transition: all 0.2s ease;
        }

        .user-card:hover {
          transform: translateY(-2px);
          box-shadow: 0 8px 24px rgba(0,0,0,0.1);
        }

        .overlay-toggle {
          display: flex;
          align-items: center;
          margin: 8px 0;
          font-size: 14px;
          font-weight: 500;
          transition: all 0.2s ease;
          padding: 8px 10px;
          border-radius: 8px;
          cursor: pointer;
          color: #1f2937;
        }
        
        .overlay-toggle:hover {
          background: rgba(59, 130, 246, 0.08);
          transform: translateX(3px);
        }
        
        .overlay-toggle input {
          margin-right: 10px;
          accent-color: #3b82f6;
          transform: scale(1.15);
        }
        
        .intensity-slider {
          width: 100%;
          margin: 12px 0;
          accent-color: #3b82f6;
          height: 8px;
          border-radius: 4px;
          background: linear-gradient(to right, #e5e7eb, #3b82f6);
          transition: all 0.2s ease;
        }

        .intensity-slider:hover {
          transform: scaleY(1.2);
        }
        
        .controls-header {
          margin: 0 0 16px 0;
          font-size: 16px;
          font-weight: 600;
          color: #1f2937;
          display: flex;
          align-items: center;
          gap: 8px;
        }
        
        .intensity-label {
          font-size: 13px;
          color: #374151;
          margin-bottom: 6px;
          font-weight: 500;
        }

        .leaflet-popup {
          display: none !important;
        }

        @media (max-width: 768px) {
          .satellite-toggle-btn {
            top: 70px;
            right: ${sidebarOpen ? '260px' : '5px'};
            width: 44px;
            height: 44px;
            font-size: 18px;
          }

          .satellite-controls {
            top: 125px;
            right: ${sidebarOpen ? '260px' : '5px'};
            max-width: 200px;
            padding: 16px;
          }
          
          .user-sidebar {
            width: 250px;
            right: ${sidebarOpen ? '0' : '-250px'};
          }
          
          .overlay-toggle {
            font-size: 13px;
            padding: 6px 8px;
          }

          .controls-header {
            font-size: 15px;
          }
        }

        /* Animation d'entrée optimisée */
        @keyframes slideInFromRight {
          from {
            transform: translateX(100%);
            opacity: 0;
          }
          to {
            transform: translateX(0);
            opacity: 1;
          }
        }

        /* Performance boost */
        * {
          -webkit-font-smoothing: antialiased;
          -moz-osx-font-smoothing: grayscale;
        }

        .leaflet-container {
          background: #f8fafc;
        }
      `}</style>

      <div style={{ position: "absolute", top: "20px", left: "20px", right: sidebarOpen ? "320px" : "20px", zIndex: 999 }}>
        <h2 style={{ margin: "0 0 12px 0", color: "#1f2937", fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif", fontSize: "24px", fontWeight: "700" }}>
          📡 Carte GPS – Utilisateurs
        </h2>
        <input
          type="text"
          style={{
            width: "100%",
            padding: "14px 18px",
            borderRadius: "12px",
            border: "2px solid #e5e7eb",
            fontSize: "15px",
            transition: "all 0.2s ease",
            fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
            boxShadow: "0 2px 8px rgba(0,0,0,0.04)"
          }}
          placeholder="🔎 Recherche prénom, nom ou email..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onFocus={(e) => {
            e.target.style.borderColor = "#3b82f6";
            e.target.style.boxShadow = "0 4px 16px rgba(59,130,246,0.12)";
          }}
          onBlur={(e) => {
            e.target.style.borderColor = "#e5e7eb";
            e.target.style.boxShadow = "0 2px 8px rgba(0,0,0,0.04)";
          }}
        />
      </div>

      <MapContainer
        ref={mapRef}
        center={currentLocation ? [currentLocation.lat, currentLocation.lng] : [48.8566, 2.3522]}
        zoom={14}
        style={{ 
          height: "100%", 
          width: "100%"
        }}
        preferCanvas={true}
        updateWhenIdle={false}
        updateWhenZooming={false}
        zoomAnimation={true}
        fadeAnimation={true}
        markerZoomAnimation={true}
      >
        <LayersControl position="topright">
          <BaseLayer name="🌍 OpenStreetMap">
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/">OSM</a> contributors'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              updateWhenIdle={false}
              updateWhenZooming={false}
              keepBuffer={2}
            />
          </BaseLayer>

          <BaseLayer name="🇫🇷 OSM France">
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.fr/">OSM France</a>'
              url="https://{s}.tile.openstreetmap.fr/osmfr/{z}/{x}/{y}.png"
              updateWhenIdle={false}
              updateWhenZooming={false}
              keepBuffer={2}
            />
          </BaseLayer>

          <BaseLayer checked name="🛰️ Satellite Ultra HD">
            <React.Fragment>
              <TileLayer
                attribution="Tiles © Esri, Maxar, Earthstar Geographics"
                url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
                className="satellite-base"
                updateWhenIdle={false}
                updateWhenZooming={false}
                keepBuffer={3}
              />
              
              {satelliteOverlays.map((overlay) => 
                activeOverlays.has(overlay.name) ? (
                  <div key={overlay.name} style={{opacity: overlayIntensity}}>
                    {React.cloneElement(overlay.component, {
                      opacity: overlay.component.props.opacity * overlayIntensity
                    })}
                  </div>
                ) : null
              )}
            </React.Fragment>
          </BaseLayer>

          <BaseLayer name="🛣️ Esri StreetMap">
            <TileLayer
              attribution="Tiles © Esri"
              url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}"
              updateWhenIdle={false}
              updateWhenZooming={false}
              keepBuffer={2}
            />
          </BaseLayer>

          <BaseLayer name="⛰️ OpenTopoMap">
            <TileLayer
              attribution='&copy; <a href="https://opentopomap.org">OpenTopoMap</a>'
              url="https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png"
              updateWhenIdle={false}
              updateWhenZooming={false}
              keepBuffer={2}
            />
          </BaseLayer>

          <BaseLayer name="🧭 Carto Light">
            <TileLayer
              attribution='&copy; OSM contributors &copy; CARTO'
              url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
              subdomains={["a","b","c","d"]}
              updateWhenIdle={false}
              updateWhenZooming={false}
              keepBuffer={2}
            />
          </BaseLayer>

          <BaseLayer name="🌑 Carto Dark">
            <TileLayer
              attribution='&copy; OSM contributors &copy; CARTO'
              url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
              subdomains={["a","b","c","d"]}
              updateWhenIdle={false}
              updateWhenZooming={false}
              keepBuffer={2}
            />
          </BaseLayer>
        </LayersControl>

        {/* Position utilisateur */}
        {currentLocation && (
          <>
            <Marker 
              position={[currentLocation.lat, currentLocation.lng]} 
              icon={createCustomIcon("employee", false, true)}
              eventHandlers={{
                click: () => handleMarkerClick({
                  firstName: user.firstName || "Vous",
                  lastName: user.lastName || "",
                  email: user.email,
                  role: user.role,
                  isCurrentUser: true,
                  location: currentLocation
                })
              }}
            />
            <Circle
              center={[currentLocation.lat, currentLocation.lng]}
              radius={currentLocation.acc || 30}
              pathOptions={{ 
                color: "#10b981", 
                fillOpacity: 0.12,
                weight: 2,
                dashArray: "5, 5"
              }}
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
              <Marker 
                key={u._id} 
                position={[lat, lng]} 
                icon={createCustomIcon(u.role)}
                eventHandlers={{
                  click: () => handleMarkerClick(u)
                }}
              />
            );
          }

          return (
            <React.Fragment key={key}>
              <Marker 
                position={[lat, lng]} 
                icon={createCustomIcon(null, true)}
                eventHandlers={{
                  click: () => handleMarkerClick(group, true)
                }}
              />
              <Circle 
                center={[lat, lng]} 
                radius={50} 
                pathOptions={{ 
                  color: "#9333ea", 
                  fillOpacity: 0.1,
                  weight: 2,
                  dashArray: "3, 6"
                }} 
              />
            </React.Fragment>
          );
        })}
      </MapContainer>

      {/* Bouton Toggle Contrôles Satellite */}
      <div 
        className="satellite-toggle-btn"
        onClick={() => setSatelliteControlsOpen(!satelliteControlsOpen)}
        title={satelliteControlsOpen ? "Fermer les contrôles satellite" : "Ouvrir les contrôles satellite"}
      >
        {satelliteControlsOpen ? "⚙️" : "🛰️"}
      </div>

      {/* Contrôles Satellite Rétractables */}
      <div className="satellite-controls">
        <div className="controls-header">
          <span>🛰️</span>
          <span>Contrôles Satellite</span>
        </div>
        
        <div className="intensity-label">
          Intensité Overlays: {Math.round(overlayIntensity * 100)}%
        </div>
        <input
          type="range"
          className="intensity-slider"
          min="0.1"
          max="1"
          step="0.05"
          value={overlayIntensity}
          onChange={(e) => setOverlayIntensity(parseFloat(e.target.value))}
        />
        
        <div style={{marginTop: "18px"}}>
          {satelliteOverlays.map((overlay) => (
            <label key={overlay.name} className="overlay-toggle">
              <input
                type="checkbox"
                checked={activeOverlays.has(overlay.name)}
                onChange={(e) => handleOverlayChange(overlay.name, e.target.checked)}
              />
              <span>{overlay.name}</span>
            </label>
          ))}
        </div>
      </div>

      {/* Sidebar Utilisateurs */}
      <div className="user-sidebar">
        <div className="sidebar-header">
          <h3 style={{ margin: "0", color: "#1f2937", fontSize: "18px", fontWeight: "600" }}>
            {selectedGroup ? `👥 Groupe (${selectedGroup.length})` : selectedUser ? "👤 Utilisateur" : "📍 Informations"}
          </h3>
          <button className="close-btn" onClick={() => setSidebarOpen(false)}>
            ✕
          </button>
        </div>

        <div className="sidebar-content">
          {selectedUser && (
            <div className="user-card">
              <h4 style={{ margin: "0 0 12px 0", color: "#1f2937", fontSize: "16px", fontWeight: "600" }}>
                {selectedUser.firstName} {selectedUser.lastName}
              </h4>
              
              <div style={{ marginBottom: "8px" }}>
                <span style={{ fontSize: "14px", color: "#6b7280", fontWeight: "500" }}>Email:</span>
                <br />
                <a href={`mailto:${selectedUser.email}`} style={{ color: "#3b82f6", textDecoration: "none", fontSize: "14px" }}>
                  {selectedUser.email}
                </a>
              </div>
              
              <div style={{ marginBottom: "8px" }}>
                <span style={{ fontSize: "14px", color: "#6b7280", fontWeight: "500" }}>Rôle:</span>
                <br />
                <span style={{ fontSize: "14px", color: "#374151" }}>
                  {selectedUser.role === "admin" ? "👑 Administrateur" : "👷 Employé"}
                </span>
              </div>

              {selectedUser.isCurrentUser && selectedUser.location && (
                <div style={{ marginBottom: "8px" }}>
                  <span style={{ fontSize: "14px", color: "#6b7280", fontWeight: "500" }}>Position:</span>
                  <br />
                  <span style={{ fontSize: "12px", color: "#6b7280", fontFamily: "monospace" }}>
                    Lat: {selectedUser.location.lat.toFixed(6)}<br />
                    Lng: {selectedUser.location.lng.toFixed(6)}<br />
                    Précision: ±{Math.round(selectedUser.location.acc)} m
                  </span>
                </div>
              )}

              <div style={{ marginTop: "16px", paddingTop: "16px", borderTop: "1px solid #e5e7eb" }}>
                <button 
                  style={{
                    background: "#3b82f6",
                    color: "white",
                    border: "none",
                    padding: "10px 18px",
                    borderRadius: "8px",
                    fontSize: "14px",
                    fontWeight: "500",
                    cursor: "pointer",
                    marginRight: "10px",
                    transition: "all 0.2s ease"
                  }}
                  onMouseOver={(e) => e.target.style.background = "#2563eb"}
                  onMouseOut={(e) => e.target.style.background = "#3b82f6"}
                  onClick={() => window.open(`mailto:${selectedUser.email}`, '_blank')}
                >
                  📧 Contacter
                </button>
                
                {!selectedUser.isCurrentUser && (
                  <button 
                    style={{
                      background: "#10b981",
                      color: "white",
                      border: "none",
                      padding: "10px 18px",
                      borderRadius: "8px",
                      fontSize: "14px",
                      fontWeight: "500",
                      cursor: "pointer",
                      transition: "all 0.2s ease"
                    }}
                    onMouseOver={(e) => e.target.style.background = "#059669"}
                    onMouseOut={(e) => e.target.style.background = "#10b981"}
                    onClick={() => {
                      if (mapRef.current) {
                        mapRef.current.setView([selectedUser.lat, selectedUser.lng], 16);
                      }
                    }}
                  >
                    🎯 Localiser
                  </button>
                )}
              </div>
            </div>
          )}

          {selectedGroup && (
            <div>
              <div style={{ marginBottom: "20px", padding: "14px", background: "#f3f4f6", borderRadius: "10px" }}>
                <span style={{ fontSize: "14px", color: "#374151", fontWeight: "500" }}>
                  {selectedGroup.length} utilisateurs à cette position
                </span>
              </div>
              
              {selectedGroup.map((u, index) => (
                <div key={u._id} className="user-card">
                  <h5 style={{ margin: "0 0 10px 0", color: "#1f2937", fontSize: "14px", fontWeight: "600" }}>
                    {u.firstName} {u.lastName}
                  </h5>
                  
                  <div style={{ fontSize: "12px", color: "#6b7280", marginBottom: "6px" }}>
                    <a href={`mailto:${u.email}`} style={{ color: "#3b82f6", textDecoration: "none" }}>
                      {u.email}
                    </a>
                  </div>
                  
                  <div style={{ fontSize: "12px", color: "#6b7280", marginBottom: "10px" }}>
                    {u.role === "admin" ? "👑 Admin" : "👷 Employé"}
                  </div>
                  
                  <button 
                    style={{
                      background: "#6b7280",
                      color: "white",
                      border: "none",
                      padding: "6px 12px",
                      borderRadius: "6px",
                      fontSize: "12px",
                      fontWeight: "500",
                      cursor: "pointer",
                      transition: "all 0.2s ease"
                    }}
                    onMouseOver={(e) => e.target.style.background = "#374151"}
                    onMouseOut={(e) => e.target.style.background = "#6b7280"}
                    onClick={() => {
                      setSelectedUser(u);
                      setSelectedGroup(null);
                    }}
                  >
                    👁️ Voir détails
                  </button>
                </div>
              ))}
            </div>
          )}

          {!selectedUser && !selectedGroup && (
            <div style={{ textAlign: "center", padding: "60px 20px", color: "#6b7280" }}>
              <div style={{ fontSize: "56px", marginBottom: "20px" }}>📍</div>
              <p style={{ margin: "0", fontSize: "15px", lineHeight: "1.5" }}>
                Cliquez sur un marqueur pour voir les informations utilisateur
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

