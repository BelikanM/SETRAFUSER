import React, { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

// Fix icon Leaflet pour React
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

const UsersMap = () => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [currentPosition, setCurrentPosition] = useState([0, 0]);

  // Récupération des utilisateurs
  const fetchUsers = async () => {
    try {
      const response = await fetch('https://setrafbackend.onrender.com/api/users');
      if (!response.ok) throw new Error('Erreur lors de la récupération des utilisateurs');
      const data = await response.json();
      setUsers(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Géolocalisation automatique
  useEffect(() => {
    fetchUsers();
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setCurrentPosition([position.coords.latitude, position.coords.longitude]);
        },
        (err) => console.error('Erreur géolocalisation :', err),
        { enableHighAccuracy: true }
      );
    }
  }, []);

  if (loading) return <p>Chargement des utilisateurs...</p>;
  if (error) return <p>Erreur : {error}</p>;
  if (users.length === 0) return <p>Aucun utilisateur trouvé.</p>;

  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '20px', padding: '20px' }}>
      {users.map((user) => (
        <div key={user._id} style={{ width: '300px', border: '1px solid #ccc', borderRadius: '8px', overflow: 'hidden' }}>
          <h3 style={{ padding: '10px', margin: 0 }}>{user.firstName} {user.lastName}</h3>
          <p style={{ padding: '0 10px', margin: 0 }}>Email: {user.email}</p>
          <p style={{ padding: '0 10px', margin: 0 }}>
            Coordonnées: {user.latitude}, {user.longitude}
          </p>

          <MapContainer
            center={[user.latitude || 0, user.longitude || 0]}
            zoom={13}
            style={{ height: '200px', width: '100%' }}
          >
            <TileLayer
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              attribution="&copy; OpenStreetMap contributors"
            />
            {user.latitude && user.longitude && (
              <Marker position={[user.latitude, user.longitude]}>
                <Popup>
                  {user.firstName} {user.lastName} <br />
                  {user.latitude}, {user.longitude}
                </Popup>
              </Marker>
            )}
          </MapContainer>
        </div>
      ))}

      {/* Position de l'utilisateur courant */}
      <div style={{ width: '300px', border: '2px solid #007bff', borderRadius: '8px', overflow: 'hidden' }}>
        <h3 style={{ padding: '10px', margin: 0 }}>Ma position actuelle</h3>
        <MapContainer
          center={currentPosition}
          zoom={13}
          style={{ height: '200px', width: '100%' }}
        >
          <TileLayer
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            attribution="&copy; OpenStreetMap contributors"
          />
          <Marker position={currentPosition}>
            <Popup>Vous êtes ici : {currentPosition[0]}, {currentPosition[1]}</Popup>
          </Marker>
        </MapContainer>
      </div>
    </div>
  );
};

export default UsersMap;
