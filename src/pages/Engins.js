import React, { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [currentPosition, setCurrentPosition] = useState(null);

  // Récupération des utilisateurs depuis le backend
  const fetchUsers = async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) throw new Error('Token manquant, connectez-vous.');

      const response = await fetch(
        'https://setrafbackend.onrender.com/api/users',
        {
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (!response.ok) throw new Error('Impossible de récupérer les utilisateurs');

      const data = await response.json();
      setUsers(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
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

  if (loading) return <p>Chargement des utilisateurs...</p>;
  if (error) return <p>Erreur : {error}</p>;

  // Calculer le centre global
  const validUsers = users.filter(u => u.latitude && u.longitude && u.gpsActive);
  const centerGlobal = validUsers.length
    ? [
        validUsers.reduce((acc, u) => acc + u.latitude, 0) / validUsers.length,
        validUsers.reduce((acc, u) => acc + u.longitude, 0) / validUsers.length,
      ]
    : [0, 0];

  return (
    <div style={{ padding: '16px' }}>
      <h2>Cartes individuelles des utilisateurs</h2>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px' }}>
        {users.map(user => (
          <div
            key={user._id}
            style={{
              width: '280px',
              height: '280px',
              border: '1px solid #ccc',
              borderRadius: '8px',
              overflow: 'hidden',
              position: 'relative',
            }}
          >
            <MapContainer
              center={[user.latitude || 0, user.longitude || 0]}
              zoom={13}
              style={{ height: '70%', width: '100%' }}
              scrollWheelZoom={false}
            >
              <TileLayer
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                attribution='&copy; OpenStreetMap'
              />
              {user.latitude && user.longitude && user.gpsActive && (
                <Marker position={[user.latitude, user.longitude]}>
                  <Popup>
                    <strong>{user.name || 'Utilisateur'}</strong> <br />
                    Coordonnées: {user.latitude.toFixed(5)}, {user.longitude.toFixed(5)} <br />
                    Appareil: {user.deviceType || 'Inconnu'} <br />
                    {user.online ? 'En ligne' : 'Hors ligne'}
                  </Popup>
                </Marker>
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
            <div style={{ padding: '8px', fontSize: '14px' }}>
              <p><strong>{user.name || 'Utilisateur'}</strong></p>
              <p>Coord : {user.latitude?.toFixed(5)}, {user.longitude?.toFixed(5)}</p>
              <p>Appareil : {user.deviceType || 'Inconnu'}</p>
              <p>GPS actif : {user.gpsActive ? 'Oui' : 'Non'}</p>
              <p>Status : {user.online ? 'En ligne' : 'Hors ligne'}</p>
            </div>
          </div>
        ))}
      </div>

      <h2 style={{ marginTop: '32px' }}>Carte globale</h2>
      <div
        style={{
          width: '100%',
          height: '450px',
          border: '1px solid #ccc',
          borderRadius: '8px',
          overflow: 'hidden',
        }}
      >
        <MapContainer center={centerGlobal} zoom={2} style={{ width: '100%', height: '100%' }}>
          <TileLayer
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            attribution='&copy; OpenStreetMap'
          />
          {validUsers.map(user => (
            <Marker key={user._id} position={[user.latitude, user.longitude]}>
              <Popup>
                <strong>{user.name || 'Utilisateur'}</strong> <br />
                Coordonnées: {user.latitude.toFixed(5)}, {user.longitude.toFixed(5)} <br />
                Appareil: {user.deviceType || 'Inconnu'} <br />
                {user.online ? 'En ligne' : 'Hors ligne'}
              </Popup>
            </Marker>
          ))}
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
