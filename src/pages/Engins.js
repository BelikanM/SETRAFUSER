import React, { useEffect, useState, useRef } from "react";
import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import axios from "axios";

// Fix pour les icônes Leaflet
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl:
    "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png",
  iconUrl:
    "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png",
  shadowUrl:
    "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png",
});

const RealtimeMap = () => {
  const [users, setUsers] = useState([]);
  const mapRef = useRef();

  // Récupération sécurisée des utilisateurs
  const fetchUsers = async () => {
    try {
      const token = localStorage.getItem("token");
      const res = await axios.get("/api/users/with-positions", {
        headers: { Authorization: `Bearer ${token}` },
      });

      console.log("Users API response:", res.data);

      setUsers(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      console.error("Erreur récupération utilisateurs :", err);
      setUsers([]);
    }
  };

  // Mise à jour toutes les 5 secondes
  useEffect(() => {
    fetchUsers();
    const interval = setInterval(fetchUsers, 5000);
    return () => clearInterval(interval);
  }, []);

  // Centrer la carte sur la moyenne des positions
  const centerPosition = () => {
    if (!users.length) return [0, 0];
    const latSum = users.reduce((sum, u) => sum + u.position.lat, 0);
    const lngSum = users.reduce((sum, u) => sum + u.position.lng, 0);
    return [latSum / users.length, lngSum / users.length];
  };

  return (
    <div style={{ height: "100vh", width: "100%" }}>
      <MapContainer
        center={centerPosition()}
        zoom={2}
        style={{ height: "100%", width: "100%" }}
        ref={mapRef}
      >
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        />

        {Array.isArray(users) &&
          users.map((user) => (
            <Marker
              key={user._id}
              position={[user.position.lat, user.position.lng]}
            >
              <Popup>
                <div style={{ textAlign: "center" }}>
                  {user.profilePhoto && (
                    <img
                      src={`/${user.profilePhoto}`}
                      alt="Profil"
                      style={{ width: 50, height: 50, borderRadius: "50%" }}
                    />
                  )}
                  <p>
                    {user.firstName} {user.lastName}
                  </p>
                  <p>Role : {user.role}</p>
                  <p>
                    Dernière mise à jour :{" "}
                    {new Date(user.position.lastUpdate).toLocaleTimeString()}
                  </p>
                </div>
              </Popup>
            </Marker>
          ))}
      </MapContainer>
    </div>
  );
};

export default RealtimeMap;
