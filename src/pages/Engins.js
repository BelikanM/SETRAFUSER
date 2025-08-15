import React, { useState, useEffect, useRef, useContext } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import { UserContext } from '../context/UserContext';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import './UserMap.css';

// Configuration des icônes Leaflet
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: require('leaflet/dist/images/marker-icon-2x.png'),
  iconUrl: require('leaflet/dist/images/marker-icon.png'),
  shadowUrl: require('leaflet/dist/images/marker-shadow.png'),
});

// Icônes personnalisées pour différents rôles
const createCustomIcon = (role, isCurrentUser = false) => {
  const colors = {
    admin: '#dc2626', // Rouge
    employee: '#2563eb', // Bleu
    manager: '#059669', // Vert
    current: '#10b981' // Vert clair pour utilisateur actuel
  };
  
  const color = isCurrentUser ? colors.current : (colors[role] || colors.employee);
  
  return L.divIcon({
    html: `
      <div style="
        background-color: ${color};
        width: ${isCurrentUser ? '35px' : '30px'};
        height: ${isCurrentUser ? '35px' : '30px'};
        border-radius: 50%;
        border: ${isCurrentUser ? '4px' : '3px'} solid white;
        box-shadow: 0 2px 8px rgba(0,0,0,0.4);
        display: flex;
        align-items: center;
        justify-content: center;
        color: white;
        font-weight: bold;
        font-size: ${isCurrentUser ? '16px' : '14px'};
        ${isCurrentUser ? 'animation: pulse-marker 2s infinite;' : ''}
      ">
        ${isCurrentUser ? '👤' : (role === 'admin' ? 'A' : role === 'manager' ? 'M' : 'E')}
      </div>
    `,
    className: 'custom-marker',
    iconSize: [isCurrentUser ? 35 : 30, isCurrentUser ? 35 : 30],
    iconAnchor: [isCurrentUser ? 17.5 : 15, isCurrentUser ? 17.5 : 15]
  });
};

// Composant pour centrer la carte
const MapCenter = ({ center, zoom = 13 }) => {
  const map = useMap();
  
  useEffect(() => {
    if (center) {
      map.setView(center, zoom);
    }
  }, [map, center, zoom]);
  
  return null;
};

