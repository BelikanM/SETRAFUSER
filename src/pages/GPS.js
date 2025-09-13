import React, { useState, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

// Fixer les icônes Leaflet par défaut (problème commun avec React)
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: require('leaflet/dist/images/marker-icon-2x.png'),
  iconUrl: require('leaflet/dist/images/marker-icon.png'),
  shadowUrl: require('leaflet/dist/images/marker-shadow.png'),
});

const GPS = () => {
  const [users, setUsers] = useState([]);
  const [currentPosition, setCurrentPosition] = useState(null);
  const [error, setError] = useState(null);

  // Fonction pour fetch les positions des utilisateurs
  const fetchUsersPositions = async () => {
    try {
      const token = localStorage.getItem('token'); // Assumer que le token est stocké en localStorage après login
      if (!token) {
        setError('Token d\'authentification manquant');
        return;
      }

      const response = await fetch('/api/users/with-positions', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error('Erreur lors de la récupération des positions');
      }

      const data = await response.json();
      setUsers(data);
    } catch (err) {
      setError(err.message);
      console.error('Erreur fetch positions:', err);
    }
  };

  useEffect(() => {
    // Fetch initial
    fetchUsersPositions();

    // Polling toutes les 5 secondes pour mises à jour en "temps réel" (simulé car positions aléatoires dans le backend)
    const intervalId = setInterval(fetchUsersPositions, 5000);

    return () => clearInterval(intervalId);
  }, []);

  useEffect(() => {
    // Activer le GPS pour la position actuelle de l'utilisateur
    if (navigator.geolocation) {
      const watchId = navigator.geolocation.watchPosition(
        (position) => {
          setCurrentPosition({
            lat: position.coords.latitude,
            lng: position.coords.longitude,
          });
          // TODO: Si un endpoint pour updater la position existe, envoyer via POST ou Socket.io
          // Exemple: socket.emit('update-position', { lat, lng });
        },
        (err) => {
          setError(`Erreur GPS: ${err.message}`);
          console.error('Erreur GPS:', err);
        },
        {
          enableHighAccuracy: true,
          timeout: 5000,
          maximumAge: 0,
        }
      );

      return () => navigator.geolocation.clearWatch(watchId);
    } else {
      setError('Geolocation non supportée par ce navigateur');
    }
  }, []);

  return (
    <div style={{ height: '100vh', width: '100%' }}>
      {error && <p style={{ color: 'red' }}>{error}</p>}
      <MapContainer
        center={currentPosition || [48.8566, 2.3522]} // Centre sur position actuelle ou Paris par défaut
        zoom={13}
        style={{ height: '100%', width: '100%' }}
      >
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        />

        {/* Marqueur pour la position actuelle de l'utilisateur */}
        {currentPosition && (
          <Marker position={[currentPosition.lat, currentPosition.lng]}>
            <Popup>Votre position actuelle (GPS activé)</Popup>
          </Marker>
        )}

        {/* Marqueurs pour tous les utilisateurs inscrits */}
        {users.map((user) => (
          <Marker
            key={user._id}
            position={[user.position.lat, user.position.lng]}
          >
            <Popup>
              {user.firstName} {user.lastName} ({user.email})<br />
              Dernière mise à jour: {new Date(user.position.lastUpdate).toLocaleString()}
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  );
};

export default GPS;