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

// Couleurs pour les utilisateurs
const USER_COLORS = [
  '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7',
  '#DDA0DD', '#98D8C8', '#F7DC6F', '#BB8FCE', '#85C1E9',
  '#F8C471', '#82E0AA', '#F1948A', '#85C1E9', '#D2B4DE'
];

// Clés de stockage pour la persistence
const STORAGE_KEYS = {
  GPS_POSITIONS: 'real_gps_positions',
  GPS_TRACKS: 'real_gps_tracks',
  MAP_CENTER: 'real_gps_map_center',
  MAP_ZOOM: 'real_gps_map_zoom',
  USER_PERMISSIONS: 'real_gps_permissions'
};

// Utilitaires de stockage persistant
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
      console.warn('Erreur sauvegarde:', error);
    }
  }
};

// API de géocodage inverse pour les adresses réelles
const getRealAddress = async (lat, lng) => {
  try {
    const response = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`,
      {
        headers: {
          'User-Agent': 'RealTimeGPS-App/1.0'
        }
      }
    );
    
    if (!response.ok) throw new Error('Erreur géocodage');
    
    const data = await response.json();
    const address = data.address || {};
    
    return {
      fullAddress: data.display_name || `${lat.toFixed(6)}, ${lng.toFixed(6)}`,
      street: [address.house_number, address.road].filter(Boolean).join(' '),
      district: address.suburb || address.neighbourhood || address.quarter || '',
      city: address.city || address.town || address.village || '',
      postal_code: address.postcode || '',
      country: address.country || 'France',
      amenity: address.amenity || address.shop || address.office || null
    };
  } catch (error) {
    console.warn('Erreur géocodage:', error);
    return {
      fullAddress: `Position ${lat.toFixed(6)}, ${lng.toFixed(6)}`,
      street: '',
      district: '',
      city: 'Localisation GPS',
      postal_code: '',
      country: 'France',
      amenity: null
    };
  }
};

// Formatage sécurisé des dates
const formatDateTime = (date) => {
  try {
    return new Date(date).toLocaleString('fr-FR', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  } catch {
    return new Date().toLocaleString('fr-FR');
  }
};

// Icône de marqueur GPS réel avancée
const createRealGPSIcon = (color, userName, isMoving = false, heading = 0, accuracy = 0) => {
  const initials = userName.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  const size = accuracy > 50 ? 40 : accuracy > 20 ? 50 : 60;
  
  return L.divIcon({
    html: `
      <div class="real-gps-marker ${isMoving ? 'moving' : 'stationary'}" style="
        --marker-color: ${color};
        --marker-size: ${size}px;
        transform: rotate(${heading}deg);
      ">
        <div class="gps-accuracy-ring" style="width: ${Math.max(accuracy * 2, 30)}px; height: ${Math.max(accuracy * 2, 30)}px;"></div>
        <div class="gps-pulse-ring"></div>
        <div class="gps-main-marker">
          <div class="gps-signal-indicator">
            <div class="signal-wave wave1"></div>
            <div class="signal-wave wave2"></div>
            <div class="signal-wave wave3"></div>
          </div>
          <div class="gps-user-initials">${initials}</div>
          <div class="gps-real-badge">
            <i class="fas fa-satellite"></i>
          </div>
        </div>
        <div class="gps-direction-arrow" style="opacity: ${isMoving ? 1 : 0};">
          <i class="fas fa-location-arrow"></i>
        </div>
        <div class="gps-accuracy-text">±${Math.round(accuracy)}m</div>
      </div>
    `,
    className: 'real-gps-container',
    iconSize: [size, size],
    iconAnchor: [size/2, size/2]
  });
};

// Contrôleur de carte intelligent
const IntelligentMapController = ({ 
  realTimePositions, 
  autoCenter, 
  selectedUsers, 
  onMapReady,
  trackingMode 
}) => {
  const map = useMap();
  const lastBoundsRef = useRef(null);
  
  useEffect(() => {
    if (onMapReady) onMapReady(map);
  }, [map, onMapReady]);
  
  // Auto-centrage intelligent
  useEffect(() => {
    if (!autoCenter || !realTimePositions || Object.keys(realTimePositions).length === 0) return;
    
    const filteredPositions = Object.entries(realTimePositions)
      .filter(([userId]) => selectedUsers.has(userId))
      .map(([_, position]) => position);
    
    if (filteredPositions.length === 0) return;
    
    // Si un seul utilisateur, centrer avec zoom approprié
    if (filteredPositions.length === 1) {
      const position = filteredPositions[0];
      const zoom = trackingMode === 'close' ? 18 : trackingMode === 'normal' ? 15 : 13;
      map.setView([position.lat, position.lng], zoom, { animate: true, duration: 1.5 });
      return;
    }
    
    // Pour plusieurs utilisateurs, calculer les bornes optimales
    const lats = filteredPositions.map(p => p.lat);
    const lngs = filteredPositions.map(p => p.lng);
    
    const bounds = [
      [Math.min(...lats), Math.min(...lngs)],
      [Math.max(...lats), Math.max(...lngs)]
    ];
    
    // Éviter les re-centrages trop fréquents
    const boundsKey = bounds.flat().map(n => n.toFixed(4)).join(',');
    if (lastBoundsRef.current === boundsKey) return;
    lastBoundsRef.current = boundsKey;
    
    map.fitBounds(bounds, { 
      padding: [50, 50],
      animate: true,
      duration: 2
    });
  }, [map, realTimePositions, autoCenter, selectedUsers, trackingMode]);
  
  return null;
};

// Composant principal GPS
const Gps = () => {
  const { user, token } = useContext(UserContext);
  const queryClient = useQueryClient();
  
  // États principaux
  const [selectedUsers, setSelectedUsers] = useState(new Set());
  const [showTracks, setShowTracks] = useState(true);
  const [autoCenter, setAutoCenter] = useState(true);
  const [trackingMode, setTrackingMode] = useState('normal'); // close, normal, wide
  const [controlsVisible, setControlsVisible] = useState(true);
  
  // États GPS
  const [realTimePositions, setRealTimePositions] = useState({});
  const [gpsPermissions, setGpsPermissions] = useState({});
  const [userTracks, setUserTracks] = useState({});
  const [gpsErrors, setGpsErrors] = useState({});
  const [connectionStatus, setConnectionStatus] = useState('connecting');
  
  // États UI
  const [userColors, setUserColors] = useState({});
  const [mapInstance, setMapInstance] = useState(null);
  const [currentUser, setCurrentUser] = useState(null);
  
  // Refs pour les watchers GPS
  const watchersRef = useRef({});
  const addressCacheRef = useRef({});
  const lastUpdateRef = useRef({});
  const controlsTimeoutRef = useRef(null);

  // Récupération des utilisateurs depuis le serveur
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

      const validUsers = (Array.isArray(response) ? response : [])
        .filter(u => 
          ['employee', 'admin', 'manager'].includes(u.role) && 
          u.isVerified && 
          u.isApproved
        );

      return validUsers;
    } catch (error) {
      console.error('Erreur chargement utilisateurs:', error);
      throw new Error('Impossible de charger les utilisateurs');
    }
  }, [token]);

  // React Query pour les utilisateurs
  const { data: users = [], isLoading, error } = useQuery({
    queryKey: ['real-gps-users', user?._id],
    queryFn: fetchUsers,
    enabled: !!user && !!token,
    staleTime: 30000,
    refetchInterval: 60000,
    retry: 3
  });

  // Initialisation GPS pour un utilisateur
  const initializeUserGPS = useCallback(async (targetUser) => {
    if (!navigator.geolocation) {
      setGpsErrors(prev => ({
        ...prev,
        [targetUser._id]: 'Géolocalisation non supportée'
      }));
      return;
    }

    const options = {
      enableHighAccuracy: true,
      timeout: 5000, // Timeout réduit pour plus de réactivité
      maximumAge: 1000 // Cache très court pour des données fraîches
    };

    const onSuccess = async (position) => {
      const coords = position.coords;
      const timestamp = new Date();
      
      // Éviter les mises à jour trop fréquentes (< 1 seconde)
      const lastUpdate = lastUpdateRef.current[targetUser._id];
      if (lastUpdate && (timestamp - lastUpdate) < 1000) return;
      lastUpdateRef.current[targetUser._id] = timestamp;
      
      // Calculer la vitesse et la direction
      const prevPosition = realTimePositions[targetUser._id];
      let speed = coords.speed || 0;
      let heading = coords.heading || 0;
      let isMoving = speed > 1; // Plus de 1 km/h = en mouvement
      
      if (prevPosition && !coords.speed) {
        const timeDiff = (timestamp - new Date(prevPosition.timestamp)) / 1000;
        if (timeDiff > 0) {
          const distance = calculateDistance(
            prevPosition.lat, prevPosition.lng,
            coords.latitude, coords.longitude
          );
          speed = (distance / timeDiff) * 3.6; // Convert m/s to km/h
          isMoving = speed > 1;
          
          if (distance > 5) { // Si déplacement significatif
            heading = calculateBearing(
              prevPosition.lat, prevPosition.lng,
              coords.latitude, coords.longitude
            );
          }
        }
      }

      // Géocodage inversé avec cache
      const cacheKey = `${coords.latitude.toFixed(4)}_${coords.longitude.toFixed(4)}`;
      let address = addressCacheRef.current[cacheKey];
      
      if (!address) {
        try {
          address = await getRealAddress(coords.latitude, coords.longitude);
          addressCacheRef.current[cacheKey] = address;
        } catch (error) {
          address = {
            fullAddress: `Position GPS ${coords.latitude.toFixed(6)}, ${coords.longitude.toFixed(6)}`,
            city: 'Localisation en cours...'
          };
        }
      }

      const newPosition = {
        lat: coords.latitude,
        lng: coords.longitude,
        accuracy: coords.accuracy,
        altitude: coords.altitude,
        speed: Math.max(0, speed),
        heading: heading,
        timestamp: timestamp.toISOString(),
        isMoving: isMoving,
        address: address,
        user: targetUser
      };

      // Mettre à jour la position en temps réel
      setRealTimePositions(prev => ({
        ...prev,
        [targetUser._id]: newPosition
      }));

      // Ajouter au track de l'utilisateur
      setUserTracks(prev => {
        const currentTrack = prev[targetUser._id] || [];
        const newTrack = [...currentTrack, newPosition].slice(-100); // Garder 100 derniers points
        
        // Sauvegarder en localStorage
        persistentStorage.set(STORAGE_KEYS.GPS_TRACKS, {
          ...prev,
          [targetUser._id]: newTrack
        });
        
        return {
          ...prev,
          [targetUser._id]: newTrack
        };
      });

      // Supprimer l'erreur s'il y en avait une
      setGpsErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[targetUser._id];
        return newErrors;
      });

      setGpsPermissions(prev => ({
        ...prev,
        [targetUser._id]: 'granted'
      }));
    };

    const onError = (error) => {
      console.error(`Erreur GPS pour ${targetUser.firstName}:`, error);
      
      let errorMessage = 'Erreur GPS inconnue';
      switch(error.code) {
        case error.PERMISSION_DENIED:
          errorMessage = 'Permission GPS refusée';
          setGpsPermissions(prev => ({
            ...prev,
            [targetUser._id]: 'denied'
          }));
          break;
        case error.POSITION_UNAVAILABLE:
          errorMessage = 'Position GPS indisponible';
          break;
        case error.TIMEOUT:
          errorMessage = 'Timeout GPS - Nouvelle tentative...';
          // Ne pas considérer le timeout comme une erreur fatale
          setTimeout(() => initializeUserGPS(targetUser), 2000);
          return;
        default:
          errorMessage = `Erreur GPS ${error.code}`;
          break;
      }
      
      setGpsErrors(prev => ({
        ...prev,
        [targetUser._id]: errorMessage
      }));
    };

    // Arrêter le watcher précédent s'il existe
    if (watchersRef.current[targetUser._id]) {
      navigator.geolocation.clearWatch(watchersRef.current[targetUser._id]);
    }

    // Position initiale
    navigator.geolocation.getCurrentPosition(onSuccess, onError, options);

    // Surveillance continue
    watchersRef.current[targetUser._id] = navigator.geolocation.watchPosition(
      onSuccess, 
      onError, 
      options
    );

  }, [realTimePositions]);

  // Calcul de distance entre deux points GPS
  const calculateDistance = (lat1, lng1, lat2, lng2) => {
    const R = 6371e3; // Rayon de la Terre en mètres
    const φ1 = lat1 * Math.PI/180;
    const φ2 = lat2 * Math.PI/180;
    const Δφ = (lat2-lat1) * Math.PI/180;
    const Δλ = (lng2-lng1) * Math.PI/180;

    const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
              Math.cos(φ1) * Math.cos(φ2) *
              Math.sin(Δλ/2) * Math.sin(Δλ/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

    return R * c;
  };

  // Calcul de l'angle de direction
  const calculateBearing = (lat1, lng1, lat2, lng2) => {
    const φ1 = lat1 * Math.PI/180;
    const φ2 = lat2 * Math.PI/180;
    const Δλ = (lng2-lng1) * Math.PI/180;

    const y = Math.sin(Δλ) * Math.cos(φ2);
    const x = Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);

    const θ = Math.atan2(y, x);
    return (θ * 180/Math.PI + 360) % 360;
  };

  // Attribution des couleurs aux utilisateurs
  useEffect(() => {
    if (users.length > 0) {
      const colors = {};
      users.forEach((u, index) => {
        colors[u._id] = USER_COLORS[index % USER_COLORS.length];
      });
      setUserColors(colors);
      setSelectedUsers(new Set(users.map(u => u._id)));
    }
  }, [users]);

  // Initialisation GPS pour tous les utilisateurs
  useEffect(() => {
    if (users.length > 0 && user) {
      setConnectionStatus('initializing');
      
      // Identifier l'utilisateur actuel
      const current = users.find(u => u._id === user._id);
      if (current) {
        setCurrentUser(current);
      }

      // Initialiser GPS pour tous les utilisateurs (en réalité, seul l'utilisateur actuel aura sa vraie position)
      users.forEach(targetUser => {
        if (targetUser._id === user._id) {
          // GPS réel pour l'utilisateur actuel
          initializeUserGPS(targetUser);
        }
      });

      setConnectionStatus('connected');
    }

    // Nettoyage
    return () => {
      Object.values(watchersRef.current).forEach(watchId => {
        if (watchId) {
          navigator.geolocation.clearWatch(watchId);
        }
      });
      watchersRef.current = {};
    };
  }, [users, user, initializeUserGPS]);

  // Auto-masquage des contrôles
  const resetControlsTimeout = useCallback(() => {
    setControlsVisible(true);
    if (controlsTimeoutRef.current) {
      clearTimeout(controlsTimeoutRef.current);
    }
    controlsTimeoutRef.current = setTimeout(() => {
      setControlsVisible(false);
    }, 10000); // 10 secondes
  }, []);

  useEffect(() => {
    resetControlsTimeout();
    return () => {
      if (controlsTimeoutRef.current) {
        clearTimeout(controlsTimeoutRef.current);
      }
    };
  }, [resetControlsTimeout]);

  // Gestion des raccourcis clavier
  useEffect(() => {
    const handleKeyPress = (event) => {
      switch(event.code) {
        case 'Space':
          event.preventDefault();
          setAutoCenter(prev => !prev);
          break;
        case 'KeyT':
          if (event.ctrlKey) {
            event.preventDefault();
            setShowTracks(prev => !prev);
          }
          break;
        case 'KeyC':
          if (event.ctrlKey) {
            event.preventDefault();
            setControlsVisible(prev => !prev);
          }
          break;
        case 'Escape':
          setControlsVisible(false);
          break;
        default:
          break;
      }
    };

    document.addEventListener('keydown', handleKeyPress);
    return () => document.removeEventListener('keydown', handleKeyPress);
  }, []);

  // Retry GPS pour un utilisateur
  const retryUserGPS = useCallback((targetUser) => {
    setGpsErrors(prev => {
      const newErrors = { ...prev };
      delete newErrors[targetUser._id];
      return newErrors;
    });
    initializeUserGPS(targetUser);
  }, [initializeUserGPS]);

  // Filtrage des positions actives
  const activePositions = Object.fromEntries(
    Object.entries(realTimePositions).filter(([userId]) => selectedUsers.has(userId))
  );

  // Statistiques en temps réel
  const stats = {
    totalUsers: users.length,
    activeGPS: Object.keys(realTimePositions).length,
    moving: Object.values(activePositions).filter(p => p.isMoving).length,
    avgAccuracy: Object.values(activePositions).length > 0 
      ? Math.round(Object.values(activePositions).reduce((sum, p) => sum + p.accuracy, 0) / Object.values(activePositions).length)
      : 0
  };

  if (isLoading) {
    return (
      <div className="gps-loading-screen">
        <div className="loading-animation">
          <div className="gps-satellite-icon">
            <i className="fas fa-satellite-dish"></i>
          </div>
          <div className="loading-text">
            <h2>Initialisation GPS</h2>
            <p>Connexion aux satellites en cours...</p>
            <div className="loading-progress">
              <div className="progress-bar"></div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="gps-error-screen">
        <div className="error-content">
          <i className="fas fa-user-lock"></i>
          <h3>Accès GPS Restreint</h3>
          <p>Authentification requise pour accéder au système GPS.</p>
        </div>
      </div>
    );
  }

  return (
    <div 
      className="gps-realtime-container"
      onMouseMove={resetControlsTimeout}
      onClick={resetControlsTimeout}
    >
      {/* Carte GPS en plein écran */}
      <div className="gps-realtime-map">
        <MapContainer
          center={[46.603354, 1.888334]}
          zoom={6}
          className="leaflet-realtime-map"
          style={{ height: '100vh', width: '100vw' }}
          zoomControl={false}
          attributionControl={false}
          preferCanvas={true}
          updateWhenIdle={true}
          updateWhenZooming={false}
        >
          <TileLayer
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            attribution='&copy; OpenStreetMap contributors'
            updateWhenIdle={true}
            updateWhenZooming={false}
            keepBuffer={4}
          />
          
          <IntelligentMapController 
            realTimePositions={activePositions}
            autoCenter={autoCenter}
            selectedUsers={selectedUsers}
            onMapReady={setMapInstance}
            trackingMode={trackingMode}
          />

          {/* Tracks GPS des utilisateurs */}
          {showTracks && Object.entries(userTracks).map(([userId, track]) => {
            if (!selectedUsers.has(userId) || track.length < 2) return null;
            
            const trackPoints = track.map(point => [point.lat, point.lng]);
            
            return (
              <Polyline
                key={`track-${userId}`}
                positions={trackPoints}
                color={userColors[userId]}
                weight={4}
                opacity={0.8}
                smoothFactor={1}
                className="gps-track-line"
              />
            );
          })}

          {/* Marqueurs GPS temps réel */}
          {Object.entries(activePositions).map(([userId, position]) => {
            const userData = users.find(u => u._id === userId);
            if (!userData) return null;

            return (
              <React.Fragment key={`gps-${userId}`}>
                {/* Cercle de précision */}
                <Circle
                  center={[position.lat, position.lng]}
                  radius={position.accuracy}
                  color={userColors[userId]}
                  fillColor={userColors[userId]}
                  fillOpacity={0.1}
                  weight={2}
                  opacity={0.6}
                />
                
                {/* Marqueur principal */}
                <Marker
                  position={[position.lat, position.lng]}
                  icon={createRealGPSIcon(
                    userColors[userId],
                    `${userData.firstName} ${userData.lastName}`,
                    position.isMoving,
                    position.heading,
                    position.accuracy
                  )}
                  zIndexOffset={position.user._id === user?._id ? 1000 : 100}
                >
                  <Popup maxWidth={500} className="gps-realtime-popup">
                    <div className="popup-realtime-content">
                      <div className="popup-header-realtime">
                        <div 
                          className="user-avatar-realtime"
                          style={{ backgroundColor: userColors[userId] }}
                        >
                          {userData.firstName[0]}{userData.lastName[0]}
                        </div>
                        <div className="popup-user-info">
                          <h4>
                            {userData.firstName} {userData.lastName}
                            {userData._id === user?._id && (
                              <span className="current-user-tag">Vous</span>
                            )}
                          </h4>
                          <span className={`role-tag ${userData.role}`}>
                            {userData.role}
                          </span>
                          <div className={`movement-status ${position.isMoving ? 'moving' : 'stationary'}`}>
                            <i className={`fas ${position.isMoving ? 'fa-walking' : 'fa-map-pin'}`}></i>
                            {position.isMoving ? 'En déplacement' : 'Stationnaire'}
                          </div>
                        </div>
                        <div className="gps-quality-indicator">
                          <div className={`signal-quality ${
                            position.accuracy < 5 ? 'excellent' :
                            position.accuracy < 15 ? 'good' :
                            position.accuracy < 30 ? 'fair' : 'poor'
                          }`}>
                            <i className="fas fa-satellite"></i>
                            <span>GPS</span>
                          </div>
                        </div>
                      </div>
                      
                      <div className="location-info-realtime">
                        <div className="address-section">
                          <h5><i className="fas fa-map-marker-alt"></i> Localisation GPS</h5>
                          <div className="address-details">
                            <p className="full-address">{position.address.fullAddress}</p>
                            {position.address.street && (
                              <p className="street">{position.address.street}</p>
                            )}
                            <p className="city-district">
                              {position.address.city}
                              {position.address.district && `, ${position.address.district}`}
                            </p>
                            {position.address.amenity && (
                              <p className="amenity">
                                <i className="fas fa-info-circle"></i>
                                {position.address.amenity}
                              </p>
                            )}
                          </div>
                        </div>
                        
                        <div className="gps-metrics-realtime">
                          <h5><i className="fas fa-satellite"></i> Données GPS</h5>
                          <div className="metrics-grid-realtime">
                            <div className="metric-item">
                              <i className="fas fa-crosshairs"></i>
                              <span className="metric-label">Précision</span>
                              <span className="metric-value">±{Math.round(position.accuracy)}m</span>
                            </div>
                            <div className="metric-item">
                              <i className="fas fa-tachometer-alt"></i>
                              <span className="metric-label">Vitesse</span>
                              <span className="metric-value">{Math.round(position.speed)} km/h</span>
                            </div>
                            <div className="metric-item">
                              <i className="fas fa-compass"></i>
                              <span className="metric-label">Direction</span>
                              <span className="metric-value">{Math.round(position.heading)}°</span>
                            </div>
                            {position.altitude && (
                              <div className="metric-item">
                                <i className="fas fa-mountain"></i>
                                <span className="metric-label">Altitude</span>
                                <span className="metric-value">{Math.round(position.altitude)}m</span>
                              </div>
                            )}
                            <div className="metric-item">
                              <i className="fas fa-clock"></i>
                              <span className="metric-label">Dernière MAJ</span>
                              <span className="metric-value">{formatDateTime(position.timestamp)}</span>
                            </div>
                            <div className="metric-item">
                              <i className="fas fa-map"></i>
                              <span className="metric-label">Coordonnées</span>
                              <span className="metric-value coordinates-text">
                                {position.lat.toFixed(6)}, {position.lng.toFixed(6)}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </Popup>
                </Marker>
              </React.Fragment>
            );
          })}
        </MapContainer>
      </div>

      {/* Interface overlay avec contrôles */}
      <div className={`gps-interface-overlay ${controlsVisible ? 'visible' : 'hidden'}`}>
        {/* Header avec statut GPS */}
        <div className="gps-header-realtime">
          <div className="header-info">
            <h1>
              <i className="fas fa-satellite"></i>
              GPS Temps Réel
              <div className="live-indicator">
                <span className="live-dot"></span>
                LIVE
              </div>
            </h1>
            <div className="connection-status">
              <div className={`status-indicator ${connectionStatus}`}>
                <div className="status-dot"></div>
                <span>
                  {connectionStatus === 'connected' ? 'GPS Connecté' :
                   connectionStatus === 'initializing' ? 'Initialisation...' :
                   'Connexion GPS'}
                </span>
              </div>
              <div className="current-time">
                {new Date().toLocaleTimeString('fr-FR')}
              </div>
            </div>
          </div>
          
          <div className="stats-realtime">
            <div className="stat-card">
              <div className="stat-icon"><i className="fas fa-users"></i></div>
              <div className="stat-content">
                <div className="stat-number">{stats.activeGPS}</div>
                <div className="stat-label">GPS Actif</div>
              </div>
            </div>
            <div className="stat-card">
              <div className="stat-icon"><i className="fas fa-walking"></i></div>
              <div className="stat-content">
                <div className="stat-number">{stats.moving}</div>
                <div className="stat-label">En mouvement</div>
              </div>
            </div>
            <div className="stat-card">
              <div className="stat-icon"><i class="fas fa-crosshairs"></i></div>
              <div className="stat-content">
                <div className="stat-number">±{stats.avgAccuracy}m</div>
                <div className="stat-label">Précision moy.</div>
              </div>
            </div>
          </div>
        </div>

        {/* Contrôles de carte */}
        <div className="gps-map-controls">
          <div className="controls-section">
            <label className="control-toggle">
              <input
                type="checkbox"
                checked={autoCenter}
                onChange={(e) => setAutoCenter(e.target.checked)}
              />
              <span className="toggle-slider"></span>
              <span className="toggle-label">
                <i className="fas fa-crosshairs"></i>
                Auto-centrage
              </span>
            </label>
            
            <label className="control-toggle">
              <input
                type="checkbox"
                checked={showTracks}
                onChange={(e) => setShowTracks(e.target.checked)}
              />
              <span className="toggle-slider"></span>
              <span className="toggle-label">
                <i className="fas fa-route"></i>
                Trajectoires
              </span>
            </label>
            
            <select 
              value={trackingMode} 
              onChange={(e) => setTrackingMode(e.target.value)}
              className="tracking-mode-select"
            >
              <option value="close">Vue rapprochée</option>
              <option value="normal">Vue normale</option>
              <option value="wide">Vue étendue</option>
            </select>
          </div>
        </div>

        {/* Liste des utilisateurs */}
        <div className="users-panel-realtime">
          <div className="panel-header">
            <h3>
              <i className="fas fa-satellite-dish"></i>
              Utilisateurs GPS ({Object.keys(activePositions).length})
            </h3>
          </div>
          
          <div className="users-list-realtime">
            {users.map(userData => {
              const position = realTimePositions[userData._id];
              const error = gpsErrors[userData._id];
              const permission = gpsPermissions[userData._id];
              const isCurrentUser = userData._id === user?._id;
              
              return (
                <div 
                  key={userData._id}
                  className={`user-item-realtime ${selectedUsers.has(userData._id) ? 'selected' : ''} ${isCurrentUser ? 'current' : ''}`}
                  onClick={() => {
                    const newSelected = new Set(selectedUsers);
                    if (selectedUsers.has(userData._id)) {
                      newSelected.delete(userData._id);
                    } else {
                      newSelected.add(userData._id);
                    }
                    setSelectedUsers(newSelected);
                  }}
                >
                  <div className="user-avatar-item" style={{ backgroundColor: userColors[userData._id] }}>
                    {userData.firstName[0]}{userData.lastName[0]}
                    {position && (
                      <div className={`activity-indicator ${position.isMoving ? 'moving' : 'stationary'}`}>
                        <i className={`fas ${position.isMoving ? 'fa-walking' : 'fa-map-pin'}`}></i>
                      </div>
                    )}
                  </div>
                  
                  <div className="user-details-realtime">
                    <div className="user-name">
                      {userData.firstName} {userData.lastName}
                      {isCurrentUser && <span className="you-badge">Vous</span>}
                    </div>
                    <div className="user-role">{userData.role}</div>
                    
                    {position ? (
                      <div className="position-summary">
                        <div className="location-text">
                          <i className="fas fa-map-marker-alt"></i>
                          {position.address.city || 'Localisation...'}
                        </div>
                        <div className="gps-quality">
                          <i className="fas fa-satellite"></i>
                          ±{Math.round(position.accuracy)}m
                        </div>
                        <div className="last-update">
                          {formatDateTime(position.timestamp)}
                        </div>
                      </div>
                    ) : error ? (
                      <div className="error-status">
                        <i className="fas fa-exclamation-triangle"></i>
                        {error}
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            retryUserGPS(userData);
                          }}
                          className="retry-btn-small"
                        >
                          <i className="fas fa-redo"></i>
                        </button>
                      </div>
                    ) : (
                      <div className="loading-status">
                                                <i className="fas fa-spinner fa-spin"></i>
                        Recherche GPS...
                      </div>
                    )}
                  </div>
                  
                  <div className="user-status-indicators">
                    <div className={`gps-status-icon ${permission || 'unknown'}`}>
                      <i className={`fas ${
                        permission === 'granted' ? 'fa-satellite' :
                        permission === 'denied' ? 'fa-times-circle' :
                        'fa-clock'
                      }`}></i>
                    </div>
                    {position && (
                      <div className={`signal-strength ${
                        position.accuracy < 5 ? 'excellent' :
                        position.accuracy < 15 ? 'good' :
                        position.accuracy < 30 ? 'fair' : 'poor'
                      }`}>
                        <div className="signal-bar bar1"></div>
                        <div className="signal-bar bar2"></div>
                        <div className="signal-bar bar3"></div>
                        <div className="signal-bar bar4"></div>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Légende et aide */}
        <div className="gps-legend-help">
          <div className="legend-content">
            <h4><i className="fas fa-info-circle"></i> Légende</h4>
            <div className="legend-items">
              <div className="legend-item">
                <div className="legend-icon gps-active"></div>
                <span>GPS Actif</span>
              </div>
              <div className="legend-item">
                <div className="legend-icon gps-moving"></div>
                <span>En mouvement</span>
              </div>
              <div className="legend-item">
                <div className="legend-icon gps-stationary"></div>
                <span>Stationnaire</span>
              </div>
              <div className="legend-item">
                <div className="legend-icon gps-track"></div>
                <span>Trajectoire</span>
              </div>
            </div>
          </div>
          
          <div className="help-content">
            <h4><i className="fas fa-keyboard"></i> Raccourcis</h4>
            <div className="shortcut-item">
              <kbd>Espace</kbd> <span>Auto-centrage on/off</span>
            </div>
            <div className="shortcut-item">
              <kbd>Ctrl+T</kbd> <span>Trajectoires on/off</span>
            </div>
            <div className="shortcut-item">
              <kbd>Ctrl+C</kbd> <span>Contrôles on/off</span>
            </div>
            <div className="shortcut-item">
              <kbd>Échap</kbd> <span>Masquer contrôles</span>
            </div>
          </div>
        </div>
      </div>

      {/* Contrôles de zoom flottants */}
      <div className="floating-zoom-controls">
        <button 
          onClick={() => mapInstance?.zoomIn()}
          className="zoom-btn zoom-in"
          title="Zoom avant"
        >
          <i className="fas fa-plus"></i>
        </button>
        <button 
          onClick={() => mapInstance?.zoomOut()}
          className="zoom-btn zoom-out"
          title="Zoom arrière"
        >
          <i className="fas fa-minus"></i>
        </button>
        <button 
          onClick={() => {
            if (Object.keys(activePositions).length > 0) {
              const positions = Object.values(activePositions);
              const lats = positions.map(p => p.lat);
              const lngs = positions.map(p => p.lng);
              const bounds = [
                [Math.min(...lats), Math.min(...lngs)],
                [Math.max(...lats), Math.max(...lngs)]
              ];
              mapInstance?.fitBounds(bounds, { padding: [100, 100] });
            }
          }}
          className="zoom-btn zoom-fit"
          title="Centrer sur tous"
        >
          <i className="fas fa-expand-arrows-alt"></i>
        </button>
        <button 
          onClick={() => {
            const currentUserPosition = currentUser ? realTimePositions[currentUser._id] : null;
            if (currentUserPosition && mapInstance) {
              mapInstance.setView([currentUserPosition.lat, currentUserPosition.lng], 16);
            }
          }}
          className="zoom-btn zoom-location"
          title="Ma position"
          disabled={!currentUser || !realTimePositions[currentUser?._id]}
        >
          <i className="fas fa-location-arrow"></i>
        </button>
      </div>

      {/* Notifications temps réel */}
      <div className="realtime-notifications">
        {Object.values(activePositions)
          .filter(position => position.address?.amenity)
          .slice(0, 3)
          .map((position, index) => (
            <div 
              key={`notification-${position.user._id}`}
              className="notification-realtime"
              style={{ 
                animationDelay: `${index * 0.3}s`,
                borderLeftColor: userColors[position.user._id]
              }}
            >
              <div className="notification-icon">
                <i className="fas fa-location-dot"></i>
              </div>
              <div className="notification-text">
                <div className="notification-title">
                  {position.user.firstName} {position.user.lastName}
                </div>
                <div className="notification-message">
                  Détecté: {position.address.amenity}
                </div>
                <div className="notification-time">
                  {formatDateTime(position.timestamp)}
                </div>
              </div>
            </div>
          ))}
      </div>

      {/* Indicateur de performance GPS */}
      <div className="gps-performance-bar">
        <div className="perf-item">
          <i className="fas fa-satellite-dish"></i>
          <span className={`status ${connectionStatus}`}>
            {connectionStatus === 'connected' ? 'GPS Connecté' : 'Connexion...'}
          </span>
        </div>
        <div className="perf-item">
          <i className="fas fa-clock"></i>
          <span>MAJ: {new Date().toLocaleTimeString('fr-FR')}</span>
        </div>
        {currentUser && realTimePositions[currentUser._id] && (
          <div className="perf-item coords">
            <i className="fas fa-crosshairs"></i>
            <span>
              {realTimePositions[currentUser._id].lat.toFixed(4)}, 
              {realTimePositions[currentUser._id].lng.toFixed(4)}
            </span>
          </div>
        )}
        <div className="perf-item">
          <i className="fas fa-users"></i>
          <span>{Object.keys(activePositions).length} actifs</span>
        </div>
      </div>
    </div>
  );
};

export default Gps;

