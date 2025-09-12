import React, { useState, useEffect, useRef, useContext, useCallback } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Circle, useMap } from 'react-leaflet';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { UserContext } from '../context/UserContext';
import $ from 'jquery';
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

// Clés pour le stockage persistant
const STORAGE_KEYS = {
  SCROLL_POSITION: 'usermap_scroll_position',
  FILTER_ROLE: 'usermap_filter_role',
  AUTO_REFRESH: 'usermap_auto_refresh',
  MAP_CENTER: 'usermap_map_center',
  MAP_ZOOM: 'usermap_map_zoom',
  GPS_PERMISSION: 'usermap_gps_permission',
  LAST_POSITIONS: 'usermap_last_positions'
};

// Utilitaires de persistence
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
  },
  remove: (key) => {
    try {
      localStorage.removeItem(key);
    } catch (error) {
      console.warn('Erreur de suppression localStorage:', error);
    }
  }
};

// Utilitaire pour s'assurer qu'on a un objet Date valide
const ensureDate = (dateValue) => {
  if (!dateValue) return new Date();
  if (dateValue instanceof Date) return dateValue;
  if (typeof dateValue === 'string' || typeof dateValue === 'number') {
    const date = new Date(dateValue);
    return isNaN(date.getTime()) ? new Date() : date;
  }
  return new Date();
};

