import React, { useState, useEffect, useRef, useContext, useCallback } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, Circle, useMap, Tooltip } from 'react-leaflet';
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
  USER_PERMISSIONS: 'real_gps_permissions',
  WEATHER_CACHE: 'weather_cache'
};

// Icônes météo
const WEATHER_ICONS = {
  clear: '☀️',
  clouds: '☁️',
  rain: '🌧️',
  snow: '❄️',
  thunderstorm: '⛈️',
  drizzle: '🌦️',
  mist: '🌫️',
  fog: '🌫️'
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

// API météo
const getWeatherData = async (lat, lng) => {
  const API_KEY = '6e84ab71e5f1dc3b1fc3e3f9e8f7b84e'; // Remplacez par votre clé API OpenWeatherMap
  const cacheKey = `weather_${lat.toFixed(2)}_${lng.toFixed(2)}`;
  const cached = persistentStorage.get(STORAGE_KEYS.WEATHER_CACHE);
  
  // Vérifier le cache (valide 10 minutes)
  if (cached && cached[cacheKey] && (Date.now() - cached[cacheKey].timestamp) < 600000) {
    return cached[cacheKey].data;
  }
  
  try {
    const response = await fetch(
      `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lng}&appid=${API_KEY}&units=metric&lang=fr`
    );
    
    if (!response.ok) throw new Error('Erreur API météo');
    
    const data = await response.json();
    const weatherData = {
      temperature: Math.round(data.main.temp),
      description: data.weather[0].description,
      main: data.weather[0].main.toLowerCase(),
      icon: WEATHER_ICONS[data.weather[0].main.toLowerCase()] || '🌤️',
      humidity: data.main.humidity,
      windSpeed: Math.round(data.wind.speed * 3.6), // m/s to km/h
      pressure: data.main.pressure
    };
    
    // Mettre à jour le cache
    const newCache = cached || {};
    newCache[cacheKey] = {
      data: weatherData,
      timestamp: Date.now()
    };
    persistentStorage.set(STORAGE_KEYS.WEATHER_CACHE, newCache);
    
    return weatherData;
  } catch (error) {
    console.warn('Erreur météo:', error);
    return {
      temperature: '--',
      description: 'Non disponible',
      main: 'unknown',
      icon: '🌤️',
      humidity: 0,
      windSpeed: 0,
      pressure: 0
    };
  }
};

// API de géocodage inverse avec descriptions 3D des lieux
const getRealAddress = async (lat, lng) => {
  try {
    // Requête avec détails étendus
    const response = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1&extratags=1&namedetails=1`,
      {
        headers: {
          'User-Agent': 'RealTimeGPS-App/1.0'
        }
      }
    );
    
    if (!response.ok) throw new Error('Erreur géocodage');
    
    const data = await response.json();
    const address = data.address || {};
    const tags = data.extratags || {};
    
    // Description enrichie 3D du lieu
    const description3D = generateLocationDescription(address, tags, data);
    
    return {
      fullAddress: data.display_name || `${lat.toFixed(6)}, ${lng.toFixed(6)}`,
      street: [address.house_number, address.road].filter(Boolean).join(' '),
      district: address.suburb || address.neighbourhood || address.quarter || '',
      city: address.city || address.town || address.village || '',
      postal_code: address.postcode || '',
      country: address.country || 'France',
      amenity: address.amenity || address.shop || address.office || null,
      description3D: description3D,
      category: data.category || 'place',
      type: data.type || 'unknown',
      importance: data.importance || 0
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
      amenity: null,
      description3D: {
        title: 'Position GPS',
        description: 'Localisation en cours de résolution...',
        details: []
      }
    };
  }
};

// Génération de descriptions 3D enrichies
const generateLocationDescription = (address, tags, data) => {
  const descriptions = {
    building: {
      title: '🏢 Bâtiment',
      description: 'Structure architecturale',
      details: []
    },
    shop: {
      title: '🛍️ Commerce',
      description: 'Zone commerciale active',
      details: ['Activité commerciale', 'Zone piétonne possible']
    },
    restaurant: {
      title: '🍽️ Restaurant',
      description: 'Établissement de restauration',
      details: ['Service de restauration', 'Zone de convivialité']
    },
    hospital: {
      title: '🏥 Établissement de santé',
      description: 'Infrastructure médicale',
      details: ['Services de santé', 'Zone d\'urgence possible']
    },
    school: {
      title: '🎓 Établissement scolaire',
      description: 'Zone éducative',
      details: ['Activité scolaire', 'Zone de circulation dense aux heures de pointe']
    },
    park: {
      title: '🌳 Espace vert',
      description: 'Zone naturelle et de détente',
      details: ['Espace de loisirs', 'Végétation dense', 'Air pur']
    },
    road: {
      title: '🛣️ Voie de circulation',
      description: 'Axe de transport',
      details: ['Circulation vehiculaire', 'Réseau routier']
    }
  };

  const amenity = address.amenity || tags.amenity || data.type;
  let locationInfo = descriptions[amenity] || {
    title: '📍 Localisation',
    description: 'Position géographique',
    details: []
  };

  // Enrichir avec les détails spécifiques
  const details = [...locationInfo.details];
  
  if (address.building) details.push(`Bâtiment: ${address.building}`);
  if (tags.building_levels) details.push(`${tags.building_levels} niveaux`);
  if (tags.wheelchair === 'yes') details.push('Accessible PMR');
  if (tags.parking) details.push('Parking disponible');
  if (tags.opening_hours) details.push(`Horaires: ${tags.opening_hours}`);
  if (address.postcode) details.push(`Code postal: ${address.postcode}`);
  
  // Ajouter le type d'environnement
  if (address.city) details.push(`Environnement urbain: ${address.city}`);
  if (address.suburb) details.push(`Quartier: ${address.suburb}`);

  return {
    ...locationInfo,
    details: details
  };
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

// Icône employé standard
const createEmployeeIcon = (color, userName, role = 'employee', isOnline = false) => {
  const initials = userName.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  
  const roleIcons = {
    admin: '👑',
    manager: '💼',
    employee: '👤',
    supervisor: '👨‍💼'
  };
  
  return L.divIcon({
    html: `
      <div class="employee-marker-3d ${isOnline ? 'online' : 'offline'}" style="--marker-color: ${color}">
        <div class="employee-avatar">
          <span class="employee-initials">${initials}</span>
          <div class="role-indicator">${roleIcons[role] || '👤'}</div>
          <div class="status-dot ${isOnline ? 'online' : 'offline'}"></div>
        </div>
        <div class="employee-pulse ${isOnline ? 'active' : ''}"></div>
        <div class="employee-shadow"></div>
      </div>
    `,
    className: 'employee-container-3d',
    iconSize: [50, 50],
    iconAnchor: [25, 25]
  });
};

// Icône de marqueur GPS 3D ultra-avancée
const createRealGPSIcon = (color, userName, isMoving = false, heading = 0, accuracy = 0, weather = null) => {
  const initials = userName.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  const size = accuracy > 50 ? 45 : accuracy > 20 ? 55 : 70;
  
  return L.divIcon({
    html: `
      <div class="real-gps-marker-3d ${isMoving ? 'moving' : 'stationary'}" style="
        --marker-color: ${color};
        --marker-size: ${size}px;
        transform: rotate(${heading}deg);
      ">
        ${weather ? `
          <div class="weather-overlay">
            <span class="weather-icon">${weather.icon}</span>
            <span class="weather-temp">${weather.temperature}°C</span>
          </div>
        ` : ''}
        
        <div class="gps-accuracy-ring-3d" style="
          width: ${Math.max(accuracy * 2, 40)}px; 
          height: ${Math.max(accuracy * 2, 40)}px;
        "></div>
        
        <div class="gps-pulse-ring-3d pulse-1"></div>
        <div class="gps-pulse-ring-3d pulse-2"></div>
        <div class="gps-pulse-ring-3d pulse-3"></div>
        
        <div class="gps-main-marker-3d">
          <div class="gps-signal-indicator-3d">
            <div class="signal-wave-3d wave1"></div>
            <div class="signal-wave-3d wave2"></div>
            <div class="signal-wave-3d wave3"></div>
            <div class="signal-wave-3d wave4"></div>
          </div>
          
          <div class="gps-user-initials-3d">${initials}</div>
          
          <div class="gps-real-badge-3d">
            <i class="fas fa-satellite"></i>
            <div class="satellite-orbit"></div>
          </div>
          
          <div class="gps-status-lights">
            <div class="status-light gps-active"></div>
            <div class="status-light data-active"></div>
            <div class="status-light connection-active"></div>
          </div>
        </div>
        
        <div class="gps-direction-arrow-3d" style="opacity: ${isMoving ? 1 : 0.3};">
          <i class="fas fa-navigation"></i>
          <div class="direction-trail"></div>
        </div>
        
        <div class="gps-accuracy-text-3d">
          <div class="accuracy-value">±${Math.round(accuracy)}m</div>
          <div class="accuracy-bar">
            <div class="accuracy-fill" style="width: ${Math.min(100, 100 - (accuracy / 50 * 100))}%"></div>
          </div>
        </div>
        
        <div class="gps-shadow-3d"></div>
      </div>
    `,
    className: 'real-gps-container-3d',
    iconSize: [size, size],
    iconAnchor: [size/2, size/2]
  });
};

// Marqueur de lieu 3D
const createLocationMarker3D = (description, category) => {
  const categoryIcons = {
    building: '🏢',
    shop: '🛍️',
    restaurant: '🍽️',
    hospital: '🏥',
    school: '🎓',
    park: '🌳',
    default: '📍'
  };
  
  const icon = categoryIcons[category] || categoryIcons.default;
  
  return L.divIcon({
    html: `
      <div class="location-marker-3d ${category}">
        <div class="location-icon-3d">
          <span class="location-emoji">${icon}</span>
        </div>
        <div class="location-pulse"></div>
        <div class="location-label">${description.title}</div>
      </div>
    `,
    className: 'location-container-3d',
    iconSize: [40, 40],
    iconAnchor: [20, 20]
  });
};

// Calcul de distance avec mesure précise
const calculateDistance = (lat1, lng1, lat2, lng2) => {
  const R = 6371e3;
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

// Contrôleur de carte intelligent avec météo
const IntelligentMapController = ({ 
  realTimePositions, 
  autoCenter, 
  selectedUsers, 
  onMapReady,
  trackingMode,
  weatherData,
  locationDescriptions,
  allEmployees
}) => {
  const map = useMap();
  const lastBoundsRef = useRef(null);
  
  useEffect(() => {
    if (onMapReady) onMapReady(map);
  }, [map, onMapReady]);
  
  // Auto-centrage intelligent incluant les employés statiques
  useEffect(() => {
    if (!autoCenter) return;
    
    const allPositions = [];
    
    // Positions GPS temps réel
    if (realTimePositions && Object.keys(realTimePositions).length > 0) {
      const gpsPositions = Object.entries(realTimePositions)
        .filter(([userId]) => selectedUsers.has(userId))
        .map(([_, position]) => position);
      allPositions.push(...gpsPositions);
    }
    
    // Positions des employés (fixes)
    if (allEmployees && allEmployees.length > 0) {
      const employeePositions = allEmployees
        .filter(emp => emp.location && emp.location.coordinates && selectedUsers.has(emp._id))
        .map(emp => ({
          lat: emp.location.coordinates[1],
          lng: emp.location.coordinates[0]
        }));
      allPositions.push(...employeePositions);
    }
    
    if (allPositions.length === 0) return;
    
    map.whenReady(() => {
      if (allPositions.length === 1) {
        const position = allPositions[0];
        const zoom = trackingMode === 'close' ? 19 : trackingMode === 'normal' ? 16 : 14;
        map.setView([position.lat, position.lng], zoom, { animate: true, duration: 1.5 });
        return;
      }
      
      const lats = allPositions.map(p => p.lat);
      const lngs = allPositions.map(p => p.lng);
      
      const bounds = [
        [Math.min(...lats), Math.min(...lngs)],
        [Math.max(...lats), Math.max(...lngs)]
      ];
      
      const boundsKey = bounds.flat().map(n => n.toFixed(4)).join(',');
      if (lastBoundsRef.current === boundsKey) return;
      lastBoundsRef.current = boundsKey;
      
      map.fitBounds(bounds, { 
        padding: [80, 80],
        animate: true,
        duration: 2
      });
    });
  }, [map, realTimePositions, autoCenter, selectedUsers, trackingMode, allEmployees]);
  
  return null;
};

// Composant principal GPS
const Gps = () => {
  const { user, token } = useContext(UserContext);
  const queryClient = useQueryClient();
  
  // États principaux
  const [selectedUsers, setSelectedUsers] = useState(new Set());
  const [showTracks, setShowTracks] = useState(true);
  const [showEmployeePositions, setShowEmployeePositions] = useState(true);
  const [autoCenter, setAutoCenter] = useState(true);
  const [trackingMode, setTrackingMode] = useState('normal');
  const [controlsVisible, setControlsVisible] = useState(true);
  
  // États GPS
  const [realTimePositions, setRealTimePositions] = useState({});
  const [gpsPermissions, setGpsPermissions] = useState({});
  const [userTracks, setUserTracks] = useState({});
  const [gpsErrors, setGpsErrors] = useState({});
  const [connectionStatus, setConnectionStatus] = useState('connecting');
  
  // États météo et descriptions
  const [weatherData, setWeatherData] = useState({});
  const [locationDescriptions, setLocationDescriptions] = useState({});
  const [trackDistances, setTrackDistances] = useState({});
  
  // États UI
  const [userColors, setUserColors] = useState({});
  const [mapInstance, setMapInstance] = useState(null);
  const [currentUser, setCurrentUser] = useState(null);
  
  // Refs
  const watchersRef = useRef({});
  const addressCacheRef = useRef({});
  const lastUpdateRef = useRef({});
  const controlsTimeoutRef = useRef(null);

  // Récupération des utilisateurs avec leurs positions
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
        )
        .map(u => ({
          ...u,
          // Assurer que la localisation est correctement formatée
          location: u.location && u.location.coordinates ? u.location : null,
          isOnline: u.lastActivity ? 
            (new Date() - new Date(u.lastActivity)) < 300000 : false // 5 minutes
        }));

      return validUsers;
    } catch (error) {
      console.error('Erreur chargement utilisateurs:', error);
      throw new Error('Impossible de charger les utilisateurs');
    }
  }, [token]);

  const { data: users = [], isLoading, error } = useQuery({
    queryKey: ['real-gps-users', user?._id],
    queryFn: fetchUsers,
    enabled: !!user && !!token,
    staleTime: 30000,
    refetchInterval: 60000,
    retry: 3
  });

  // Initialisation GPS avec météo
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
      timeout: 5000,
      maximumAge: 500
    };

    const onSuccess = async (position) => {
      const coords = position.coords;
      const timestamp = new Date();
      
      const lastUpdate = lastUpdateRef.current[targetUser._id];
      if (lastUpdate && (timestamp - lastUpdate) < 800) return;
      lastUpdateRef.current[targetUser._id] = timestamp;
      
      // Calculs avancés
      const prevPosition = realTimePositions[targetUser._id];
      let speed = coords.speed || 0;
      let heading = coords.heading || 0;
      let isMoving = speed > 0.5;
      let distance = 0;
      
      if (prevPosition) {
        const timeDiff = (timestamp - new Date(prevPosition.timestamp)) / 1000;
        if (timeDiff > 0) {
          distance = calculateDistance(
            prevPosition.lat, prevPosition.lng,
            coords.latitude, coords.longitude
          );
          if (!coords.speed) {
            speed = (distance / timeDiff) * 3.6;
          }
          isMoving = speed > 0.5;
          
          if (distance > 2) {
            heading = calculateBearing(
              prevPosition.lat, prevPosition.lng,
              coords.latitude, coords.longitude
            );
          }
        }
      }

      // Géocodage avec description 3D
      const cacheKey = `${coords.latitude.toFixed(4)}_${coords.longitude.toFixed(4)}`;
      let address = addressCacheRef.current[cacheKey];
      
      if (!address) {
        try {
          address = await getRealAddress(coords.latitude, coords.longitude);
          addressCacheRef.current[cacheKey] = address;
          
          // Stocker la description du lieu
          setLocationDescriptions(prev => ({
            ...prev,
            [cacheKey]: address.description3D
          }));
        } catch (error) {
          address = {
            fullAddress: `Position GPS ${coords.latitude.toFixed(6)}, ${coords.longitude.toFixed(6)}`,
            city: 'Localisation en cours...',
            description3D: {
              title: 'Position GPS',
              description: 'Localisation en cours...',
              details: []
            }
          };
        }
      }

      // Récupération de la météo
      let weather = weatherData[cacheKey];
      if (!weather) {
        try {
          weather = await getWeatherData(coords.latitude, coords.longitude);
          setWeatherData(prev => ({
            ...prev,
            [cacheKey]: weather
          }));
        } catch (error) {
          weather = null;
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
        weather: weather,
        user: targetUser,
        distance: distance
      };

      setRealTimePositions(prev => ({
        ...prev,
        [targetUser._id]: newPosition
      }));

      // Mise à jour des tracks avec calcul de distance totale
      setUserTracks(prev => {
        const currentTrack = prev[targetUser._id] || [];
        const newTrack = [...currentTrack, newPosition].slice(-200);
        
        // Calcul de la distance totale du trajet
        let totalDistance = 0;
        for (let i = 1; i < newTrack.length; i++) {
          totalDistance += calculateDistance(
            newTrack[i-1].lat, newTrack[i-1].lng,
            newTrack[i].lat, newTrack[i].lng
          );
        }
        
        setTrackDistances(prevDist => ({
          ...prevDist,
          [targetUser._id]: totalDistance
        }));
        
        persistentStorage.set(STORAGE_KEYS.GPS_TRACKS, {
          ...prev,
          [targetUser._id]: newTrack
        });
        
        return {
          ...prev,
          [targetUser._id]: newTrack
        };
      });

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
          setTimeout(() => initializeUserGPS(targetUser), 3000);
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

    if (watchersRef.current[targetUser._id]) {
      navigator.geolocation.clearWatch(watchersRef.current[targetUser._id]);
    }

    navigator.geolocation.getCurrentPosition(onSuccess, onError, options);
    
    watchersRef.current[targetUser._id] = navigator.geolocation.watchPosition(
      onSuccess, 
      onError, 
      options
    );

  }, [realTimePositions, weatherData]);

  // Attribution des couleurs
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

  // Initialisation GPS
  useEffect(() => {
    if (users.length > 0 && user) {
      setConnectionStatus('initializing');
      
      const current = users.find(u => u._id === user._id);
      if (current) {
        setCurrentUser(current);
      }

      users.forEach(targetUser => {
        if (targetUser._id === user._id) {
          initializeUserGPS(targetUser);
        }
      });

      setConnectionStatus('connected');
    }

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
    }, 15000);
  }, []);

  useEffect(() => {
    resetControlsTimeout();
    return () => {
      if (controlsTimeoutRef.current) {
        clearTimeout(controlsTimeoutRef.current);
      }
    };
  }, [resetControlsTimeout]);

  // Raccourcis clavier
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
        case 'KeyE':
          if (event.ctrlKey) {
            event.preventDefault();
            setShowEmployeePositions(prev => !prev);
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

  const retryUserGPS = useCallback((targetUser) => {
    setGpsErrors(prev => {
      const newErrors = { ...prev };
      delete newErrors[targetUser._id];
      return newErrors;
    });
    initializeUserGPS(targetUser);
  }, [initializeUserGPS]);

  const activePositions = Object.fromEntries(
    Object.entries(realTimePositions).filter(([userId]) => selectedUsers.has(userId))
  );

  // Positions des employés avec localisation
  const employeesWithLocation = users.filter(emp => 
    emp.location && 
    emp.location.coordinates && 
    emp.location.coordinates.length === 2 &&
    selectedUsers.has(emp._id)
  );

  const stats = {
    totalUsers: users.length,
    activeGPS: Object.keys(realTimePositions).length,
    employeesWithLocation: employeesWithLocation.length,
    moving: Object.values(activePositions).filter(p => p.isMoving).length,
    avgAccuracy: Object.values(activePositions).length > 0 
      ? Math.round(Object.values(activePositions).reduce((sum, p) => sum + p.accuracy, 0) / Object.values(activePositions).length)
      : 0,
    totalDistance: Object.values(trackDistances).reduce((sum, dist) => sum + dist, 0)
  };

  if (isLoading) {
    return (
      <div className="gps-loading-screen-3d">
        <div className="loading-animation-3d">
          <div className="gps-satellite-icon-3d">
            <i className="fas fa-satellite-dish"></i>
            <div className="satellite-orbit-loading"></div>
          </div>
          <div className="loading-text-3d">
            <h2>Initialisation GPS Avancé</h2>
            <p>Connexion aux satellites et chargement des positions employés...</p>
            <div className="loading-progress-3d">
              <div className="progress-bar-3d"></div>
            </div>
            <div className="loading-stats">
              <div className="loading-stat">
                <i className="fas fa-satellite"></i>
                <span>Géolocalisation</span>
              </div>
              <div className="loading-stat">
                <i className="fas fa-users"></i>
                <span>Positions employés</span>
              </div>
              <div className="loading-stat">
                <i className="fas fa-cloud-sun"></i>
                <span>Données météo</span>
              </div>
              <div className="loading-stat">
                <i className="fas fa-map"></i>
                <span>Cartographie 3D</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="gps-error-screen-3d">
        <div className="error-content-3d">
          <i className="fas fa-user-lock"></i>
          <h3>Accès GPS Sécurisé</h3>
          <p>Authentification requise pour accéder au système de géolocalisation avancé.</p>
        </div>
      </div>
    );
  }

  return (
    <div 
      className="gps-realtime-container-3d"
      onMouseMove={resetControlsTimeout}
      onClick={resetControlsTimeout}
    >
      <div className="gps-realtime-map-3d">
        <MapContainer
          center={[46.603354, 1.888334]}
          zoom={6}
          className="leaflet-realtime-map-3d"
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
            weatherData={weatherData}
            locationDescriptions={locationDescriptions}
            allEmployees={users}
          />

          {/* MARQUEURS DES POSITIONS D'EMPLOYÉS (STATIQUES) */}
          {showEmployeePositions && employeesWithLocation.map(employee => {
            const hasGPS = realTimePositions[employee._id];
            if (hasGPS) return null; // Ne pas afficher si GPS actif
            
            return (
              <Marker
                key={`employee-pos-${employee._id}`}
                position={[employee.location.coordinates[1], employee.location.coordinates[0]]}
                icon={createEmployeeIcon(
                  userColors[employee._id],
                  `${employee.firstName} ${employee.lastName}`,
                  employee.role,
                  employee.isOnline
                )}
                zIndexOffset={100}
              >
                <Popup maxWidth={400} className="employee-popup-3d">
                  <div className="employee-popup-content-3d">
                    <div className="employee-popup-header-3d">
                      <div 
                        className="employee-avatar-popup-3d"
                        style={{ backgroundColor: userColors[employee._id] }}
                      >
                        <span className="employee-initials-popup">{employee.firstName[0]}{employee.lastName[0]}</span>
                        <div className={`status-indicator-popup ${employee.isOnline ? 'online' : 'offline'}`}>
                          <i className={`fas ${employee.isOnline ? 'fa-circle' : 'fa-circle'}`}></i>
                        </div>
                      </div>
                      <div className="employee-info-popup-3d">
                        <h4>{employee.firstName} {employee.lastName}</h4>
                        <span className={`role-badge-popup-3d ${employee.role}`}>
                          {employee.role === 'admin' ? '👑 Admin' :
                           employee.role === 'manager' ? '💼 Manager' :
                           employee.role === 'supervisor' ? '👨‍💼 Superviseur' :
                           '👤 Employé'}
                        </span>
                        <div className={`online-status-popup-3d ${employee.isOnline ? 'online' : 'offline'}`}>
                          <i className={`fas ${employee.isOnline ? 'fa-wifi' : 'fa-wifi-slash'}`}></i>
                          {employee.isOnline ? 'En ligne' : 'Hors ligne'}
                        </div>
                      </div>
                    </div>
                    
                    <div className="employee-details-popup-3d">
                      <div className="employee-contact-3d">
                        <h5><i className="fas fa-address-card"></i> Informations</h5>
                        <div className="contact-info-3d">
                          <div className="contact-item-3d">
                            <i className="fas fa-envelope"></i>
                            <span>{employee.email}</span>
                          </div>
                          {employee.phone && (
                            <div className="contact-item-3d">
                              <i className="fas fa-phone"></i>
                              <span>{employee.phone}</span>
                            </div>
                          )}
                          {employee.department && (
                            <div className="contact-item-3d">
                              <i className="fas fa-building"></i>
                              <span>{employee.department}</span>
                            </div>
                          )}
                        </div>
                      </div>
                      
                      <div className="employee-location-info-3d">
                        <h5><i className="fas fa-map-marker-alt"></i> Position assignée</h5>
                        <div className="location-details-popup-3d">
                          <div className="coordinates-3d">
                            <i className="fas fa-crosshairs"></i>
                            <span>{employee.location.coordinates[1].toFixed(6)}, {employee.location.coordinates[0].toFixed(6)}</span>
                          </div>
                          {employee.location.address && (
                            <div className="address-3d">
                              <i className="fas fa-home"></i>
                              <span>{employee.location.address}</span>
                            </div>
                          )}
                          {employee.workLocation && (
                            <div className="work-location-3d">
                              <i className="fas fa-briefcase"></i>
                              <span>{employee.workLocation}</span>
                            </div>
                          )}
                        </div>
                      </div>
                      
                      {employee.lastActivity && (
                        <div className="employee-activity-3d">
                          <h5><i className="fas fa-clock"></i> Dernière activité</h5>
                          <div className="activity-time-3d">
                            {new Date(employee.lastActivity).toLocaleString('fr-FR')}
                          </div>
                        </div>
                      )}
                      
                      <div className="employee-actions-3d">
                        <button 
                          className="action-btn-3d contact-btn"
                          onClick={() => window.location.href = `mailto:${employee.email}`}
                        >
                          <i className="fas fa-envelope"></i>
                          Contacter
                        </button>
                        {employee.phone && (
                          <button 
                            className="action-btn-3d call-btn"
                            onClick={() => window.location.href = `tel:${employee.phone}`}
                          >
                            <i className="fas fa-phone"></i>
                            Appeler
                          </button>
                        )}
                        <button 
                          className="action-btn-3d center-btn"
                          onClick={() => {
                            if (mapInstance) {
                              mapInstance.setView([employee.location.coordinates[1], employee.location.coordinates[0]], 16);
                            }
                          }}
                        >
                          <i className="fas fa-crosshairs"></i>
                          Centrer
                        </button>
                      </div>
                    </div>
                  </div>
                </Popup>
              </Marker>
            );
          })}

          {/* Trajectoires GPS en jaune avec distances */}
          {showTracks && Object.entries(userTracks).map(([userId, track]) => {
            if (!selectedUsers.has(userId) || track.length < 2) return null;
            
            const trackPoints = track.map(point => [point.lat, point.lng]);
            const totalDistance = trackDistances[userId] || 0;
            
            return (
              <React.Fragment key={`track-${userId}`}>
                <Polyline
                  positions={trackPoints}
                  color="#FFD700"
                  weight={6}
                  opacity={0.9}
                  smoothFactor={2}
                  className="gps-track-line-3d"
                >
                  <Tooltip permanent direction="center" className="track-distance-tooltip">
                    <div className="distance-info">
                      <i className="fas fa-route"></i>
                      <span>{(totalDistance / 1000).toFixed(2)} km</span>
                    </div>
                  </Tooltip>
                </Polyline>
                
                {/* Points de repère sur le trajet */}
                {track.filter((_, index) => index % 10 === 0).map((point, index) => (
                  <Circle
                    key={`waypoint-${userId}-${index}`}
                    center={[point.lat, point.lng]}
                    radius={2}
                    color="#FFD700"
                    fillColor="#FFD700"
                    fillOpacity={0.8}
                    weight={2}
                  />
                ))}
              </React.Fragment>
            );
          })}

          {/* Marqueurs de lieux avec descriptions 3D */}
          {Object.entries(locationDescriptions).map(([key, description]) => {
            const [lat, lng] = key.split('_').map(Number);
            if (!lat || !lng) return null;
            
            return (
              <Marker
                key={`location-${key}`}
                position={[lat, lng]}
                icon={createLocationMarker3D(description, description.category)}
                zIndexOffset={50}
              >
                <Popup className="location-popup-3d">
                  <div className="location-popup-content-3d">
                    <h4>{description.title}</h4>
                    <p className="location-description">{description.description}</p>
                    {description.details.length > 0 && (
                      <ul className="location-details">
                        {description.details.map((detail, index) => (
                          <li key={index}>{detail}</li>
                        ))}
                      </ul>
                    )}
                  </div>
                </Popup>
              </Marker>
            );
          })}

          {/* Marqueurs GPS temps réel avec météo */}
          {Object.entries(activePositions).map(([userId, position]) => {
            const userData = users.find(u => u._id === userId);
            if (!userData) return null;

            const cacheKey = `${position.lat.toFixed(4)}_${position.lng.toFixed(4)}`;
            const weather = weatherData[cacheKey];

            return (
              <React.Fragment key={`gps-3d-${userId}`}>
                {/* Zone météo */}
                {weather && (
                  <Circle
                    center={[position.lat, position.lng]}
                    radius={500}
                    color={weather.main === 'rain' ? '#4A90E2' : weather.main === 'clear' ? '#F5A623' : '#7ED321'}
                    fillColor={weather.main === 'rain' ? '#4A90E2' : weather.main === 'clear' ? '#F5A623' : '#7ED321'}
                    fillOpacity={0.1}
                    weight={2}
                    opacity={0.3}
                    className="weather-zone"
                  />
                )}
                
                {/* Cercle de précision amélioré */}
                <Circle
                  center={[position.lat, position.lng]}
                  radius={position.accuracy}
                  color={userColors[userId]}
                  fillColor={userColors[userId]}
                  fillOpacity={0.15}
                  weight={3}
                  opacity={0.7}
                  className="accuracy-circle-3d"
                />
                
                {/* Marqueur principal 3D */}
                <Marker
                  position={[position.lat, position.lng]}
                  icon={createRealGPSIcon(
                    userColors[userId],
                    `${userData.firstName} ${userData.lastName}`,
                    position.isMoving,
                    position.heading,
                    position.accuracy,
                    weather
                  )}
                  zIndexOffset={position.user._id === user?._id ? 2000 : 500}
                >
                  <Popup maxWidth={600} className="gps-realtime-popup-3d">
                    <div className="popup-realtime-content-3d">
                      <div className="popup-header-realtime-3d">
                        <div 
                          className="user-avatar-realtime-3d"
                          style={{ backgroundColor: userColors[userId] }}
                        >
                          <span className="user-initials">{userData.firstName[0]}{userData.lastName[0]}</span>
                          <div className="avatar-glow"></div>
                        </div>
                        <div className="popup-user-info-3d">
                          <h4>
                            {userData.firstName} {userData.lastName}
                            {userData._id === user?._id && (
                              <span className="current-user-tag-3d">Vous</span>
                            )}
                          </h4>
                          <span className={`role-tag-3d ${userData.role}`}>
                            {userData.role}
                          </span>
                          <div className={`movement-status-3d ${position.isMoving ? 'moving' : 'stationary'}`}>
                            <i className={`fas ${position.isMoving ? 'fa-running' : 'fa-map-pin'}`}></i>
                            {position.isMoving ? 'En déplacement' : 'Stationnaire'}
                            <span className="speed-indicator">{Math.round(position.speed)} km/h</span>
                          </div>
                        </div>
                        <div className="gps-quality-indicator-3d">
                          <div className={`signal-quality-3d ${
                            position.accuracy < 5 ? 'excellent' :
                            position.accuracy < 15 ? 'good' :
                            position.accuracy < 30 ? 'fair' : 'poor'
                          }`}>
                            <i className="fas fa-satellite"></i>
                            <span>GPS</span>
                          </div>
                        </div>
                      </div>
                      
                      {/* Section météo */}
                      {weather && (
                        <div className="weather-section-3d">
                          <h5><i className="fas fa-cloud-sun"></i> Conditions Météo</h5>
                          <div className="weather-display">
                            <div className="weather-main">
                              <span className="weather-icon-large">{weather.icon}</span>
                              <div className="weather-temp-large">{weather.temperature}°C</div>
                              <div className="weather-desc">{weather.description}</div>
                            </div>
                            <div className="weather-details">
                              <div className="weather-detail">
                                <i className="fas fa-tint"></i>
                                <span>Humidité: {weather.humidity}%</span>
                              </div>
                              <div className="weather-detail">
                                <i className="fas fa-wind"></i>
                                <span>Vent: {weather.windSpeed} km/h</span>
                              </div>
                              <div className="weather-detail">
                                <i className="fas fa-thermometer-half"></i>
                                <span>Pression: {weather.pressure} hPa</span>
                              </div>
                            </div>
                          </div>
                        </div>
                      )}
                      
                      <div className="location-info-realtime-3d">
                        <div className="address-section-3d">
                          <h5><i className="fas fa-map-marker-alt"></i> Localisation 3D</h5>
                          <div className="address-details-3d">
                            <p className="full-address-3d">{position.address.fullAddress}</p>
                            {position.address.street && (
                              <p className="street-3d">{position.address.street}</p>
                            )}
                            <p className="city-district-3d">
                              {position.address.city}
                              {position.address.district && `, ${position.address.district}`}
                            </p>
                            {position.address.amenity && (
                              <p className="amenity-3d">
                                <i className="fas fa-info-circle"></i>
                                {position.address.amenity}
                              </p>
                            )}
                          </div>
                        </div>
                        
                        {/* Description 3D du lieu */}
                        {position.address.description3D && (
                          <div className="location-description-3d">
                            <h5><i className="fas fa-cube"></i> Description 3D</h5>
                            <div className="description-content">
                              <h6>{position.address.description3D.title}</h6>
                              <p>{position.address.description3D.description}</p>
                              {position.address.description3D.details.length > 0 && (
                                <ul className="location-features">
                                  {position.address.description3D.details.map((detail, index) => (
                                    <li key={index}>{detail}</li>
                                  ))}
                                </ul>
                              )}
                            </div>
                          </div>
                        )}
                        
                        <div className="gps-metrics-realtime-3d">
                          <h5><i className="fas fa-satellite"></i> Données GPS Avancées</h5>
                          <div className="metrics-grid-realtime-3d">
                            <div className="metric-item-3d">
                              <i className="fas fa-crosshairs"></i>
                              <span className="metric-label">Précision</span>
                              <span className="metric-value">±{Math.round(position.accuracy)}m</span>
                            </div>
                            <div className="metric-item-3d">
                              <i className="fas fa-tachometer-alt"></i>
                              <span className="metric-label">Vitesse</span>
                              <span className="metric-value">{Math.round(position.speed)} km/h</span>
                            </div>
                            <div className="metric-item-3d">
                              <i className="fas fa-compass"></i>
                              <span className="metric-label">Direction</span>
                              <span className="metric-value">{Math.round(position.heading)}°</span>
                            </div>
                            {position.altitude && (
                              <div className="metric-item-3d">
                                <i className="fas fa-mountain"></i>
                                <span className="metric-label">Altitude</span>
                                <span className="metric-value">{Math.round(position.altitude)}m</span>
                              </div>
                            )}
                            <div className="metric-item-3d">
                              <i className="fas fa-clock"></i>
                              <span className="metric-label">Dernière MAJ</span>
                              <span className="metric-value">{formatDateTime(position.timestamp)}</span>
                            </div>
                            <div className="metric-item-3d">
                              <i className="fas fa-route"></i>
                              <span className="metric-label">Distance parcourue</span>
                              <span className="metric-value">{((trackDistances[userId] || 0) / 1000).toFixed(2)} km</span>
                            </div>
                            <div className="metric-item-3d">
                              <i className="fas fa-map"></i>
                              <span className="metric-label">Coordonnées</span>
                              <span className="metric-value coordinates-text-3d">
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

      {/* Interface overlay avec contrôles 3D */}
      <div className={`gps-interface-overlay-3d ${controlsVisible ? 'visible' : 'hidden'}`}>
        {/* Header avec statut GPS */}
        <div className="gps-header-realtime-3d">
          <div className="header-info-3d">
            <h1>
              <i className="fas fa-satellite"></i>
              GPS Temps Réel 3D
              <div className="live-indicator-3d">
                <span className="live-dot-3d"></span>
                LIVE
              </div>
            </h1>
            <div className="connection-status-3d">
              <div className={`status-indicator-3d ${connectionStatus}`}>
                <div className="status-dot-3d"></div>
                <span>
                  {connectionStatus === 'connected' ? 'GPS Connecté' :
                   connectionStatus === 'initializing' ? 'Initialisation...' :
                   'Connexion GPS'}
                </span>
              </div>
              <div className="current-time-3d">
                {new Date().toLocaleTimeString('fr-FR')}
              </div>
            </div>
          </div>
          
          <div className="stats-realtime-3d">
            <div className="stat-card-3d">
              <div className="stat-icon-3d"><i className="fas fa-users"></i></div>
              <div className="stat-content-3d">
                <div className="stat-number-3d">{stats.activeGPS}</div>
                <div className="stat-label-3d">GPS Actifs</div>
              </div>
            </div>
            <div className="stat-card-3d">
              <div className="stat-icon-3d"><i className="fas fa-map-marker-alt"></i></div>
              <div className="stat-content-3d">
                <div className="stat-number-3d">{stats.employeesWithLocation}</div>
                <div className="stat-label-3d">Positions fixes</div>
              </div>
            </div>
            <div className="stat-card-3d">
              <div className="stat-icon-3d"><i className="fas fa-running"></i></div>
              <div className="stat-content-3d">
                <div className="stat-number-3d">{stats.moving}</div>
                <div className="stat-label-3d">En mouvement</div>
              </div>
            </div>
            <div className="stat-card-3d">
              <div className="stat-icon-3d"><i className="fas fa-crosshairs"></i></div>
              <div className="stat-content-3d">
                <div className="stat-number-3d">±{stats.avgAccuracy}m</div>
                <div className="stat-label-3d">Précision moy.</div>
              </div>
            </div>
            <div className="stat-card-3d">
              <div className="stat-icon-3d"><i className="fas fa-route"></i></div>
              <div className="stat-content-3d">
                <div className="stat-number-3d">{(stats.totalDistance / 1000).toFixed(1)}km</div>
                <div className="stat-label-3d">Distance totale</div>
              </div>
            </div>
          </div>
        </div>

        {/* Contrôles de carte 3D */}
        <div className="gps-map-controls-3d">
          <div className="controls-section-3d">
            <label className="control-toggle-3d">
              <input
                type="checkbox"
                checked={autoCenter}
                onChange={(e) => setAutoCenter(e.target.checked)}
              />
              <span className="toggle-slider-3d"></span>
              <span className="toggle-label-3d">
                <i className="fas fa-crosshairs"></i>
                Auto-centrage
              </span>
            </label>
            
            <label className="control-toggle-3d">
              <input
                type="checkbox"
                checked={showTracks}
                onChange={(e) => setShowTracks(e.target.checked)}
              />
              <span className="toggle-slider-3d"></span>
              <span className="toggle-label-3d">
                <i className="fas fa-route"></i>
                Trajectoires
              </span>
            </label>
            
            <label className="control-toggle-3d">
              <input
                type="checkbox"
                checked={showEmployeePositions}
                onChange={(e) => setShowEmployeePositions(e.target.checked)}
              />
              <span className="toggle-slider-3d"></span>
              <span className="toggle-label-3d">
                <i className="fas fa-users"></i>
                Positions employés
              </span>
            </label>
            
            <select 
              value={trackingMode} 
              onChange={(e) => setTrackingMode(e.target.value)}
              className="tracking-mode-select-3d"
            >
              <option value="close">Vue rapprochée</option>
              <option value="normal">Vue normale</option>
              <option value="wide">Vue étendue</option>
            </select>
          </div>
        </div>

        {/* Liste des utilisateurs avec météo */}
        <div className="users-panel-realtime-3d">
          <div className="panel-header-3d">
            <h3>
              <i className="fas fa-satellite-dish"></i>
              Utilisateurs GPS 3D ({Object.keys(activePositions).length + employeesWithLocation.length})
            </h3>
          </div>
          
          <div className="users-list-realtime-3d">
            {users.map(userData => {
              const position = realTimePositions[userData._id];
              const error = gpsErrors[userData._id];
              const permission = gpsPermissions[userData._id];
              const isCurrentUser = userData._id === user?._id;
              const cacheKey = position ? `${position.lat.toFixed(4)}_${position.lng.toFixed(4)}` : null;
              const weather = cacheKey ? weatherData[cacheKey] : null;
              const hasStaticLocation = userData.location && userData.location.coordinates;
              
              return (
                <div 
                  key={userData._id}
                  className={`user-item-realtime-3d ${selectedUsers.has(userData._id) ? 'selected' : ''} ${isCurrentUser ? 'current' : ''}`}
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
                  <div className="user-avatar-item-3d" style={{ backgroundColor: userColors[userData._id] }}>
                    <span className="user-initials-item">{userData.firstName[0]}{userData.lastName[0]}</span>
                    {position && (
                      <div className={`activity-indicator-3d ${position.isMoving ? 'moving' : 'stationary'}`}>
                        <i className={`fas ${position.isMoving ? 'fa-running' : 'fa-map-pin'}`}></i>
                      </div>
                    )}
                    {!position && hasStaticLocation && (
                      <div className="static-location-indicator-3d">
                        <i className="fas fa-building"></i>
                      </div>
                    )}
                    {weather && (
                      <div className="weather-indicator-mini">
                        <span>{weather.icon}</span>
                      </div>
                    )}
                    <div className={`online-status-mini ${userData.isOnline ? 'online' : 'offline'}`}>
                      <i className={`fas ${userData.isOnline ? 'fa-circle' : 'fa-circle'}`}></i>
                    </div>
                  </div>
                  
                  <div className="user-details-realtime-3d">
                    <div className="user-name-3d">
                      {userData.firstName} {userData.lastName}
                      {isCurrentUser && <span className="you-badge-3d">Vous</span>}
                    </div>
                    <div className="user-role-3d">{userData.role}</div>
                    
                    {position ? (
                      <div className="position-summary-3d">
                        <div className="location-text-3d gps-active">
                          <i className="fas fa-satellite"></i>
                          GPS: {position.address.city || 'Localisation...'}
                        </div>
                        <div className="gps-quality-3d">
                          <i className="fas fa-crosshairs"></i>
                          ±{Math.round(position.accuracy)}m
                        </div>
                        {weather && (
                          <div className="weather-mini">
                            <span>{weather.icon} {weather.temperature}°C</span>
                          </div>
                        )}
                        <div className="distance-traveled">
                          <i className="fas fa-route"></i>
                          {((trackDistances[userData._id] || 0) / 1000).toFixed(2)} km
                        </div>
                        <div className="last-update-3d">
                          {formatDateTime(position.timestamp)}
                        </div>
                      </div>
                    ) : hasStaticLocation ? (
                      <div className="position-summary-3d static">
                        <div className="location-text-3d static-location">
                          <i className="fas fa-map-marker-alt"></i>
                          Position fixe assignée
                        </div>
                        <div className="static-coordinates">
                          <i className="fas fa-crosshairs"></i>
                          {userData.location.coordinates[1].toFixed(4)}, {userData.location.coordinates[0].toFixed(4)}
                        </div>
                        {userData.location.address && (
                          <div className="static-address">
                            <i className="fas fa-home"></i>
                            {userData.location.address}
                          </div>
                        )}
                        <div className={`online-status-text ${userData.isOnline ? 'online' : 'offline'}`}>
                          <i className={`fas ${userData.isOnline ? 'fa-wifi' : 'fa-wifi-slash'}`}></i>
                          {userData.isOnline ? 'En ligne' : 'Hors ligne'}
                        </div>
                      </div>
                    ) : error ? (
                      <div className="error-status-3d">
                        <i className="fas fa-exclamation-triangle"></i>
                        {error}
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            retryUserGPS(userData);
                          }}
                          className="retry-btn-small-3d"
                        >
                          <i className="fas fa-redo"></i>
                        </button>
                      </div>
                    ) : (
                      <div className="loading-status-3d">
                        <i className="fas fa-spinner fa-spin"></i>
                        Recherche GPS...
                      </div>
                    )}
                  </div>
                  
                  <div className="user-status-indicators-3d">
                    <div className={`gps-status-icon-3d ${permission || 'unknown'}`}>
                      <i className={`fas ${
                        permission === 'granted' ? 'fa-satellite' :
                        permission === 'denied' ? 'fa-times-circle' :
                        hasStaticLocation ? 'fa-map-marker-alt' :
                        'fa-clock'
                      }`}></i>
                    </div>
                    {position && (
                      <div className={`signal-strength-3d ${
                        position.accuracy < 5 ? 'excellent' :
                        position.accuracy < 15 ? 'good' :
                        position.accuracy < 30 ? 'fair' : 'poor'
                      }`}>
                        <div className="signal-bar-3d bar1"></div>
                        <div className="signal-bar-3d bar2"></div>
                        <div className="signal-bar-3d bar3"></div>
                        <div className="signal-bar-3d bar4"></div>
                      </div>
                    )}
                    {!position && hasStaticLocation && (
                      <div className="static-location-icon-3d">
                        <i className="fas fa-building"></i>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Légende et aide améliorées */}
        <div className="gps-legend-help-3d">
          <div className="legend-content-3d">
            <h4><i className="fas fa-info-circle"></i> Légende 3D</h4>
            <div className="legend-items-3d">
              <div className="legend-item-3d">
                <div className="legend-icon-3d gps-active-3d"></div>
                <span>GPS Actif</span>
              </div>
              <div className="legend-item-3d">
                <div className="legend-icon-3d employee-static-3d"></div>
                <span>Position employé fixe</span>
              </div>
              <div className="legend-item-3d">
                <div className="legend-icon-3d gps-moving-3d"></div>
                <span>En mouvement</span>
              </div>
              <div className="legend-item-3d">
                <div className="legend-icon-3d gps-stationary-3d"></div>
                <span>Stationnaire</span>
              </div>
              <div className="legend-item-3d">
                <div className="legend-icon-3d gps-track-3d"></div>
                <span>Trajectoire (jaune)</span>
              </div>
              <div className="legend-item-3d">
                <div className="legend-icon-3d weather-zone-icon"></div>
                <span>Zone météo</span>
              </div>
              <div className="legend-item-3d">
                <div className="legend-icon-3d location-3d-icon"></div>
                <span>Lieu 3D</span>
              </div>
              <div className="legend-item-3d">
                <div className="legend-icon-3d online-status-icon"></div>
                <span>Status en ligne</span>
              </div>
            </div>
          </div>
          
          <div className="help-content-3d">
            <h4><i className="fas fa-keyboard"></i> Raccourcis</h4>
            <div className="shortcut-item-3d">
              <kbd>Espace</kbd> <span>Auto-centrage on/off</span>
            </div>
            <div className="shortcut-item-3d">
              <kbd>Ctrl+T</kbd> <span>Trajectoires on/off</span>
            </div>
            <div className="shortcut-item-3d">
              <kbd>Ctrl+E</kbd> <span>Positions employés on/off</span>
            </div>
            <div className="shortcut-item-3d">
              <kbd>Ctrl+C</kbd> <span>Contrôles on/off</span>
            </div>
            <div className="shortcut-item-3d">
              <kbd>Échap</kbd> <span>Masquer contrôles</span>
            </div>
          </div>
        </div>
      </div>

      {/* Contrôles de zoom flottants 3D */}
      <div className="floating-zoom-controls-3d">
        <button 
          onClick={() => mapInstance?.zoomIn()}
          className="zoom-btn-3d zoom-in-3d"
          title="Zoom avant"
        >
          <i className="fas fa-plus"></i>
        </button>
        <button 
          onClick={() => mapInstance?.zoomOut()}
          className="zoom-btn-3d zoom-out-3d"
          title="Zoom arrière"
        >
          <i className="fas fa-minus"></i>
        </button>
        <button 
          onClick={() => {
            const allPositions = [];
            
            // Positions GPS
            Object.values(activePositions).forEach(pos => {
              allPositions.push({ lat: pos.lat, lng: pos.lng });
            });
            
            // Positions fixes des employés
            employeesWithLocation.forEach(emp => {
              allPositions.push({ 
                lat: emp.location.coordinates[1], 
                lng: emp.location.coordinates[0] 
              });
            });
            
            if (allPositions.length > 0) {
              const lats = allPositions.map(p => p.lat);
              const lngs = allPositions.map(p => p.lng);
              const bounds = [
                [Math.min(...lats), Math.min(...lngs)],
                [Math.max(...lats), Math.max(...lngs)]
              ];
              mapInstance?.fitBounds(bounds, { padding: [100, 100] });
            }
          }}
          className="zoom-btn-3d zoom-fit-3d"
          title="Centrer sur tous"
        >
          <i className="fas fa-expand-arrows-alt"></i>
        </button>
        <button 
          onClick={() => {
            const currentUserPosition = currentUser ? realTimePositions[currentUser._id] : null;
            if (currentUserPosition && mapInstance) {
              mapInstance.setView([currentUserPosition.lat, currentUserPosition.lng], 17);
            } else if (currentUser?.location?.coordinates) {
              mapInstance.setView([currentUser.location.coordinates[1], currentUser.location.coordinates[0]], 17);
            }
          }}
          className="zoom-btn-3d zoom-location-3d"
          title="Ma position"
          disabled={!currentUser || (!realTimePositions[currentUser?._id] && !currentUser?.location?.coordinates)}
        >
          <i className="fas fa-location-arrow"></i>
        </button>
      </div>

      {/* Notifications temps réel 3D */}
      <div className="realtime-notifications-3d">
        {Object.values(activePositions)
          .filter(position => position.address?.amenity || position.weather)
          .slice(0, 3)
          .map((position, index) => (
            <div 
              key={`notification-3d-${position.user._id}`}
              className="notification-realtime-3d"
              style={{ 
                animationDelay: `${index * 0.3}s`,
                borderLeftColor: userColors[position.user._id]
              }}
            >
              <div className="notification-icon-3d">
                <i className="fas fa-location-dot"></i>
              </div>
              <div className="notification-text-3d">
                <div className="notification-title-3d">
                  {position.user.firstName} {position.user.lastName}
                </div>
                <div className="notification-message-3d">
                  {position.address.amenity ? `Détecté: ${position.address.amenity}` : 
                   position.weather ? `Météo: ${position.weather.description}` : 
                   'Position mise à jour'}
                </div>
                <div className="notification-time-3d">
                  {formatDateTime(position.timestamp)}
                </div>
                {position.weather && (
                  <div className="notification-weather">
                    {position.weather.icon} {position.weather.temperature}°C
                  </div>
                )}
              </div>
            </div>
          ))}
      </div>

      {/* Indicateur de performance GPS 3D */}
      <div className="gps-performance-bar-3d">
        <div className="perf-item-3d">
          <i className="fas fa-satellite-dish"></i>
          <span className={`status-3d ${connectionStatus}`}>
            {connectionStatus === 'connected' ? 'GPS 3D Connecté' : 'Connexion...'}
          </span>
        </div>
        <div className="perf-item-3d">
          <i className="fas fa-clock"></i>
          <span>MAJ: {new Date().toLocaleTimeString('fr-FR')}</span>
        </div>
        {currentUser && realTimePositions[currentUser._id] && (
          <>
            <div className="perf-item-3d coords-3d">
              <i className="fas fa-crosshairs"></i>
              <span>
                {realTimePositions[currentUser._id].lat.toFixed(4)}, 
                {realTimePositions[currentUser._id].lng.toFixed(4)}
              </span>
            </div>
            {realTimePositions[currentUser._id].weather && (
              <div className="perf-item-3d weather-perf">
                <span>
                  {realTimePositions[currentUser._id].weather.icon} 
                  {realTimePositions[currentUser._id].weather.temperature}°C
                </span>
              </div>
            )}
          </>
        )}
        <div className="perf-item-3d">
          <i className="fas fa-users"></i>
          <span>{Object.keys(activePositions).length} GPS actifs</span>
        </div>
        <div className="perf-item-3d">
          <i className="fas fa-map-marker-alt"></i>
          <span>{employeesWithLocation.length} positions fixes</span>
        </div>
        <div className="perf-item-3d">
          <i className="fas fa-route"></i>
          <span>{(stats.totalDistance / 1000).toFixed(1)} km total</span>
        </div>
      </div>

      {/* Panneau météo global */}
      <div className="global-weather-panel">
        <h4><i className="fas fa-cloud-sun"></i> Météo Zones</h4>
        <div className="weather-zones">
          {Object.values(weatherData).slice(0, 4).map((weather, index) => (
            <div key={index} className="weather-zone-item">
              <span className="weather-icon-zone">{weather.icon}</span>
              <span className="weather-temp-zone">{weather.temperature}°C</span>
              <span className="weather-desc-zone">{weather.description}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Panneau de statistiques avancées */}
      <div className="advanced-stats-panel">
        <h4><i className="fas fa-chart-line"></i> Statistiques Avancées</h4>
        <div className="stats-grid-advanced">
          <div className="advanced-stat-item">
            <div className="stat-icon-advanced">
              <i className="fas fa-satellite"></i>
            </div>
            <div className="stat-content-advanced">
              <div className="stat-title">GPS Actifs</div>
              <div className="stat-value-large">{stats.activeGPS}</div>
              <div className="stat-subtitle">Suivi temps réel</div>
            </div>
          </div>
          
          <div className="advanced-stat-item">
            <div className="stat-icon-advanced">
              <i className="fas fa-building"></i>
            </div>
            <div className="stat-content-advanced">
              <div className="stat-title">Positions Fixes</div>
              <div className="stat-value-large">{stats.employeesWithLocation}</div>
              <div className="stat-subtitle">Employés localisés</div>
            </div>
          </div>
          
          <div className="advanced-stat-item">
            <div className="stat-icon-advanced">
              <i className="fas fa-running"></i>
            </div>
            <div className="stat-content-advanced">
              <div className="stat-title">En Mouvement</div>
              <div className="stat-value-large">{stats.moving}</div>
              <div className="stat-subtitle">Déplacements actifs</div>
            </div>
          </div>
          
          <div className="advanced-stat-item">
            <div className="stat-icon-advanced">
              <i className="fas fa-route"></i>
            </div>
            <div className="stat-content-advanced">
              <div className="stat-title">Distance Totale</div>
              <div className="stat-value-large">{(stats.totalDistance / 1000).toFixed(1)}km</div>
              <div className="stat-subtitle">Parcours cumulé</div>
            </div>
          </div>
          
          <div className="advanced-stat-item">
            <div className="stat-icon-advanced">
              <i className="fas fa-crosshairs"></i>
            </div>
            <div className="stat-content-advanced">
              <div className="stat-title">Précision Moyenne</div>
              <div className="stat-value-large">±{stats.avgAccuracy}m</div>
              <div className="stat-subtitle">Qualité du signal</div>
            </div>
          </div>
          
          <div className="advanced-stat-item">
            <div className="stat-icon-advanced">
              <i className="fas fa-wifi"></i>
            </div>
            <div className="stat-content-advanced">
              <div className="stat-title">En Ligne</div>
              <div className="stat-value-large">{users.filter(u => u.isOnline).length}</div>
              <div className="stat-subtitle">Utilisateurs connectés</div>
            </div>
          </div>
        </div>
      </div>

      {/* Panneau de contrôle rapide */}
      <div className="quick-controls-panel">
        <h4><i className="fas fa-sliders-h"></i> Contrôles Rapides</h4>
        <div className="quick-controls-grid">
          <button 
            className={`quick-control-btn ${autoCenter ? 'active' : ''}`}
            onClick={() => setAutoCenter(!autoCenter)}
            title="Auto-centrage"
          >
            <i className="fas fa-crosshairs"></i>
            <span>Auto-centrage</span>
          </button>
          
          <button 
            className={`quick-control-btn ${showTracks ? 'active' : ''}`}
            onClick={() => setShowTracks(!showTracks)}
            title="Afficher les trajectoires"
          >
            <i className="fas fa-route"></i>
            <span>Trajectoires</span>
          </button>
          
          <button 
            className={`quick-control-btn ${showEmployeePositions ? 'active' : ''}`}
            onClick={() => setShowEmployeePositions(!showEmployeePositions)}
            title="Afficher les positions employés"
          >
            <i className="fas fa-users"></i>
            <span>Employés</span>
          </button>
          
          <button 
            className="quick-control-btn"
            onClick={() => {
              setSelectedUsers(new Set(users.map(u => u._id)));
            }}
            title="Sélectionner tous"
          >
            <i className="fas fa-check-double"></i>
            <span>Tout sélectionner</span>
          </button>
          
          <button 
            className="quick-control-btn"
            onClick={() => {
              setSelectedUsers(new Set());
            }}
            title="Désélectionner tous"
          >
            <i className="fas fa-times"></i>
            <span>Tout désélectionner</span>
          </button>
          
          <button 
            className="quick-control-btn"
            onClick={() => {
              if (mapInstance) {
                const center = mapInstance.getCenter();
                const zoom = mapInstance.getZoom();
                persistentStorage.set(STORAGE_KEYS.MAP_CENTER, [center.lat, center.lng]);
                persistentStorage.set(STORAGE_KEYS.MAP_ZOOM, zoom);
                // Afficher une notification de sauvegarde
                const notification = document.createElement('div');
                notification.className = 'save-notification';
                notification.innerHTML = '<i class="fas fa-save"></i> Vue sauvegardée';
                document.body.appendChild(notification);
                setTimeout(() => notification.remove(), 2000);
              }
            }}
            title="Sauvegarder la vue actuelle"
          >
            <i className="fas fa-save"></i>
            <span>Sauvegarder vue</span>
          </button>
        </div>
      </div>

      {/* Panneau d'informations système */}
      <div className="system-info-panel">
        <div className="system-info-header">
          <h4><i className="fas fa-info-circle"></i> Informations Système</h4>
          <button 
            className="minimize-btn"
            onClick={() => {
              const panel = document.querySelector('.system-info-panel');
              panel.classList.toggle('minimized');
            }}
          >
            <i className="fas fa-minus"></i>
          </button>
        </div>
        <div className="system-info-content">
          <div className="info-item">
            <span className="info-label">Version GPS:</span>
            <span className="info-value">3D Pro v2.1</span>
          </div>
          <div className="info-item">
            <span className="info-label">API Météo:</span>
            <span className="info-value">OpenWeatherMap</span>
          </div>
          <div className="info-item">
            <span className="info-label">Géocodage:</span>
            <span className="info-value">Nominatim OSM</span>
          </div>
          <div className="info-item">
            <span className="info-label">Fréquence MAJ:</span>
            <span className="info-value">800ms</span>
          </div>
          <div className="info-item">
            <span className="info-label">Précision requise:</span>
            <span className="info-value">Haute</span>
          </div>
          <div className="info-item">
            <span className="info-label">Cache positions:</span>
            <span className="info-value">200 points max</span>
          </div>
        </div>
      </div>

      {/* Overlay d'aide contextuelle */}
      <div className="contextual-help-overlay" style={{ display: 'none' }}>
        <div className="help-content">
          <h3><i className="fas fa-question-circle"></i> Aide GPS 3D</h3>
          <div className="help-sections">
            <div className="help-section">
              <h4>Navigation</h4>
              <ul>
                <li>Clic + glisser pour déplacer la carte</li>
                <li>Molette pour zoomer</li>
                <li>Double-clic pour centrer et zoomer</li>
                <li>Clic droit sur un marqueur pour options</li>
              </ul>
            </div>
            <div className="help-section">
              <h4>Marqueurs</h4>
              <ul>
                <li>🛰️ GPS temps réel actif</li>
                <li>👤 Position fixe employé</li>
                <li>🏢 Lieu d'intérêt</li>
                <li>☁️ Zone météorologique</li>
              </ul>
            </div>
            <div className="help-section">
              <h4>Fonctionnalités</h4>
              <ul>
                <li>Suivi GPS temps réel haute précision</li>
                <li>Trajectoires avec distances</li>
                <li>Météo en temps réel</li>
                <li>Descriptions 3D des lieux</li>
                <li>Auto-centrage intelligent</li>
              </ul>
            </div>
          </div>
          <button 
            className="close-help-btn"
            onClick={() => {
              document.querySelector('.contextual-help-overlay').style.display = 'none';
            }}
          >
            <i className="fas fa-times"></i>
            Fermer
          </button>
        </div>
      </div>

      {/* Bouton d'aide flottant */}
      <button 
        className="floating-help-btn"
        onClick={() => {
          document.querySelector('.contextual-help-overlay').style.display = 'flex';
        }}
        title="Aide et documentation"
      >
        <i className="fas fa-question-circle"></i>
      </button>

      {/* Indicateur de connexion réseau */}
      <div className="network-status-indicator">
        <div className={`network-dot ${navigator.onLine ? 'online' : 'offline'}`}></div>
        <span className="network-text">
          {navigator.onLine ? 'En ligne' : 'Hors ligne'}
        </span>
      </div>

      {/* Toast notifications container */}
      <div id="toast-container" className="toast-container"></div>
    </div>
  );
};

export default Gps;
