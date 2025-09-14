import React, { useEffect, useState, useRef } from "react";
import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import axios from "axios";
import io from "socket.io-client";

// Fix pour les icônes Leaflet
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: require("leaflet/dist/images/marker-icon-2x.png"),
  iconUrl: require("leaflet/dist/images/marker-icon.png"),
  shadowUrl: require("leaflet/dist/images/marker-shadow.png"),
});

const RealtimeMap = () => {
  const [users, setUsers] = useState([]);
  const [error, setError] = useState(null);
  const [userLocation, setUserLocation] = useState(null);
  const mapRef = useRef();
  const socket = useRef(null);

  // Fonction pour obtenir la position de l'utilisateur
  const getUserLocation = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        async (position) => {
          const { latitude, longitude, accuracy } = position.coords;
          setUserLocation({ lat: latitude, lng: longitude });
          // Mise à jour de la position sur le serveur
          try {
            const token = localStorage.getItem("token");
            const userId = localStorage.getItem("userId"); // Assurez-vous d'avoir stocké l'userId lors du login
            
            await axios.post("/api/users/update-location", 
              {
                userId,
                lat: latitude,
                lng: longitude,
                accuracy
              },
              {
                headers: { Authorization: `Bearer ${token}` }
              }
            );
          } catch (err) {
            console.error("Erreur mise à jour position:", err);
          }
        },
        (error) => {
          console.error("Erreur géolocalisation:", error);
          setError("Impossible d'obtenir votre position");
        },
        {
          enableHighAccuracy: true,
          timeout: 5000,
          maximumAge: 0
        }
      );
    } else {
      setError("Géolocalisation non supportée par votre navigateur");
    }
  };

  // Récupération des utilisateurs avec leurs positions
  const fetchUsers = async () => {
    try {
      const token = localStorage.getItem("token");
      if (!token) {
        throw new Error("Token d'authentification manquant");
      }

      const res = await axios.get("/api/users/with-positions", {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.data) {
        throw new Error("Données invalides reçues du serveur");
      }

      setUsers(Array.isArray(res.data) ? res.data : []);
      setError(null);
    } catch (err) {
      console.error("Erreur récupération utilisateurs:", err);
      setError(err.message);
      setUsers([]);
    }
  };

  // Centrer la carte sur la moyenne des positions
  const centerPosition = () => {
    if (userLocation) return [userLocation.lat, userLocation.lng];
    if (!users.length) return [48.8566, 2.3522];
    
    const validUsers = users.filter(user => 
      user.position && typeof user.position.lat === 'number' && typeof user.position.lng === 'number'
    );
    if (!validUsers.length) return [48.8566, 2.3522];
    
    const latSum = validUsers.reduce((sum, u) => sum + u.position.lat, 0);
    const lngSum = validUsers.reduce((sum, u) => sum + u.position.lng, 0);
    return [latSum / validUsers.length, lngSum / validUsers.length];
  };

  useEffect(() => {
    getUserLocation();
    const locationInterval = setInterval(getUserLocation, 10000); // Mise à jour toutes les 10 secondes

    fetchUsers();
    const usersInterval = setInterval(fetchUsers, 5000);

    return () => {
      clearInterval(locationInterval);
      clearInterval(usersInterval);
    };
  }, []);

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (token) {
      socket.current = io();
      socket.current.on("connect", () => {
        socket.current.emit("authenticate", token);
      });

      socket.current.on("user-location-updated", (data) => {
        setUsers((prevUsers) =>
          prevUsers.map((u) =>
            u._id.toString() === data.userId.toString()
              ? {
                  ...u,
                  position: data.position,
                  lastSeen: data.lastUpdate,
                  isOnline: data.isOnline,
                }
              : u
          )
        );
      });

      socket.current.on("user-online", (data) => {
        setUsers((prev) =>
          prev.map((u) =>
            u._id.toString() === data.userId.toString()
              ? { ...u, isOnline: true }
              : u
          )
        );
      });

      socket.current.on("user-offline", (data) => {
        setUsers((prev) =>
          prev.map((u) =>
            u._id.toString() === data.userId.toString()
              ? { ...u, isOnline: false }
              : u
          )
        );
      });
    }

    return () => {
      if (socket.current) {
        socket.current.disconnect();
      }
    };
  }, []);

  useEffect(() => {
    if (mapRef.current) {
      const center = centerPosition();
      mapRef.current.flyTo(center, mapRef.current.getZoom() || 13);
    }
  }, [users, userLocation]);

  if (error) {
    return <div className="error-message">Erreur: {error}</div>;
  }

  return (
    <div style={{ height: "100vh", width: "100%" }}>
      <MapContainer
        center={centerPosition()}
        zoom={13}
        style={{ height: "100%", width: "100%" }}
        ref={mapRef}
      >
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        />

        {/* Marqueur pour la position de l'utilisateur actuel */}
        {userLocation && (
          <Marker
            position={[userLocation.lat, userLocation.lng]}
            icon={new L.Icon({
              iconRetinaUrl: require("leaflet/dist/images/marker-icon-2x.png"),
              iconUrl: require("leaflet/dist/images/marker-icon.png"),
              iconSize: [25, 41],
              iconAnchor: [12, 41],
              popupAnchor: [1, -34],
              shadowUrl: require("leaflet/dist/images/marker-shadow.png"),
            })}
          >
            <Popup>
              <div style={{ textAlign: "center" }}>
                <p>Ma position</p>
              </div>
            </Popup>
          </Marker>
        )}

        {/* Marqueurs pour tous les autres utilisateurs */}
        {users.map((user) => (
          user.position && typeof user.position.lat === 'number' && typeof user.position.lng === 'number' && (
            <Marker
              key={user._id}
              position={[user.position.lat, user.position.lng]}
            >
              <Popup>
                <div style={{ textAlign: "center" }}>
                  {user.profilePhoto && (
                    <img
                      src={`/${user.profilePhoto}`}
                      alt={`${user.firstName} ${user.lastName}`}
                      style={{ width: 50, height: 50, borderRadius: "50%" }}
                      onError={(e) => e.target.style.display = 'none'}
                    />
                  )}
                  <p>
                    {user.firstName} {user.lastName}
                  </p>
                  <p>Role : {user.role}</p>
                  <p>
                    Dernière mise à jour :{" "}
                    {new Date(user.position.lastUpdate).toLocaleString()}
                  </p>
                </div>
              </Popup>
            </Marker>
          )
        ))}
      </MapContainer>
    </div>
  );
};

export default RealtimeMap;