// Fonction pour formater l'heure de manière sécurisée
const formatTime = (dateValue) => {
  try {
    const date = ensureDate(dateValue);
    return date.toLocaleTimeString('fr-FR', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  } catch (error) {
    console.warn('Erreur formatage heure:', error);
    return new Date().toLocaleTimeString('fr-FR', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  }
};

// Fonction pour formater la date complète de manière sécurisée
const formatDateTime = (dateValue) => {
  try {
    const date = ensureDate(dateValue);
    return date.toLocaleString('fr-FR', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  } catch (error) {
    console.warn('Erreur formatage date:', error);
    return new Date().toLocaleString('fr-FR');
  }
};

// Fonction pour détecter le type d'appareil
const detectDeviceType = () => {
  const userAgent = navigator.userAgent.toLowerCase();
  if (/mobile|android|iphone|ipod/.test(userAgent)) {
    return 'mobile';
  } else if (/tablet|ipad/.test(userAgent)) {
    return 'tablet';
  } else {
    return 'desktop';
  }
};

// Fonction pour générer des informations d'appareil simulées
const generateDeviceInfo = (userId, userEmail) => {
  const deviceTypes = ['mobile', 'tablet', 'desktop'];
  const mobileNames = ['iPhone 14', 'Samsung Galaxy S23', 'Google Pixel 7', 'Huawei P50'];
  const tabletNames = ['iPad Pro', 'Samsung Galaxy Tab', 'Microsoft Surface', 'Lenovo Tab'];
  const desktopNames = ['MacBook Pro', 'Dell XPS', 'HP EliteBook', 'Lenovo ThinkPad'];
  
  // Hash basé sur l'ID utilisateur pour la consistance
  const seed = userId ? userId.slice(-6) : userEmail.slice(0, 6);
  const hash = seed.split('').reduce((a, b) => {
    a = ((a << 5) - a) + b.charCodeAt(0);
    return a & a;
  }, 0);
  
  const deviceTypeIndex = Math.abs(hash) % deviceTypes.length;
  const deviceType = deviceTypes[deviceTypeIndex];
  
  let deviceName;
  let deviceNames;
  
  switch (deviceType) {
    case 'mobile':
      deviceNames = mobileNames;
      break;
    case 'tablet':
      deviceNames = tabletNames;
      break;
    case 'desktop':
      deviceNames = desktopNames;
      break;
    default:
      deviceNames = desktopNames;
  }
  
  const nameIndex = Math.abs(hash * 7) % deviceNames.length;
  deviceName = deviceNames[nameIndex];
  
  // Générer une IP simulée
  const ipBase = Math.abs(hash) % 255;
  const ip = `192.168.1.${ipBase}`;
  
  return {
    id: `device_${Math.abs(hash).toString(36)}`,
    type: deviceType,
    name: deviceName,
    ip: ip,
    os: deviceType === 'mobile' ? (Math.abs(hash) % 2 ? 'iOS' : 'Android') : 
        deviceType === 'tablet' ? 'iPadOS' : 'Windows',
    lastSeen: new Date()
  };
};

// Fonction pour générer une position GPS simulée consistante
const generateUserPosition = (userId, userEmail, lastKnownPosition = null) => {
  const now = new Date();
  
  if (lastKnownPosition && lastKnownPosition.lastUpdate) {
    const lastUpdateDate = ensureDate(lastKnownPosition.lastUpdate);
    const timeDiff = now.getTime() - lastUpdateDate.getTime();
    
    // Si position < 5 minutes, légère variation
    if (timeDiff < 300000) {
      return {
        lat: lastKnownPosition.lat + (Math.random() - 0.5) * 0.001,
        lng: lastKnownPosition.lng + (Math.random() - 0.5) * 0.001,
        lastUpdate: now,
        accuracy: Math.floor(Math.random() * 50) + 10
      };
    }
  }
  
  // Nouvelle position basée sur un hash de l'utilisateur
  const seed = userId ? userId.slice(-6) : userEmail.slice(0, 6);
  const hash = seed.split('').reduce((a, b) => {
    a = ((a << 5) - a) + b.charCodeAt(0);
    return a & a;
  }, 0);
  
  const latOffset = ((hash % 100) - 50) / 1000;
  const lngOffset = (((hash * 7) % 100) - 50) / 1000;
  
  return {
    lat: 48.8566 + latOffset,
    lng: 2.3522 + lngOffset,
    lastUpdate: now,
    accuracy: Math.floor(Math.random() * 50) + 10
  };
};

// Icônes personnalisées pour les appareils
const createDeviceIcon = (deviceType, isCurrentUser = false, userCount = 1) => {
  let emoji = '🖥️';
  let bgColor = '#6b7280';
  
  switch (deviceType?.toLowerCase()) {
    case 'mobile':
    case 'phone':
      emoji = '📱';
      bgColor = '#10b981';
      break;
    case 'tablet':
      emoji = '📟';
      bgColor = '#f59e0b';
      break;
    case 'desktop':
    case 'laptop':
      emoji = '💻';
      bgColor = '#3b82f6';
      break;
    default:
      emoji = '🖥️';
      bgColor = '#6b7280';
  }
  
  if (isCurrentUser) {
    bgColor = '#ef4444';
  }
  
  return L.divIcon({
    html: `
      <div class="device-marker" style="
        background-color: ${bgColor};
        width: ${isCurrentUser ? '40px' : '35px'};
        height: ${isCurrentUser ? '40px' : '35px'};
        border-radius: 50%;
        border: 3px solid white;
        box-shadow: 0 2px 10px rgba(0,0,0,0.3);
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: ${isCurrentUser ? '20px' : '18px'};
        position: relative;
        ${isCurrentUser ? 'animation: pulse-device 2s infinite;' : ''}
      ">
        ${emoji}
        ${userCount > 1 ? `
          <div class="user-count-badge" style="
            position: absolute;
            top: -5px;
            right: -5px;
            background: #dc2626;
            color: white;
            border-radius: 50%;
            width: 20px;
            height: 20px;
            font-size: 12px;
            font-weight: bold;
            display: flex;
            align-items: center;
            justify-content: center;
            border: 2px solid white;
          ">${userCount}</div>
        ` : ''}
      </div>
    `,
    className: 'device-icon',
    iconSize: [isCurrentUser ? 40 : 35, isCurrentUser ? 40 : 35],
    iconAnchor: [isCurrentUser ? 20 : 17.5, isCurrentUser ? 20 : 17.5]
  });
};

// Icônes personnalisées pour les rôles (utilisées dans la liste)
const createRoleIcon = (role, isCurrentUser = false) => {
  const colors = {
    admin: '#dc2626',
    employee: '#2563eb',
    manager: '#059669',
    current: '#10b981'
  };
  
  const color = isCurrentUser ? colors.current : (colors[role] || colors.employee);
  
  return L.divIcon({
    html: `
      <div class="role-marker-icon" style="
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
    className: 'role-marker',
    iconSize: [isCurrentUser ? 35 : 30, isCurrentUser ? 35 : 30],
    iconAnchor: [isCurrentUser ? 17.5 : 15, isCurrentUser ? 17.5 : 15]
  });
};

// Fonction pour obtenir l'icône d'appareil pour l'affichage
const getDeviceEmoji = (deviceType) => {
  switch (deviceType?.toLowerCase()) {
    case 'mobile':
    case 'phone':
      return '📱';
    case 'tablet':
      return '📟';
    case 'desktop':
    case 'laptop':
      return '💻';
    default:
      return '🖥️';
  }
};

// Composant pour gérer le centre de la carte
const MapController = ({ center, zoom, onMoveEnd }) => {
  const map = useMap();
  
  useEffect(() => {
    if (center && Array.isArray(center) && center.length === 2) {
      map.setView(center, zoom || 13);
    }
  }, [map, center, zoom]);

  useEffect(() => {
    const handleMoveEnd = () => {
      const center = map.getCenter();
      const zoom = map.getZoom();
      if (onMoveEnd) {
        onMoveEnd([center.lat, center.lng], zoom);
      }
    };

    map.on('moveend', handleMoveEnd);
    return () => map.off('moveend', handleMoveEnd);
  }, [map, onMoveEnd]);
  
  return null;
};

const UserMap = () => {
  const { user, token } = useContext(UserContext);
  const queryClient = useQueryClient();
  
  // États avec persistence
  const [currentLocation, setCurrentLocation] = useState(null);
  const [filterRole, setFilterRole] = useState(() => 
    persistentStorage.get(STORAGE_KEYS.FILTER_ROLE, 'all')
  );
  const [autoRefresh, setAutoRefresh] = useState(() => 
    persistentStorage.get(STORAGE_KEYS.AUTO_REFRESH, true)
  );
  const [mapCenter, setMapCenter] = useState(() => 
    persistentStorage.get(STORAGE_KEYS.MAP_CENTER, [48.8566, 2.3522])
  );
  const [mapZoom, setMapZoom] = useState(() => 
    persistentStorage.get(STORAGE_KEYS.MAP_ZOOM, 13)
  );
  const [gpsPermission, setGpsPermission] = useState(() => 
    persistentStorage.get(STORAGE_KEYS.GPS_PERMISSION, 'prompt')
  );
  const [error, setError] = useState('');
  const [lastPositions, setLastPositions] = useState(() => 
    persistentStorage.get(STORAGE_KEYS.LAST_POSITIONS, {})
  );

  // Refs
  const watchIdRef = useRef(null);
  const scrollPositionRef = useRef(0);
  const containerRef = useRef(null);

  // Fonction pour fetcher les utilisateurs avec jQuery
  const fetchUsers = useCallback(async () => {
    if (!token) {
      throw new Error('Token d\'authentification manquant');
    }

    try {
      const response = await $.ajax({
        url: 'https://setrafbackend.onrender.com/api/users',
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        timeout: 10000
      });

      // Traitement des données avec gestion sécurisée des dates
      const processedUsers = (Array.isArray(response) ? response : [])
        .filter(u => 
          ['employee', 'admin', 'manager'].includes(u.role) && 
          u.isVerified && 
          u.isApproved
        )
        .map(u => {
          const lastKnownPos = lastPositions[u._id];
          const position = generateUserPosition(u._id, u.email, lastKnownPos);
          
          // S'assurer que lastUpdate est toujours un objet Date
          position.lastUpdate = ensureDate(position.lastUpdate);
          
          // Générer les infos de l'appareil
          const device = generateDeviceInfo(u._id, u.email);
          
          return {
            ...u,
            position,
            device,
            isCurrentUser: user && u._id === user._id
          };
        });

      // Sauvegarder les nouvelles positions avec dates sérialisées
      const newPositions = {};
      processedUsers.forEach(u => {
        newPositions[u._id] = {
          ...u.position,
          lastUpdate: u.position.lastUpdate.toISOString() // Sérialiser en ISO string
        };
      });
      setLastPositions(newPositions);
      persistentStorage.set(STORAGE_KEYS.LAST_POSITIONS, newPositions);

      return processedUsers;
    } catch (jqXHR) {
      // Gestion d'erreur jQuery
      if (jqXHR.status === 401) {
        throw new Error('Session expirée. Veuillez vous reconnecter.');
      } else if (jqXHR.status === 0) {
        throw new Error('Erreur de connexion au serveur.');
      } else {
        throw new Error(jqXHR.responseJSON?.message || `Erreur HTTP: ${jqXHR.status}`);
      }
    }
  }, [token, user, lastPositions]);

  // React Query pour la gestion des données
  const {
    data: allUsers = [],
    isLoading,
    error: queryError,
    refetch,
    isFetching
  } = useQuery({
    queryKey: ['users', user?._id],
    queryFn: fetchUsers,
    enabled: !!user && !!token,
    staleTime: 30000, // 30 secondes
    gcTime: 300000, // 5 minutes
    refetchInterval: autoRefresh ? 45000 : false, // 45 secondes si auto-refresh
    retry: 3,
    retryDelay: attemptIndex => Math.min(1000 * 2 ** attemptIndex, 30000),
    onError: (error) => {
      console.error('Erreur React Query:', error);
      setError(error.message || 'Erreur lors du chargement des utilisateurs');
    },
    onSuccess: () => {
      setError('');
    }
  });

  // Sauvegarde de la position de scroll avec jQuery
  const saveScrollPosition = useCallback(() => {
    if (typeof window !== 'undefined') {
      const scrollTop = $(window).scrollTop() || 0;
      scrollPositionRef.current = scrollTop;
      persistentStorage.set(STORAGE_KEYS.SCROLL_POSITION, scrollTop);
    }
  }, []);

  // Restauration de la position de scroll
  const restoreScrollPosition = useCallback(() => {
    if (typeof window !== 'undefined') {
      const savedPosition = persistentStorage.get(STORAGE_KEYS.SCROLL_POSITION, 0);
      if (savedPosition > 0) {
        $('html, body').animate({
          scrollTop: savedPosition
        }, 500);
      }
    }
  }, []);

  // Gestion de la géolocalisation
  const startGeolocation = useCallback(() => {
    if (!navigator.geolocation) {
      setError('Géolocalisation non supportée par ce navigateur');
      setGpsPermission('denied');
      persistentStorage.set(STORAGE_KEYS.GPS_PERMISSION, 'denied');
      return;
    }

    const options = {
      enableHighAccuracy: true,
      timeout: 15000,
      maximumAge: 60000
    };

    const onSuccess = (position) => {
      const newLocation = {
        lat: position.coords.latitude,
        lng: position.coords.longitude,
        accuracy: position.coords.accuracy,
        timestamp: new Date()
      };
      
      setCurrentLocation(newLocation);
      setGpsPermission('granted');
      persistentStorage.set(STORAGE_KEYS.GPS_PERMISSION, 'granted');
      
      // Centrer la carte sur la première position obtenue
      const savedCenter = persistentStorage.get(STORAGE_KEYS.MAP_CENTER);
      if (!savedCenter || (savedCenter[0] === 48.8566 && savedCenter[1] === 2.3522)) {
        setMapCenter([newLocation.lat, newLocation.lng]);
        persistentStorage.set(STORAGE_KEYS.MAP_CENTER, [newLocation.lat, newLocation.lng]);
      }
    };

    const onError = (error) => {
      console.error('Erreur géolocalisation:', error);
      setGpsPermission('denied');
      persistentStorage.set(STORAGE_KEYS.GPS_PERMISSION, 'denied');
      
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

    // Position initiale
    navigator.geolocation.getCurrentPosition(onSuccess, onError, options);

    // Surveillance continue
    watchIdRef.current = navigator.geolocation.watchPosition(onSuccess, onError, options);
  }, []);

  // Gestion des changements d'état avec persistence
  useEffect(() => {
    persistentStorage.set(STORAGE_KEYS.FILTER_ROLE, filterRole);
  }, [filterRole]);

    useEffect(() => {
    persistentStorage.set(STORAGE_KEYS.AUTO_REFRESH, autoRefresh);
  }, [autoRefresh]);

  useEffect(() => {
    persistentStorage.set(STORAGE_KEYS.MAP_CENTER, mapCenter);
  }, [mapCenter]);

  useEffect(() => {
    persistentStorage.set(STORAGE_KEYS.MAP_ZOOM, mapZoom);
  }, [mapZoom]);

  // Initialisation du composant
  useEffect(() => {
    if (!user || !token) return;

    // Démarrer la géolocalisation
    startGeolocation();

    // Restaurer la position de scroll après un court délai
    const scrollTimer = setTimeout(restoreScrollPosition, 200);

    // Gestion des événements de scroll avec jQuery
    const handleScroll = () => saveScrollPosition();
    const handleBeforeUnload = () => saveScrollPosition();

    $(window).on('scroll.usermap', handleScroll);
    $(window).on('beforeunload.usermap', handleBeforeUnload);

    return () => {
      clearTimeout(scrollTimer);
      $(window).off('scroll.usermap');
      $(window).off('beforeunload.usermap');
      
      if (watchIdRef.current) {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }
    };
  }, [user, token, startGeolocation, restoreScrollPosition, saveScrollPosition]);

  // Gestion du déplacement de la carte
  const handleMapMoveEnd = useCallback((center, zoom) => {
    setMapCenter(center);
    setMapZoom(zoom);
  }, []);

  // Fonction pour actualiser manuellement
  const handleRefresh = useCallback(async () => {
    saveScrollPosition();
    await refetch();
    setTimeout(restoreScrollPosition, 100);
  }, [refetch, saveScrollPosition, restoreScrollPosition]);

  // Réessayer la géolocalisation
  const retryGeolocation = useCallback(() => {
    setError('');
    setGpsPermission('prompt');
    startGeolocation();
  }, [startGeolocation]);

  // Utilisateurs filtrés
  const filteredUsers = allUsers.filter(u => 
    filterRole === 'all' || u.role === filterRole
  );

  // Regroupement par appareil pour affichage sur la carte
  const deviceGroups = filteredUsers.reduce((groups, user) => {
    const deviceId = user.device?.id || user._id;
    if (!groups[deviceId]) {
      groups[deviceId] = {
        device: user.device,
        position: user.position,
        users: [],
        isCurrentUserDevice: false
      };
    }
    groups[deviceId].users.push(user);
    if (user.isCurrentUser) {
      groups[deviceId].isCurrentUserDevice = true;
    }
    return groups;
  }, {});

  // Affichage de chargement initial seulement si pas de données en cache
  if (isLoading && allUsers.length === 0) {
    return (
      <div className="user-map-loading">
        <div className="spinner"></div>
        <p>Chargement de la carte...</p>
        <p className="loading-detail">
          Récupération des données depuis le cache ou le serveur...
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
    <div className="user-map-container" ref={containerRef}>
      {/* En-tête */}
      <div className="map-header">
        <div className="header-left">
          <h2>
            <i className="fas fa-map-marker-alt"></i>
            Carte des Appareils & Utilisateurs
            {isFetching && (
              <span className="loading-indicator">
                <i className="fas fa-sync-alt spinning"></i>
              </span>
            )}
          </h2>
          <div className="user-info-brief">
            <span className="current-user">
              Connecté en tant que: <strong>{user.firstName} {user.lastName}</strong> ({user.role})
            </span>
            <span className="user-count">
              {filteredUsers.length} utilisateur{filteredUsers.length !== 1 ? 's' : ''} sur {Object.keys(deviceGroups).length} appareil{Object.keys(deviceGroups).length !== 1 ? 's' : ''}
              {allUsers.length > 0 && (
                <span className="cache-indicator">
                  <i className="fas fa-database" title="Données en cache"></i>
                </span>
              )}
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
            disabled={isFetching}
            title="Actualiser maintenant"
          >
            <i className={`fas fa-sync-alt ${isFetching ? 'spinning' : ''}`}></i>
          </button>
        </div>
      </div>

      {/* Statut GPS et Cache */}
      <div className="status-bar">
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
        
        <div className="cache-status">
          <i className="fas fa-database"></i>
          <span>Données persistantes: {allUsers.length} utilisateurs en cache</span>
          {queryClient.getQueryState(['users', user?._id])?.status === 'success' && (
            <span className="cache-fresh">✓ À jour</span>
          )}
        </div>
      </div>

      {/* Messages d'erreur */}
      {(error || queryError) && (
        <div className="error-message">
          <i className="fas fa-exclamation-triangle"></i>
          <span>{error || queryError?.message}</span>
          <button onClick={handleRefresh} className="retry-btn">
            Réessayer
          </button>
        </div>
      )}

      {/* Statistiques avec appareils */}
      <div className="map-stats">
        <div className="stat-card">
          <i className="fas fa-mobile-alt"></i>
          <div>
            <span className="stat-number">{Object.keys(deviceGroups).length}</span>
            <span className="stat-label">Appareils connectés</span>
          </div>
        </div>
        <div className="stat-card">
          <i className="fas fa-users"></i>
          <div>
            <span className="stat-number">{filteredUsers.length}</span>
            <span className="stat-label">Utilisateurs actifs</span>
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
          center={mapCenter}
          zoom={mapZoom}
          className="user-map"
          style={{ height: '600px', width: '100%' }}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          
          <MapController 
            center={mapCenter} 
            zoom={mapZoom} 
            onMoveEnd={handleMapMoveEnd}
          />
          
          {/* Marqueur position réelle GPS */}
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
                      {formatDateTime(currentLocation.timestamp)}
                    </p>
                  </div>
                </div>
              </Popup>
            </Marker>
          )}
          
          {/* Marqueurs des appareils avec utilisateurs groupés */}
          {Object.entries(deviceGroups).map(([deviceId, deviceGroup]) => (
            <React.Fragment key={deviceId}>
              <Marker
                position={[deviceGroup.position.lat, deviceGroup.position.lng]}
                icon={createDeviceIcon(
                  deviceGroup.device?.type, 
                  deviceGroup.isCurrentUserDevice, 
                  deviceGroup.users.length
                )}
              >
                <Popup>
                  <div className="popup-content">
                    <div className="popup-header">
                      <div className="device-info">
                        <h4>
                          {getDeviceEmoji(deviceGroup.device?.type)} {deviceGroup.device?.name || "Appareil inconnu"}
                          {deviceGroup.isCurrentUserDevice && (
                            <span className="current-device-badge">Votre appareil</span>
                          )}
                        </h4>
                        <div className="device-details">
                          <p><strong>Type:</strong> {deviceGroup.device?.type || 'Inconnu'}</p>
                          <p><strong>Adresse IP:</strong> {deviceGroup.device?.ip || 'N/A'}</p>
                          <p><strong>OS:</strong> {deviceGroup.device?.os || 'N/A'}</p>
                          <p><strong>Utilisateurs:</strong> {deviceGroup.users.length}</p>
                        </div>
                      </div>
                    </div>
                    
                    <div className="popup-users">
                      <h5>Utilisateurs sur cet appareil:</h5>
                      {deviceGroup.users.map((userItem) => (
                        <div key={userItem._id} className="popup-user">
                          <div className="user-avatar-small">
                            {userItem.profilePhoto ? (
                              <img 
                                src={`https://setrafbackend.onrender.com/${userItem.profilePhoto}`} 
                                alt={`${userItem.firstName} ${userItem.lastName}`}
                                onError={(e) => {
                                  e.target.style.display = 'none';
                                  e.target.nextSibling.style.display = 'flex';
                                }}
                              />
                            ) : null}
                            <div className="avatar-placeholder-small" style={{display: userItem.profilePhoto ? 'none' : 'flex'}}>
                              <i className="fas fa-user"></i>
                            </div>
                          </div>
                          <div className="user-info-small">
                            <span className="user-name">
                              {userItem.firstName} {userItem.lastName}
                              {userItem.isCurrentUser && <span className="you-badge-small">Vous</span>}
                            </span>
                            <span className={`role-badge-small ${userItem.role}`}>
                              {userItem.role === 'admin' ? 'Admin' : 
                               userItem.role === 'manager' ? 'Manager' : 'Employé'}
                            </span>
                            <span className="user-email-small">{userItem.email}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                    
                    <div className="popup-location">
                      <p>
                        <i className="fas fa-map-marker-alt"></i>
                        {deviceGroup.position.lat.toFixed(4)}, {deviceGroup.position.lng.toFixed(4)}
                      </p>
                      <p>
                        <i className="fas fa-clock"></i>
                        Mis à jour: {formatTime(deviceGroup.position.lastUpdate)}
                      </p>
                    </div>
                  </div>
                </Popup>
              </Marker>

              {/* Cercle pour les appareils avec plusieurs utilisateurs */}
              {deviceGroup.users.length > 1 && (
                <Circle
                  center={[deviceGroup.position.lat, deviceGroup.position.lng]}
                  radius={50}
                  pathOptions={{ 
                    color: '#dc2626', 
                    fillColor: '#dc2626',
                    fillOpacity: 0.1,
                    weight: 2,
                    dashArray: '5, 5'
                  }}
                />
              )}
            </React.Fragment>
          ))}
        </MapContainer>
      </div>

      {/* Liste des utilisateurs avec infos appareils */}
      {filteredUsers.length > 0 && (
        <div className="users-list">
          <h3>
            Utilisateurs et leurs appareils ({filteredUsers.length})
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
            {filteredUsers.map((userItem) => {
              const sameDeviceUsers = filteredUsers.filter(u => u.device?.id === userItem.device?.id);
              
              return (
                <div key={userItem._id} className={`user-card ${userItem.role} ${userItem.isCurrentUser ? 'current-user' : ''}`}>
                  <div className="user-avatar">
                    {userItem.profilePhoto ? (
                      <img 
                        src={`https://setrafbackend.onrender.com/${userItem.profilePhoto}`} 
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
                    
                    {/* Informations de l'appareil */}
                    <div className="device-info-card">
                      <div className="device-header">
                        <span className="device-emoji">{getDeviceEmoji(userItem.device?.type)}</span>
                        <span className="device-name">{userItem.device?.name || 'Appareil inconnu'}</span>
                      </div>
                      <div className="device-details-small">
                        <span className="device-type">{userItem.device?.type || 'Inconnu'}</span>
                        <span className="device-ip">IP: {userItem.device?.ip || 'N/A'}</span>
                        <span className="device-os">{userItem.device?.os || 'N/A'}</span>
                      </div>
                      {sameDeviceUsers.length > 1 && (
                        <div className="shared-device-indicator">
                          <i className="fas fa-users"></i>
                          <span>{sameDeviceUsers.length} utilisateurs sur cet appareil</span>
                        </div>
                      )}
                    </div>
                    
                    <p className="coordinates">
                      <i className="fas fa-map-marker-alt"></i>
                      {userItem.position.lat.toFixed(4)}, {userItem.position.lng.toFixed(4)}
                    </p>
                    <p className="last-update">
                      <i className="fas fa-clock"></i>
                      Position: {formatTime(userItem.position.lastUpdate)}
                    </p>
                    
                    {userItem.nip && (
                      <p className="user-nip">
                        <i className="fas fa-id-card"></i>
                        NIP: {userItem.nip}
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Statistiques des appareils */}
      <div className="device-stats">
        <h3>Statistiques des appareils</h3>
                <div className="device-stats-grid">
          <div className="device-stat-card mobile">
            <div className="device-stat-icon">📱</div>
            <div className="device-stat-info">
              <span className="device-stat-number">
                {Object.values(deviceGroups).filter(g => g.device?.type === 'mobile').length}
              </span>
              <span className="device-stat-label">Téléphones</span>
            </div>
          </div>
          <div className="device-stat-card tablet">
            <div className="device-stat-icon">📟</div>
            <div className="device-stat-info">
              <span className="device-stat-number">
                {Object.values(deviceGroups).filter(g => g.device?.type === 'tablet').length}
              </span>
              <span className="device-stat-label">Tablettes</span>
            </div>
          </div>
          <div className="device-stat-card desktop">
            <div className="device-stat-icon">💻</div>
            <div className="device-stat-info">
              <span className="device-stat-number">
                {Object.values(deviceGroups).filter(g => g.device?.type === 'desktop').length}
              </span>
              <span className="device-stat-label">Ordinateurs</span>
            </div>
          </div>
          <div className="device-stat-card shared">
            <div className="device-stat-icon">👥</div>
            <div className="device-stat-info">
              <span className="device-stat-number">
                {Object.values(deviceGroups).filter(g => g.users.length > 1).length}
              </span>
              <span className="device-stat-label">Appareils partagés</span>
            </div>
          </div>
        </div>
      </div>

      {/* Message si aucun utilisateur */}
      {filteredUsers.length === 0 && !isLoading && allUsers.length > 0 && (
        <div className="no-users-message">
          <i className="fas fa-filter"></i>
          <h3>Aucun utilisateur pour ce filtre</h3>
          <p>
            Aucun {
              filterRole === 'admin' ? 'administrateur' : 
              filterRole === 'manager' ? 'manager' : 'employé'
            } n'est actuellement disponible.
          </p>
          <button onClick={() => setFilterRole('all')} className="reset-filter-btn">
            <i className="fas fa-times"></i>
            Réinitialiser le filtre
          </button>
        </div>
      )}

      {/* Message si aucune donnée du tout */}
      {allUsers.length === 0 && !isLoading && (
        <div className="no-users-message">
          <i className="fas fa-mobile-alt"></i>
          <h3>Aucun appareil connecté</h3>
          <p>
            Aucun utilisateur vérifié avec un appareil n'est actuellement disponible dans le système.
          </p>
          <button onClick={handleRefresh} className="refresh-btn">
            <i className="fas fa-sync-alt"></i>
            Actualiser
          </button>
        </div>
      )}

      {/* Bouton de retour en haut */}
      <div className="scroll-to-top" onClick={() => {
        $('html, body').animate({ scrollTop: 0 }, 500);
        persistentStorage.set(STORAGE_KEYS.SCROLL_POSITION, 0);
      }}>
        <i className="fas fa-chevron-up"></i>
      </div>

      {/* Indicateur de performance */}
      <div className="performance-indicator">
        <div className="perf-item">
          <i className="fas fa-tachometer-alt"></i>
          <span>Cache: {queryClient.getQueryState(['users', user?._id])?.status || 'idle'}</span>
        </div>
        <div className="perf-item">
          <i className="fas fa-clock"></i>
          <span>
            {queryClient.getQueryState(['users', user?._id])?.dataUpdatedAt 
              ? `Mis à jour: ${formatTime(queryClient.getQueryState(['users', user?._id]).dataUpdatedAt)}`
              : 'Pas de données'
            }
          </span>
        </div>
        <div className="perf-item">
          <i className="fas fa-mobile-alt"></i>
          <span>
            Appareils: {Object.keys(deviceGroups).length} | 
            Partagés: {Object.values(deviceGroups).filter(g => g.users.length > 1).length}
          </span>
        </div>
      </div>
    </div>
  );
};

export default UserMap;