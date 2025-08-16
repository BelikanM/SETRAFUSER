import React, { useState, useEffect, useRef, useContext, useCallback } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, Circle, useMap } from 'react-leaflet';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { UserContext } from '../context/UserContext';
import $ from 'jquery';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import './Gps.css';

// Configuration des icônes Leaflet
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: require('leaflet/dist/images/marker-icon-2x.png'),
  iconUrl: require('leaflet/dist/images/marker-icon.png'),
  shadowUrl: require('leaflet/dist/images/marker-shadow.png'),
});

// Couleurs prédéfinies pour les utilisateurs
const USER_COLORS = [
  '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7',
  '#DDA0DD', '#98D8C8', '#F7DC6F', '#BB8FCE', '#85C1E9',
  '#F8C471', '#82E0AA', '#F1948A', '#85C1E9', '#D2B4DE',
  '#AED6F1', '#A3E4D7', '#D5DBDB', '#FADBD8', '#D1F2EB'
];

// Positions réelles de villes françaises pour simulation
const REAL_LOCATIONS = [
  { name: 'Paris', lat: 48.8566, lng: 2.3522 },
  { name: 'Lyon', lat: 45.7640, lng: 4.8357 },
  { name: 'Marseille', lat: 43.2965, lng: 5.3698 },
  { name: 'Toulouse', lat: 43.6047, lng: 1.4442 },
  { name: 'Nice', lat: 43.7102, lng: 7.2620 },
  { name: 'Nantes', lat: 47.2184, lng: -1.5536 },
  { name: 'Strasbourg', lat: 48.5734, lng: 7.7521 },
  { name: 'Montpellier', lat: 43.6110, lng: 3.8767 },
  { name: 'Bordeaux', lat: 44.8378, lng: -0.5792 },
  { name: 'Lille', lat: 50.6292, lng: 3.0573 },
  { name: 'Rennes', lat: 48.1173, lng: -1.6778 },
  { name: 'Reims', lat: 49.2583, lng: 4.0317 },
  { name: 'Le Havre', lat: 49.4944, lng: 0.1079 },
  { name: 'Saint-Étienne', lat: 45.4397, lng: 4.3872 },
  { name: 'Toulon', lat: 43.1242, lng: 5.9280 }
];

// Stockage persistant
const persistentStorage = {
  get: (key, defaultValue = null) => {
    try {
      const item = localStorage.getItem(key);
      return item ? JSON.parse(item) : defaultValue;
    } catch {
      return defaultValue;
    }
  },
  set: (key, value) => {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (error) {
      console.warn('Erreur de sauvegarde localStorage:', error);
    }
  }
};

// Génération de position réelle pour chaque utilisateur
const assignRealLocation = (userId, userEmail) => {
  const seed = parseInt(userId.slice(-6), 16) || userEmail.charCodeAt(0) * 1000;
  const locationIndex = seed % REAL_LOCATIONS.length;
  const baseLocation = REAL_LOCATIONS[locationIndex];
  
  // Ajouter une petite variation pour éviter la superposition
  const variation = 0.01; // ~1km de variation
  const offsetLat = ((seed % 200) - 100) / 10000 * variation;
  const offsetLng = (((seed * 7) % 200) - 100) / 10000 * variation;
  
  return {
    ...baseLocation,
    lat: baseLocation.lat + offsetLat,
    lng: baseLocation.lng + offsetLng,
    accuracy: Math.random() * 30 + 10,
    speed: Math.random() * 60 + 5,
    heading: Math.random() * 360
  };
};

// Génération de trajectoire réaliste
const generateRealisticTrajectory = (baseLocation, userId, hours = 8) => {
  const trajectory = [];
  const startTime = new Date();
  startTime.setHours(8, 0, 0, 0);
  
  const seed = parseInt(userId.slice(-6), 16) || 12345;
  let currentLat = baseLocation.lat;
  let currentLng = baseLocation.lng;
  
  for (let h = 0; h < hours; h++) {
    for (let m = 0; m < 60; m += 15) { // Point toutes les 15 minutes
      const timeOffset = h * 60 + m;
      const timestamp = new Date(startTime.getTime() + timeOffset * 60000);
      
      // Mouvement réaliste basé sur des patterns
      const movement = 0.001; // ~100m de mouvement possible
      const angle = (seed + timeOffset) * 0.1;
      
      currentLat += Math.sin(angle) * movement * (Math.random() - 0.5);
      currentLng += Math.cos(angle) * movement * (Math.random() - 0.5);
      
      // Garder dans une zone raisonnable
      const maxDistance = 0.05; // ~5km max du point de base
      const distanceFromBase = Math.sqrt(
        Math.pow(currentLat - baseLocation.lat, 2) + 
        Math.pow(currentLng - baseLocation.lng, 2)
      );
      
      if (distanceFromBase > maxDistance) {
        currentLat = baseLocation.lat + (currentLat - baseLocation.lat) * 0.5;
        currentLng = baseLocation.lng + (currentLng - baseLocation.lng) * 0.5;
      }
      
      trajectory.push({
        lat: currentLat,
        lng: currentLng,
        timestamp,
        speed: Math.random() * 50 + 10,
        heading: (angle * 180 / Math.PI) % 360,
        accuracy: Math.random() * 20 + 5
      });
    }
  }
  
  return trajectory;
};

