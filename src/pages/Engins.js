import React, { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import axios from 'axios';
import L from 'leaflet';
import { db } from '../firebaseConfig';
import { doc, getDoc, updateDoc } from 'firebase/firestore';

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: require('leaflet/dist/images/marker-icon-2x.png'),
  iconUrl: require('leaflet/dist/images/marker-icon.png'),
  shadowUrl: require('leaflet/dist/images/marker-shadow.png'),
});

const haversineDistance = (coords1, coords2) => {
  const toRad = (angle) => (Math.PI / 180) * angle;
  const R = 6371; // Rayon de la Terre en km
  const dLat = toRad(coords2[0] - coords1[0]);
  const dLon = toRad(coords2[1] - coords1[1]);
  const lat1 = toRad(coords1[0]);
  const lat2 = toRad(coords2[0]);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.sin(dLon / 2) * Math.sin(dLon / 2) * Math.cos(lat1) * Math.cos(lat2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

const LocationHandler = ({ setUserInfo }) => {
  // Ce composant gère uniquement les événements de la carte si nécessaire, mais nous avons déplacé la logique de reverse geocoding
  // Retourne null car nous n'avons pas besoin de marker ici
  return null;
};

const Map = ({ user, locations, highlightedUserId }) => {
  const [userLocation, setUserLocation] = useState(null);
  const [userInfo, setUserInfo] = useState({ city: '', country: '', neighborhood: '' });
  const [connectedUsers, setConnectedUsers] = useState({});
  const [isLoadingUsers, setIsLoadingUsers] = useState(true);

  useEffect(() => {
    const fetchUserData = async (userId) => {
      const userDoc = await getDoc(doc(db, 'users', userId));
      return userDoc.exists() ? userDoc.data() : null;
    };

    const updateConnectedUsers = async () => {
      const userIds = Object.keys(locations);
      const promises = userIds.map(userId => fetchUserData(userId));
      const usersDataArray = await Promise.all(promises);
      const usersData = {};
      usersDataArray.forEach((userData, index) => {
        const userId = userIds[index];
        if (userData) {
          usersData[userId] = userData;
        }
      });
      setConnectedUsers(usersData);
      setIsLoadingUsers(false);
    };

    if (navigator.geolocation) {
      const watchId = navigator.geolocation.watchPosition(
        async (position) => {
          const { latitude, longitude } = position.coords;
          setUserLocation([latitude, longitude]);

          try {
            const response = await axios.get(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${latitude}&lon=${longitude}`);
            const { city, country, suburb, neighbourhood, quarter } = response.data.address;
            const neighborhood = suburb || neighbourhood || quarter || 'N/A';
            setUserInfo({ city: city || '', country: country || '', neighborhood });

            if (user) {
              const userDocRef = doc(db, 'users', user.uid);
              await updateDoc(userDocRef, { 
                location: [latitude, longitude], 
                city: city || '', 
                country: country || '', 
                neighborhood 
              });
            }
          } catch (error) {
            console.error("Erreur lors de la récupération de la localisation:", error);
          }
        },
        (error) => {
          console.error("Erreur lors de la récupération de la position GPS:", error);
        },
        { enableHighAccuracy: true, maximumAge: 0, timeout: 5000 }
      );

      updateConnectedUsers();

      return () => {
        navigator.geolocation.clearWatch(watchId);
      };
    } else {
      console.error("La géolocalisation n'est pas supportée par ce navigateur.");
    }
  }, [user, locations]);

  const getMarkerColor = (distance, isConnectedUser, isCloseUser) => {
    if (isCloseUser) {
      return '#FF00FF'; // Magenta pour l'utilisateur très proche avec appareil
    } else if (isConnectedUser && distance < 0.1) {
      return '#FFFF00'; // Jaune pour l'utilisateur connecté très proche
    } else if (distance < 0.1) {
      return '#FF0000'; // Rouge
    } else if (distance < 0.5) {
      return '#FFA500'; // Orange
    } else if (distance < 1) {
      return '#00FF00'; // Vert
    } else {
      return '#0000FF'; // Bleu
    }
  };

  const getEmoji = (hasDevice) => {
    return hasDevice ? '📱' : '👤';
  };

  return (
    <div style={{ height: '250px', width: '100%', marginBottom: '20px' }}>
      {userLocation ? (
        <>
          <div style={{ textAlign: 'center', marginBottom: '10px' }}>
            <h4>Ville: {userInfo.city}</h4>
            <h4>Pays: {userInfo.country}</h4>
            <h4>Quartier: {userInfo.neighborhood}</h4>
          </div>
          <MapContainer center={userLocation} zoom={15} style={{ height: '100%', width: '100%' }}>
            <TileLayer
              attribution='&copy; OpenStreetMap contributors'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            <LocationHandler setUserInfo={setUserInfo} />
            {userLocation && (
              <Marker 
                position={userLocation}
                icon={L.divIcon({
                  className: 'my-custom-pin',
                  iconAnchor: [0, 24],
                  labelAnchor: [-6, 0],
                  popupAnchor: [0, -36],
                  html: `
                    <style>
                      @keyframes pulse {
                        0% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(255, 0, 0, 0.7); }
                        70% { transform: scale(1); box-shadow: 0 0 0 10px rgba(255, 0, 0, 0); }
                        100% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(255, 0, 0, 0); }
                      }
                    </style>
                    <div style="background-color: #10b981; width: 2rem; height: 2rem; border-radius: 50%; display: flex; align-items: center; justify-content: center; color: white; font-size: 1rem; border: 2px solid white; box-shadow: 0 0 5px rgba(0,0,0,0.3); animation: pulse 2s infinite;">
                      👤
                    </div>
                  `,
                })}
              >
                <Popup>
                  Vous êtes ici<br />
                  Quartier: {userInfo.neighborhood}<br />
                  Latitude: {userLocation[0]}<br />
                  Longitude: {userLocation[1]}
                </Popup>
              </Marker>
            )}
            {Object.entries(locations).map(([userId, location]) => {
              if (user && userId === user.uid) return null; // Éviter le doublon pour l'utilisateur actuel

              const distance = haversineDistance(userLocation, location);
              const isConnectedUser = userId === highlightedUserId;
              const userData = connectedUsers[userId];
              const isCloseUser = isConnectedUser && userData?.hasDevice && distance < 0.1;
              const markerColor = getMarkerColor(distance, isConnectedUser, isCloseUser);
              const emoji = userData?.hasDevice ? getEmoji(true) : getEmoji(false);

              return (
                <Marker
                  key={userId}
                  position={location}
                  icon={L.divIcon({
                    className: 'my-custom-pin',
                    iconAnchor: [0, 24],
                    labelAnchor: [-6, 0],
                    popupAnchor: [0, -36],
                    html: `
                      <style>
                        @keyframes pulse {
                          0% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(255, 0, 0, 0.7); }
                          70% { transform: scale(1); box-shadow: 0 0 0 10px rgba(255, 0, 0, 0); }
                          100% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(255, 0, 0, 0); }
                        }
                      </style>
                      <div style="background-color: ${markerColor}; width: 2rem; height: 2rem; border-radius: 50%; display: flex; align-items: center; justify-content: center; color: white; font-size: 1rem; border: 2px solid white; box-shadow: 0 0 5px rgba(0,0,0,0.3); ${isConnectedUser ? 'animation: pulse 2s infinite;' : ''}">
                        ${emoji}
                      </div>
                    `,
                  })}
                >
                  <Popup>
                    {userData ? (
                      <>
                        <strong>{userData.displayName}</strong><br />
                        Quartier: {userData.neighborhood || 'Inconnu'}<br />
                        Latitude: {location[0]}<br />
                        Longitude: {location[1]}<br />
                        Distance: {distance.toFixed(2)} km<br />
                        <small>Utilisateur connecté</small>
                        {isCloseUser && <small> - Très proche avec appareil</small>}
                      </>
                    ) : (
                      <>
                        <strong>Utilisateur suivi</strong><br />
                        Latitude: {location[0]}<br />
                        Longitude: {location[1]}<br />
                        Distance: {distance.toFixed(2)} km
                      </>
                    )}
                  </Popup>
                </Marker>
              );
            })}
          </MapContainer>

          {/* Liste des utilisateurs inspirée de l'exemple pour un meilleur affichage */}
          {!isLoadingUsers && Object.keys(connectedUsers).length > 0 && (
            <div className="users-list" style={{ marginTop: '20px' }}>
              <h3>Utilisateurs connectés ({Object.keys(connectedUsers).length})</h3>
              <div className="users-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: '10px' }}>
                {Object.entries(connectedUsers).map(([userId, userData]) => {
                  const location = locations[userId];
                  if (!location) return null;
                  const distance = haversineDistance(userLocation, location);
                  return (
                    <div key={userId} className="user-card" style={{ border: '1px solid #ccc', padding: '10px', borderRadius: '5px' }}>
                      <h4>{userData.displayName}</h4>
                      <p>Quartier: {userData.neighborhood || 'Inconnu'}</p>
                      <p>Distance: {distance.toFixed(2)} km</p>
                      {userData.hasDevice && <p>Avec appareil</p>}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </>
      ) : (
        <p>Chargement de la localisation...</p>
      )}
    </div>
  );
};

export default Map;