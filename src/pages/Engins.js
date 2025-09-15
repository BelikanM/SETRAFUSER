import React, { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

// Correction des icônes Leaflet
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl:
    'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl:
    'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl:
    'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
});

const UsersMap = () => {
  const [users, setUsers] = useState([]);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [error, setError] = useState(null);
  const [currentPosition, setCurrentPosition] = useState(null);

  // Récupération des utilisateurs depuis le backend avec token
  const fetchUsers = async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) throw new Error('Token manquant. Connectez-vous.');

      const response = await fetch('https://setrafbackend.onrender.com/api/users', {
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) throw new Error('Impossible de récupérer les utilisateurs');

      const data = await response.json();
      setUsers(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoadingUsers(false);
    }
  };

  // Géolocalisation automatique de l'utilisateur
  useEffect(() => {
    if (!navigator.geolocation) {
      setError('Géolocalisation non supportée par votre navigateur');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setCurrentPosition([position.coords.latitude, position.coords.longitude]);
      },
      (err) => setError(err.message),
      { enableHighAccuracy: true }
    );
  }, []);

  useEffect(() => {
    fetchUsers();
  }, []);

  if (loadingUsers) return <p>Chargement des utilisateurs...</p>;
  if (error) return <p>Erreur : {error}</p>;

  // Calculer le centre de la carte globale
  const centerGlobal = users.length
    ? [
        users.reduce((acc, u) => acc + (u.latitude || 0), 0) / users.length,
        users.reduce((acc, u) => acc + (u.longitude || 0), 0) / users.length,
      ]
    : [0, 0];

  return (
    <div style={{ padding: '16px' }}>
      <h2>Cartes individuelles des utilisateurs</h2>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px' }}>
        {users.map((user) => (
          <div
            key={user._id}
            style={{
              width: '250px',
              height: '250px',
              border: '1px solid #ccc',
              borderRadius: '8px',
              overflow: 'hidden',
            }}
          >
            <MapContainer
              center={[user.latitude || 0, user.longitude || 0]}
              zoom={13}
              style={{ height: '100%', width: '100%' }}
              scrollWheelZoom={false}
            >
              <TileLayer
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
              />
              {user.latitude && user.longitude && (
                <Marker position={[user.latitude, user.longitude]}>
                  <Popup>
                    {user.name || 'Utilisateur'} <br />
                    {user.latitude.toFixed(5)}, {user.longitude.toFixed(5)}
                  </Popup>
                </Marker>
              )}
              {currentPosition && (
                <Marker position={currentPosition} icon={new L.Icon.Default()}>
                  <Popup>Vous êtes ici</Popup>
                </Marker>
              )}
            </MapContainer>
          </div>
        ))}
      </div>

      <h2 style={{ marginTop: '32px' }}>Carte globale</h2>
      <div style={{ width: '100%', height: '400px', border: '1px solid #ccc', borderRadius: '8px', overflow: 'hidden' }}>
        <MapContainer center={centerGlobal} zoom={2} style={{ width: '100%', height: '100%' }}>
          <TileLayer
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            attribution='&copy; OpenStreetMap'
          />
          {users.map(
            (user) =>
              user.latitude &&
              user.longitude && (
                <Marker key={user._id} position={[user.latitude, user.longitude]}>
                  <Popup>
                    {user.name || 'Utilisateur'} <br />
                    {user.latitude.toFixed(5)}, {user.longitude.toFixed(5)}
                  </Popup>
                </Marker>
              )
          )}
          {currentPosition && (
            <Marker
              position={currentPosition}
              icon={new L.Icon({
                iconUrl:
                  'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-red.png',
                iconSize: [25, 41],
                iconAnchor: [12, 41],
                popupAnchor: [1, -34],
                shadowUrl:
                  'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
                shadowSize: [41, 41],
              })}
            >
              <Popup>Vous êtes ici</Popup>
            </Marker>
          )}
        </MapContainer>
      </div>
    </div>
  );
};

export default UsersMap;
