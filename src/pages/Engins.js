import React, { useEffect, useState, useRef } from "react";
import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import axios from "axios";

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
  const mapRef = useRef();

  // Récupération sécurisée des utilisateurs
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
      console.error("Erreur récupération utilisateurs :", err);
      setError(err.message);
      setUsers([]);
    }
  };

  useEffect(() => {
    fetchUsers();
    const interval = setInterval(fetchUsers, 5000);
    return () => clearInterval(interval);
  }, []);

  const centerPosition = () => {
    if (!users.length) return [0, 0];
    const validUsers = users.filter(user => 
      user.position && typeof user.position.lat === 'number' && typeof user.position.lng === 'number'
    );
    if (!validUsers.length) return [0, 0];
    
    const latSum = validUsers.reduce((sum, u) => sum + u.position.lat, 0);
    const lngSum = validUsers.reduce((sum, u) => sum + u.position.lng, 0);
    return [latSum / validUsers.length, lngSum / validUsers.length];
  };

  if (error) {
    return <div className="error-message">Erreur: {error}</div>;
  }

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