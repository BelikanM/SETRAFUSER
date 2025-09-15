import React, { useEffect, useState } from "react";
import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import io from "socket.io-client";
import jwtDecode from 'jwt-decode';
// Correction pour icônes Leaflet
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl:
    "https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.7.1/dist/images/marker-shadow.png",
});
export default function UserMap() {
  const [users, setUsers] = useState([]);
  useEffect(() => {
    fetch("https://setrafuser.onrender.com/api/users/with-positions") // ton backend Render
      .then((res) => res.json())
      .then((data) => {
        console.log("✅ Utilisateurs récupérés:", data);
        setUsers(data);
      })
      .catch((err) => console.error("❌ Erreur fetch users:", err));
  }, []);
  // Position par défaut si aucun user (Libreville)
  const defaultPosition = [0.3901, 9.4544];

  const socket = io("https://setrafuser.onrender.com", {
    reconnection: true,
    reconnectionAttempts: 5,
    reconnectionDelay: 1000,
  });

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (token) {
      socket.emit("authenticate", token);
    }

    socket.on("user-device-location-updated", (data) => {
      setUsers((prevUsers) =>
        prevUsers.map((u) => {
          if (u._id.toString() === data.userId.toString()) {
            let newDevices = [...(u.devices || [])];
            if (data.device) {
              const deviceIndex = newDevices.findIndex((d) => d.id === data.device.id);
              if (deviceIndex !== -1) {
                newDevices[deviceIndex] = data.device;
              } else {
                newDevices.push(data.device);
              }
            }
            return {
              ...u,
              devices: newDevices,
              isOnline: data.isOnline ?? u.isOnline,
              lastLocation: data.lastLocation ?? u.lastLocation,
              city: data.city ?? u.city,
              country: data.country ?? u.country,
              neighborhood: data.neighborhood ?? u.neighborhood,
            };
          }
          return u;
        })
      );
    });

    return () => {
      socket.off("user-device-location-updated");
      socket.disconnect();
    };
  }, []);

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (token) {
      const decoded = jwtDecode(token);
      const userId = decoded.userId;
      if ("geolocation" in navigator) {
        navigator.geolocation.watchPosition(
          (position) => {
            const { latitude, longitude, accuracy } = position.coords;

            // ⚡ envoie au backend
            fetch(`https://setrafuser.onrender.com/api/users/${userId}/location`, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${token}`
              },
              body: JSON.stringify({ latitude, longitude, accuracy }),
            }).then(res => res.json()).then(data => console.log("Position sent", data)).catch(err => console.error(err));
          },
          (error) => {
            console.error("Erreur GPS:", error);
          },
          { enableHighAccuracy: true }
        );
      } else {
        console.warn("Géolocalisation non supportée");
      }
    }
  }, []);

  return (
    <MapContainer
      center={defaultPosition}
      zoom={6}
      style={{ height: "100vh", width: "100%" }}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      {users.map((user) =>
        user.lastLocation && user.lastLocation.lat && user.lastLocation.lng ? (
          <Marker
            key={user._id}
            position={[user.lastLocation.lat, user.lastLocation.lng]}
          >
            <Popup>
              <strong>{user.firstName} {user.lastName}</strong> <br />
              Quartier : {user.neighborhood} <br />
              Ville : {user.city} <br />
              Pays : {user.country}
            </Popup>
          </Marker>
        ) : null
      )}
    </MapContainer>
  );
}