const UserMap = () => {
  const { user, token } = useContext(UserContext);
  const [allUsers, setAllUsers] = useState([]);
  const [currentLocation, setCurrentLocation] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filterRole, setFilterRole] = useState('all');
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [lastUpdate, setLastUpdate] = useState(null);
  const [gpsPermission, setGpsPermission] = useState('prompt');
  const [mapCenter, setMapCenter] = useState([48.8566, 2.3522]); // Paris par défaut
  
  const intervalRef = useRef(null);
  const watchIdRef = useRef(null);

  // Fonction pour générer une position GPS simulée pour un utilisateur
  const generateUserPosition = (userId, userEmail) => {
    // Utiliser l'ID ou email comme seed pour une position cohérente
    const seed = userId ? userId.slice(-6) : userEmail.slice(0, 6);
    const hash = seed.split('').reduce((a, b) => {
      a = ((a << 5) - a) + b.charCodeAt(0);
      return a & a;
    }, 0);
    
    // Générer des coordonnées autour de Paris basées sur le hash
    const latOffset = ((hash % 100) - 50) / 1000; // ±0.05 degrés
    const lngOffset = (((hash * 7) % 100) - 50) / 1000;
    
    return {
      lat: 48.8566 + latOffset,
      lng: 2.3522 + lngOffset,
      lastUpdate: new Date(),
      accuracy: Math.floor(Math.random() * 50) + 10 // 10-60m
    };
  };

  // Fonction pour obtenir la géolocalisation de l'utilisateur actuel
  const startGeolocation = () => {
    if (!navigator.geolocation) {
      setError('Géolocalisation non supportée par ce navigateur');
      setGpsPermission('denied');
      return;
    }

    const options = {
      enableHighAccuracy: true,
      timeout: 15000,
      maximumAge: 60000 // 1 minute
    };

    // Position initiale
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const newLocation = {
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          accuracy: position.coords.accuracy,
          timestamp: new Date()
        };
        setCurrentLocation(newLocation);
        setMapCenter([newLocation.lat, newLocation.lng]);
        setGpsPermission('granted');
        console.log('Position GPS obtenue:', newLocation);
      },
      (error) => {
        console.error('Erreur géolocalisation:', error);
        setGpsPermission('denied');
        handleGeolocationError(error);
      },
      options
    );

    // Surveillance continue
    watchIdRef.current = navigator.geolocation.watchPosition(
      (position) => {
        const newLocation = {
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          accuracy: position.coords.accuracy,
          timestamp: new Date()
        };
        setCurrentLocation(newLocation);
      },
      (error) => {
        console.error('Erreur watchPosition:', error);
      },
      options
    );
  };

  const handleGeolocationError = (error) => {
    switch(error.code) {
      case error.PERMISSION_DENIED:
        setError('Géolocalisation refusée. Cliquez sur "Autoriser" pour voir votre position.');
        break;
      case error.POSITION_UNAVAILABLE:
        setError('Position indisponible. Vérifiez votre connexion.');
        break;
      case error.TIMEOUT:
        setError('Délai d\'attente dépassé pour obtenir la position.');
        break;
      default:
        setError('Erreur inconnue lors de l\'obtention de la position.');
        break;
    }
  };

  // Fonction pour récupérer tous les utilisateurs
  const fetchAllUsers = async () => {
    if (!token) {
      setError('Token d\'authentification manquant');
      return;
    }

    try {
      console.log('Récupération des utilisateurs...');
      const response = await fetch('http://localhost:5000/api/users', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        if (response.status === 401) {
          setError('Session expirée. Veuillez vous reconnecter.');
          return;
        }
        throw new Error(`Erreur HTTP: ${response.status}`);
      }

      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        const text = await response.text();
        console.error('Réponse non-JSON:', text.substring(0, 200));
        throw new Error('Réponse invalide du serveur');
      }

      const data = await response.json();
      
      // Filtrer et traiter les utilisateurs
      const processedUsers = (Array.isArray(data) ? data : [])
        .filter(u => 
          ['employee', 'admin', 'manager'].includes(u.role) && 
          u.isVerified && 
          u.isApproved
        )
        .map(u => ({
          ...u,
          position: generateUserPosition(u._id, u.email),
          isCurrentUser: user && u._id === user._id
        }));

      setAllUsers(processedUsers);
      setLastUpdate(new Date());
      setError('');
      
      console.log(`${processedUsers.length} utilisateurs chargés`);

      // Centrer la carte sur l'utilisateur actuel s'il existe
      const currentUserInList = processedUsers.find(u => u.isCurrentUser);
      if (currentUserInList && !currentLocation) {
        setMapCenter([currentUserInList.position.lat, currentUserInList.position.lng]);
      }

    } catch (err) {
      console.error('Erreur lors de la récupération:', err);
      setError(`Erreur: ${err.message}`);
    }
  };

  // Initialisation
  useEffect(() => {
    const init = async () => {
      if (!user || !token) {
        setError('Utilisateur non connecté');
        setLoading(false);
        return;
      }

      setLoading(true);
      
      // Démarrer la géolocalisation
      startGeolocation();
      
      // Récupérer les utilisateurs
      await fetchAllUsers();
      
      setLoading(false);
    };

    init();

    // Nettoyage
    return () => {
      if (watchIdRef.current) {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [user, token]);

  // Auto-refresh
  useEffect(() => {
    if (autoRefresh && user && token) {
      intervalRef.current = setInterval(() => {
        fetchAllUsers();
      }, 45000); // 45 secondes pour éviter la surcharge
    } else {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [autoRefresh, user, token]);

  // Filtrer les utilisateurs
  const filteredUsers = allUsers.filter(u => 
    filterRole === 'all' || u.role === filterRole
  );

  // Calculer le centre de la carte
  const getMapCenter = () => {
    if (currentLocation) {
      return [currentLocation.lat, currentLocation.lng];
    }
    return mapCenter;
  };

  // Fonction pour actualiser manuellement
  const handleRefresh = async () => {
    setLoading(true);
    await fetchAllUsers();
    setLoading(false);
  };

  // Fonction pour réessayer la géolocalisation
  const retryGeolocation = () => {
    setError('');
    setGpsPermission('prompt');
    startGeolocation();
  };

  // Affichage de chargement initial
  if (loading && !allUsers.length) {
    return (
      <div className="user-map-loading">
        <div className="spinner"></div>
        <p>Initialisation de la carte...</p>
        <p className="loading-detail">
          Chargement de votre position et des utilisateurs connectés...
        </p>
      </div>
    );
  }

  // Vérification de la connexion utilisateur
  if (!user) {
    return (
      <div className="user-map-error">
        <div className="error-content">
          <i className="fas fa-user-slash"></i>
          <h3>Accès non autorisé</h3>
          <p>Vous devez être connecté pour accéder à la carte des utilisateurs.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="user-map-container">
      {/* En-tête */}
      <div className="map-header">
        <div className="header-left">
          <h2>
            <i className="fas fa-map-marker-alt"></i>
            Carte des Utilisateurs
          </h2>
          <div className="user-info-brief">
            <span className="current-user">
              Connecté en tant que: <strong>{user.firstName} {user.lastName}</strong> ({user.role})
            </span>
            <span className="user-count">
              {filteredUsers.length} utilisateur{filteredUsers.length !== 1 ? 's' : ''} visible{filteredUsers.length !== 1 ? 's' : ''}
            </span>
          </div>
        </div>
        
        <div className="map-controls">
          <select 
            value={filterRole} 
            onChange={(e) => setFilterRole(e.target.value)}
            className="role-filter"
          >
            <option value="all">Tous les rôles ({allUsers.length})</option>
            <option value="admin">
              Administrateurs ({allUsers.filter(u => u.role === 'admin').length})
            </option>
            <option value="manager">
              Managers ({allUsers.filter(u => u.role === 'manager').length})
            </option>
            <option value="employee">
              Employés ({allUsers.filter(u => u.role === 'employee').length})
            </option>
          </select>

          <label className="auto-refresh-toggle">
            <input
              type="checkbox"
              checked={autoRefresh}
              onChange={(e) => setAutoRefresh(e.target.checked)}
            />
            <span>Auto-actualisation</span>
          </label>

          <button 
            onClick={handleRefresh}
            className="refresh-btn"
            disabled={loading}
            title="Actualiser maintenant"
          >
            <i className={`fas fa-sync-alt ${loading ? 'spinning' : ''}`}></i>
          </button>
        </div>
      </div>

      {/* Statut GPS */}
      <div className="gps-status">
        <div className={`gps-indicator ${gpsPermission}`}>
          <i className={`fas ${
            gpsPermission === 'granted' ? 'fa-location-arrow' : 
            gpsPermission === 'denied' ? 'fa-location-slash' : 
            'fa-spinner fa-spin'
          }`}></i>
          <span>
            {gpsPermission === 'granted' && currentLocation ? 
              `GPS actif (±${Math.round(currentLocation.accuracy)}m)` :
            gpsPermission === 'denied' ? 
              'GPS désactivé - Positions simulées' : 
              'Activation GPS en cours...'
            }
          </span>
          {gpsPermission === 'denied' && (
            <button onClick={retryGeolocation} className="retry-gps-btn">
              Réactiver GPS
            </button>
          )}
        </div>
        
        {lastUpdate && (
          <div className="last-update">
            Dernière actualisation: {lastUpdate.toLocaleTimeString()}
          </div>
        )}
      </div>

      {/* Messages d'erreur */}
      {error && (
        <div className="error-message">
          <i className="fas fa-exclamation-triangle"></i>
          <span>{error}</span>
          {error.includes('géolocalisation') && (
            <button onClick={retryGeolocation} className="retry-btn">
              Réessayer
            </button>
          )}
        </div>
      )}

      {/* Statistiques */}
      <div className="map-stats">
        <div className="stat-card">
          <i className="fas fa-users"></i>
          <div>
            <span className="stat-number">{filteredUsers.length}</span>
            <span className="stat-label">Utilisateurs visibles</span>
          </div>
        </div>
        <div className="stat-card admin">
          <i className="fas fa-crown"></i>
          <div>
            <span className="stat-number">
              {filteredUsers.filter(u => u.role === 'admin').length}
            </span>
            <span className="stat-label">Administrateurs</span>
          </div>
        </div>
        <div className="stat-card manager">
          <i className="fas fa-user-tie"></i>
          <div>
            <span className="stat-number">
              {filteredUsers.filter(u => u.role === 'manager').length}
            </span>
            <span className="stat-label">Managers</span>
          </div>
        </div>
        <div className="stat-card employee">
          <i className="fas fa-user"></i>
          <div>
            <span className="stat-number">
              {filteredUsers.filter(u => u.role === 'employee').length}
            </span>
            <span className="stat-label">Employés</span>
          </div>
        </div>
      </div>

      {/* Carte */}
      <div className="map-wrapper">
        <MapContainer
          center={getMapCenter()}
          zoom={currentLocation ? 14 : 12}
          className="user-map"
          style={{ height: '600px', width: '100%' }}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          
          <MapCenter center={getMapCenter()} zoom={currentLocation ? 14 : 12} />
          
          {/* Marqueur position réelle de l'utilisateur actuel */}
          {currentLocation && (
            <Marker
              position={[currentLocation.lat, currentLocation.lng]}
              icon={L.divIcon({
                html: `
                  <div class="real-location-marker">
                    <div class="pulse-ring"></div>
                    <div class="pulse-dot">📍</div>
                  </div>
                `,
                className: 'real-location-icon',
                iconSize: [30, 30],
                iconAnchor: [15, 15]
              })}
            >
              <Popup>
                <div className="popup-content current-location">
                  <h4>
                    <i className="fas fa-crosshairs"></i>
                    Votre position réelle (GPS)
                  </h4>
                  <div className="location-details">
                    <p>
                      <strong>Coordonnées:</strong><br/>
                      {currentLocation.lat.toFixed(6)}, {currentLocation.lng.toFixed(6)}
                    </p>
                    <p>
                      <strong>Précision:</strong> ±{Math.round(currentLocation.accuracy)} mètres
                    </p>
                    <p>
                      <strong>Dernière mise à jour:</strong><br/>
                      {currentLocation.timestamp.toLocaleString()}
                    </p>
                  </div>
                </div>
              </Popup>
            </Marker>
          )}
          
          {/* Marqueurs des utilisateurs */}
          {filteredUsers.map((userItem) => (
            <Marker
              key={userItem._id}
              position={[userItem.position.lat, userItem.position.lng]}
              icon={createCustomIcon(userItem.role, userItem.isCurrentUser)}
            >
              <Popup>
                <div className="popup-content">
                  <div className="popup-header">
                    <div className="user-avatar">
                      {userItem.profilePhoto ? (
                        <img 
                          src={`http://localhost:5000/${userItem.profilePhoto}`} 
                          alt={`${userItem.firstName} ${userItem.lastName}`}
                          onError={(e) => {
                            e.target.style.display = 'none';
                            e.target.nextSibling.style.display = 'flex';
                          }}
                        />
                      ) : null}
                      <div className="avatar-placeholder" style={{display: userItem.profilePhoto ? 'none' : 'flex'}}>
                        <i className="fas fa-user"></i>
                      </div>
                    </div>
                    <div className="user-details">
                      <h4>
                        {userItem.firstName} {userItem.lastName}
                        {userItem.isCurrentUser && (
                          <span className="current-user-badge">Vous</span>
                        )}
                      </h4>
                      <span className={`role-badge ${userItem.role}`}>
                        {userItem.role === 'admin' ? 'Administrateur' : 
                         userItem.role === 'manager' ? 'Manager' : 'Employé'}
                      </span>
                    </div>
                  </div>
                  
                  <div className="popup-details">
                    <p>
                      <i className="fas fa-envelope"></i>
                      {userItem.email}
                    </p>
                    <p>
                      <i className="fas fa-map-marker-alt"></i>
                      {userItem.position.lat.toFixed(4)}, {userItem.position.lng.toFixed(4)}
                    </p>
                    <p>
                      <i className="fas fa-info-circle"></i>
                      {userItem.isCurrentUser ? 'Position simulée (pour la démo)' : 'Position simulée'}
                    </p>
                    {userItem.nip && (
                      <p>
                        <i className="fas fa-id-card"></i>
                        NIP: {userItem.nip}
                      </p>
                    )}
                  </div>
                </div>
              </Popup>
            </Marker>
          ))}
        </MapContainer>
      </div>

      {/* Liste des utilisateurs */}
      {filteredUsers.length > 0 && (
        <div className="users-list">
          <h3>
            Utilisateurs connectés ({filteredUsers.length})
            {filterRole !== 'all' && (
              <span className="filter-info">
                - Filtré: {
                  filterRole === 'admin' ? 'Administrateurs' : 
                  filterRole === 'manager' ? 'Managers' : 'Employés'
                }
              </span>
            )}
          </h3>
          <div className="users-grid">
            {filteredUsers.map((userItem) => (
              <div key={userItem._id} className={`user-card ${userItem.role} ${userItem.isCurrentUser ? 'current-user' : ''}`}>
                <div className="user-avatar">
                  {userItem.profilePhoto ? (
                    <img 
                      src={`http://localhost:5000/${userItem.profilePhoto}`} 
                      alt={`${userItem.firstName} ${userItem.lastName}`}
                      onError={(e) => {
                        e.target.style.display = 'none';
                        e.target.nextSibling.style.display = 'flex';
                      }}
                    />
                  ) : null}
                  <div className="avatar-placeholder" style={{display: userItem.profilePhoto ? 'none' : 'flex'}}>
                    <i className="fas fa-user"></i>
                  </div>
                  <div className={`status-indicator ${userItem.role}`}></div>
                  {userItem.isCurrentUser && (
                    <div className="current-user-indicator">
                      <i className="fas fa-user-check"></i>
                    </div>
                  )}
                </div>
                
                <div className="user-info">
                  <h4>
                    {userItem.firstName} {userItem.lastName}
                    {userItem.isCurrentUser && (
                      <span className="you-badge">Vous</span>
                    )}
                  </h4>
                  <p className="user-email">{userItem.email}</p>
                  <span className={`role-tag ${userItem.role}`}>
                    {userItem.role === 'admin' ? 'Admin' : 
                     userItem.role === 'manager' ? 'Manager' : 'Employé'}
                  </span>
                  <p className="coordinates">
                    <i className="fas fa-map-marker-alt"></i>
                    {userItem.position.lat.toFixed(4)}, {userItem.position.lng.toFixed(4)}
                  </p>
                  <p className="last-update">
                    <i className="fas fa-clock"></i>
                    Position: {userItem.position.lastUpdate.toLocaleTimeString()}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Message si aucun utilisateur */}
      {filteredUsers.length === 0 && !loading && (
        <div className="no-users-message">
          <i className="fas fa-users-slash"></i>
          <h3>Aucun utilisateur trouvé</h3>
          <p>
            {filterRole === 'all' 
              ? 'Aucun utilisateur vérifié n\'est actuellement disponible.'
              : `Aucun ${
                  filterRole === 'admin' ? 'administrateur' : 
                  filterRole === 'manager' ? 'manager' : 'employé'
                } n'est actuellement disponible.`
            }
          </p>
          <button onClick={handleRefresh} className="refresh-btn">
            <i className="fas fa-sync-alt"></i>
            Actualiser
          </button>
        </div>
      )}
    </div>
  );
};

export default UserMap;