// Icône de marqueur personnalisée avec couleur
const createColoredMarkerIcon = (color, isMoving = false, heading = 0, userName = '') => {
  const initials = userName.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  
  return L.divIcon({
    html: `
      <div class="colored-marker ${isMoving ? 'moving' : ''}" style="
        --marker-color: ${color};
        transform: rotate(${heading}deg);
      ">
        <div class="marker-circle">
          <div class="marker-initials">${initials}</div>
        </div>
        <div class="marker-pulse"></div>
        ${isMoving ? '<div class="marker-trail"></div>' : ''}
        <div class="marker-arrow">▲</div>
      </div>
    `,
    className: 'colored-marker-container',
    iconSize: [50, 50],
    iconAnchor: [25, 25]
  });
};

// Contrôleur de carte
const MapController = ({ users, onMapReady }) => {
  const map = useMap();
  
  useEffect(() => {
    if (onMapReady) {
      onMapReady(map);
    }
  }, [map, onMapReady]);

  useEffect(() => {
    if (users.length > 0) {
      // Calculer les limites pour centrer sur tous les utilisateurs
      const lats = users.map(u => u.position?.lat).filter(Boolean);
      const lngs = users.map(u => u.position?.lng).filter(Boolean);
      
      if (lats.length > 0 && lngs.length > 0) {
        const bounds = [
          [Math.min(...lats), Math.min(...lngs)],
          [Math.max(...lats), Math.max(...lngs)]
        ];
        
        map.fitBounds(bounds, { padding: [50, 50] });
      }
    }
  }, [map, users]);

  return null;
};

