import React, { useEffect, useState } from "react";
import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import io from "socket.io-client";
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
            const deviceIndex = newDevices.findIndex((d) => d.id === data.device.id);
            if (deviceIndex !== -1) {
              newDevices[deviceIndex] = data.device;
            } else {
              newDevices.push(data.device);
            }
            return {
              ...u,
              devices: newDevices,
              isOnline: data.isOnline,
              lastLocation: data.lastLocation,
              city: data.city,
              country: data.country,
              neighborhood: data.neighborhood,
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