const Gps = () => {
  const { user, token } = useContext(UserContext);
  const queryClient = useQueryClient();
  
  // États principaux
  const [selectedUsers, setSelectedUsers] = useState(new Set());
  const [showTrajectories, setShowTrajectories] = useState(true);
  const [showRealtime, setShowRealtime] = useState(true);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [controlsVisible, setControlsVisible] = useState(true);
  
  // États de données
  const [usersWithPositions, setUsersWithPositions] = useState([]);
  const [userColors, setUserColors] = useState({});
  const [trajectories, setTrajectories] = useState({});
  const [realtimePositions, setRealtimePositions] = useState({});
  const [mapInstance, setMapInstance] = useState(null);
  
  // Refs
  const realtimeIntervalRef = useRef(null);
  const playbackIntervalRef = useRef(null);
  const controlsTimeoutRef = useRef(null);

  // Récupération des utilisateurs
  const fetchUsers = useCallback(async () => {
    if (!token) throw new Error('Token manquant');

    try {
      const response = await $.ajax({
        url: 'http://localhost:5000/api/users',
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        timeout: 10000
      });

      return (Array.isArray(response) ? response : [])
        .filter(u => 
          ['employee', 'admin', 'manager'].includes(u.role) && 
          u.isVerified && 
          u.isApproved
        );
    } catch (error) {
      throw new Error('Erreur lors du chargement des utilisateurs');
    }
  }, [token]);

  const { data: users = [], isLoading, error } = useQuery({
    queryKey: ['gps-users', user?._id],
    queryFn: fetchUsers,
    enabled: !!user && !!token,
    staleTime: 30000,
    refetchInterval: 60000
  });

  // Attribution des couleurs et positions réelles
  useEffect(() => {
    if (users.length > 0) {
      const colors = {};
      const usersWithRealPositions = [];
      
      users.forEach((u, index) => {
        const color = USER_COLORS[index % USER_COLORS.length];
        colors[u._id] = color;
        
        const realLocation = assignRealLocation(u._id, u.email);
        usersWithRealPositions.push({
          ...u,
          position: {
            ...realLocation,
            timestamp: new Date(),
            isMoving: Math.random() > 0.4
          }
        });
      });
      
      setUserColors(colors);
      setUsersWithPositions(usersWithRealPositions);
      setSelectedUsers(new Set(users.map(u => u._id)));
    }
  }, [users]);

  // Génération des trajectoires
  useEffect(() => {
    if (usersWithPositions.length > 0) {
      const newTrajectories = {};
      
      usersWithPositions.forEach(user => {
        const trajectory = generateRealisticTrajectory(user.position, user._id);
        newTrajectories[user._id] = trajectory;
      });
      
      setTrajectories(newTrajectories);
    }
  }, [usersWithPositions]);

  // Mise à jour temps réel
  useEffect(() => {
    if (showRealtime && usersWithPositions.length > 0) {
      const updateRealtime = () => {
        const newPositions = {};
        
        usersWithPositions.forEach(user => {
          const basePos = user.position;
          const movement = 0.0005; // ~50m de mouvement
          const angle = (Date.now() / 10000) * (parseInt(user._id.slice(-2), 16) || 1);
          
          const newLat = basePos.lat + Math.sin(angle) * movement;
          const newLng = basePos.lng + Math.cos(angle) * movement;
          
          newPositions[user._id] = {
            lat: newLat,
            lng: newLng,
            timestamp: new Date(),
            speed: Math.random() * 50 + 10,
            heading: (angle * 180 / Math.PI) % 360,
            accuracy: Math.random() * 20 + 5,
            isMoving: Math.random() > 0.3,
            user: user
          };
        });
        
        setRealtimePositions(newPositions);
        setCurrentTime(new Date());
      };

      updateRealtime();
      realtimeIntervalRef.current = setInterval(updateRealtime, 3000);

      return () => {
        if (realtimeIntervalRef.current) {
          clearInterval(realtimeIntervalRef.current);
        }
      };
    }
  }, [showRealtime, usersWithPositions]);

  // Lecture automatique
  useEffect(() => {
    if (isPlaying) {
      playbackIntervalRef.current = setInterval(() => {
        setCurrentTime(prev => {
          const newTime = new Date(prev.getTime() + (60000 * playbackSpeed));
          const endTime = new Date();
          endTime.setHours(18, 0, 0, 0);
          
          if (newTime > endTime) {
            const startTime = new Date();
            startTime.setHours(8, 0, 0, 0);
            return startTime;
          }
          return newTime;
        });
      }, 200);
    } else {
      if (playbackIntervalRef.current) {
        clearInterval(playbackIntervalRef.current);
      }
    }

    return () => {
      if (playbackIntervalRef.current) {
        clearInterval(playbackIntervalRef.current);
      }
    };
  }, [isPlaying, playbackSpeed]);

  // Auto-masquage des contrôles
  const resetControlsTimeout = useCallback(() => {
    setControlsVisible(true);
    if (controlsTimeoutRef.current) {
      clearTimeout(controlsTimeoutRef.current);
    }
    controlsTimeoutRef.current = setTimeout(() => {
      setControlsVisible(false);
    }, 5000);
  }, []);

  useEffect(() => {
    resetControlsTimeout();
    return () => {
      if (controlsTimeoutRef.current) {
        clearTimeout(controlsTimeoutRef.current);
      }
    };
  }, [resetControlsTimeout]);

  // Filtrage des données
  const filteredUsers = usersWithPositions.filter(u => selectedUsers.has(u._id));
  const filteredRealtimePositions = Object.fromEntries(
    Object.entries(realtimePositions).filter(([userId]) => selectedUsers.has(userId))
  );

  // Obtenir les points de trajectoire à un moment donné
  const getTrajectoryAtTime = (userId, targetTime) => {
    const userTrajectory = trajectories[userId];
    if (!userTrajectory) return [];

    return userTrajectory.filter(point => 
      new Date(point.timestamp) <= targetTime
    );
  };

  if (isLoading) {
    return (
      <div className="gps-loading-fullscreen">
        <div className="loading-content">
          <div className="loading-spinner"></div>
          <p>Chargement du système GPS...</p>
          <div className="loading-details">
            Récupération des positions en temps réel...
          </div>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="gps-error-fullscreen">
        <div className="error-content">
          <i className="fas fa-lock"></i>
          <h3>Accès non autorisé</h3>
          <p>Vous devez être connecté pour accéder au système GPS.</p>
        </div>
      </div>
    );
  }

  return (
    <div 
      className="gps-fullscreen-container"
      onMouseMove={resetControlsTimeout}
      onClick={resetControlsTimeout}
    >
      {/* Carte en plein écran */}
      <div className="gps-fullscreen-map">
        <MapContainer
          center={[46.603354, 1.888334]} // Centre de la France
          zoom={6}
          className="leaflet-map-fullscreen"
          style={{ height: '100vh', width: '100vw' }}
          zoomControl={false}
          attributionControl={false}
        >
          <TileLayer
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            attribution='&copy; OpenStreetMap contributors'
          />
          
          <MapController 
            users={filteredUsers}
            onMapReady={setMapInstance}
          />

          {/* Trajectoires */}
          {showTrajectories && Object.entries(trajectories).map(([userId, trajectory]) => {
            if (!selectedUsers.has(userId)) return null;
            
            const trajectoryAtTime = isPlaying ? 
              getTrajectoryAtTime(userId, currentTime) : trajectory;
            
            if (trajectoryAtTime.length < 2) return null;

            const polylinePositions = trajectoryAtTime.map(point => [point.lat, point.lng]);
            
            return (
              <React.Fragment key={`trajectory-${userId}`}>
                <Polyline
                  positions={polylinePositions}
                  color={userColors[userId]}
                  weight={4}
                  opacity={0.8}
                  dashArray="10, 5"
                />
                
                {trajectoryAtTime.map((point, index) => (
                  <Circle
                    key={`point-${userId}-${index}`}
                    center={[point.lat, point.lng]}
                    radius={point.accuracy * 2}
                    color={userColors[userId]}
                    fillColor={userColors[userId]}
                    fillOpacity={0.1}
                    weight={1}
                    opacity={0.3}
                  />
                ))}
              </React.Fragment>
            );
          })}

          {/* Positions temps réel */}
          {showRealtime && Object.entries(filteredRealtimePositions).map(([userId, position]) => {
            const userData = usersWithPositions.find(u => u._id === userId);
            if (!userData) return null;

            return (
              <Marker
                key={`realtime-${userId}`}
                position={[position.lat, position.lng]}
                icon={createColoredMarkerIcon(
                  userColors[userId], 
                  position.isMoving, 
                  position.heading,
                  `${userData.firstName} ${userData.lastName}`
                )}
              >
                <Popup>
                  <div className="gps-popup">
                    <div className="popup-header">
                      <div 
                        className="user-avatar-circle"
                        style={{ backgroundColor: userColors[userId] }}
                      >
                        {userData.firstName[0]}{userData.lastName[0]}
                      </div>
                      <div className="popup-user-info">
                        <h4>{userData.firstName} {userData.lastName}</h4>
                        <span className={`role-tag ${userData.role}`}>{userData.role}</span>
                      </div>
                      <div className={`status-indicator ${position.isMoving ? 'moving' : 'stationary'}`}>
                        <i className={`fas ${position.isMoving ? 'fa-walking' : 'fa-pause'}`}></i>
                        {position.isMoving ? 'En mouvement' : 'Stationnaire'}
                      </div>
                    </div>
                    
                    <div className="popup-metrics">
                      <div className="metric">
                        <i className="fas fa-map-marker-alt"></i>
                        <span>Position</span>
                        <strong>{position.lat.toFixed(6)}, {position.lng.toFixed(6)}</strong>
                      </div>
                      <div className="metric">
                        <i className="fas fa-tachometer-alt"></i>
                        <span>Vitesse</span>
                        <strong>{Math.round(position.speed)} km/h</strong>
                      </div>
                      <div className="metric">
                        <i className="fas fa-compass"></i>
                        <span>Direction</span>
                        <strong>{Math.round(position.heading)}°</strong>
                      </div>
                      <div className="metric">
                        <i className="fas fa-crosshairs"></i>
                        <span>Précision</span>
                        <strong>±{Math.round(position.accuracy)}m</strong>
                      </div>
                      <div className="metric">
                        <i className="fas fa-clock"></i>
                        <span>Dernière mise à jour</span>
                        <strong>{position.timestamp.toLocaleTimeString('fr-FR')}</strong>
                      </div>
                    </div>
                  </div>
                </Popup>
              </Marker>
            );
          })}
        </MapContainer>
      </div>

      {/* Interface incrustée */}
      <div className={`gps-overlay-interface ${controlsVisible ? 'visible' : 'hidden'}`}>
        {/* Header overlay */}
        <div className="gps-overlay-header">
          <div className="header-left">
            <h1>
              <i className="fas fa-satellite-dish"></i>
              GPS Tracking System
              {showRealtime && (
                <span className="live-badge">
                  <span className="live-pulse"></span>
                  LIVE
                </span>
              )}
            </h1>
            <div className="current-time">
              <i className="fas fa-clock"></i>
              {currentTime.toLocaleString('fr-FR')}
              {isPlaying && <span className="speed-indicator">({playbackSpeed}x)</span>}
            </div>
          </div>
          
          <div className="header-stats">
            <div className="stat-box">
              <div className="stat-number">{filteredUsers.length}</div>
              <div className="stat-label">Utilisateurs</div>
            </div>
            <div className="stat-box">
              <div className="stat-number">
                {Object.values(filteredRealtimePositions).filter(p => p.isMoving).length}
              </div>
              <div className="stat-label">En mouvement</div>
            </div>
            <div className="stat-box">
              <div className="stat-number">
                {Object.values(filteredRealtimePositions).length > 0 ?
                  Math.round(
                    Object.values(filteredRealtimePositions)
                      .reduce((acc, pos) => acc + pos.speed, 0) /
                    Object.values(filteredRealtimePositions).length
                  ) : 0
                }
              </div>
              <div className="stat-label">Vitesse moy. (km/h)</div>
            </div>
          </div>
        </div>

        {/* Contrôles de lecture */}
        <div className="gps-overlay-controls">
          <div className="playback-section">
            <button 
              className={`play-btn ${isPlaying ? 'playing' : ''}`}
              onClick={() => setIsPlaying(!isPlaying)}
            >
              <i className={`fas ${isPlaying ? 'fa-pause' : 'fa-play'}`}></i>
            </button>
            
            <select 
              value={playbackSpeed} 
              onChange={(e) => setPlaybackSpeed(Number(e.target.value))}
              className="speed-select"
            >
              <option value={1}>1x</option>
              <option value={2}>2x</option>
              <option value={5}>5x</option>
              <option value={10}>10x</option>
            </select>
          </div>

          <div className="view-toggles">
            <label className="toggle-switch">
              <input
                type="checkbox"
                checked={showTrajectories}
                onChange={(e) => setShowTrajectories(e.target.checked)}
              />
              <span className="slider"></span>
              <span className="toggle-label">Trajectoires</span>
            </label>
            
            <label className="toggle-switch">
              <input
                type="checkbox"
                checked={showRealtime}
                onChange={(e) => setShowRealtime(e.target.checked)}
              />
              <span className="slider"></span>
              <span className="toggle-label">Temps réel</span>
            </label>
          </div>
        </div>

        {/* Sélecteur d'utilisateurs */}
        <div className="gps-overlay-users">
          <h3>Utilisateurs à suivre</h3>
          <div className="users-grid">
            {usersWithPositions.map(user => (
              <div 
                key={user._id} 
                className={`user-card ${selectedUsers.has(user._id) ? 'selected' : ''}`}
                onClick={() => {
                  const newSelected = new Set(selectedUsers);
                  if (selectedUsers.has(user._id)) {
                    newSelected.delete(user._id);
                  } else {
                    newSelected.add(user._id);
                  }
                  setSelectedUsers(newSelected);
                }}
              >
                <div 
                  className="user-color-dot"
                  style={{ backgroundColor: userColors[user._id] }}
                ></div>
                <div className="user-info">
                  <div className="user-name">{user.firstName} {user.lastName}</div>
                  <div className="user-role">{user.role}</div>
                  {realtimePositions[user._id] && (
                    <div className="user-status">
                      <i className={`fas ${realtimePositions[user._id].isMoving ? 'fa-walking' : 'fa-pause'}`}></i>
                      {Math.round(realtimePositions[user._id].speed)} km/h
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Instructions */}
        <div className="gps-overlay-instructions">
          <p>
            <i className="fas fa-mouse"></i>
            Bougez la souris ou cliquez pour afficher les contrôles
          </p>
        </div>
      </div>

      {/* Zoom controls */}
      <div className="gps-zoom-controls">
        <button 
          onClick={() => mapInstance?.zoomIn()}
          className="zoom-btn zoom-in"
        >
          <i className="fas fa-plus"></i>
        </button>
        <button 
          onClick={() => mapInstance?.zoomOut()}
          className="zoom-btn zoom-out"
        >
          <i className="fas fa-minus"></i>
        </button>
      </div>
    </div>
  );
};

export default Gps;

