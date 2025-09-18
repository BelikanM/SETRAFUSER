
import { TileLayer, Marker, Popup, useMapEvents, MapContainer, useMap } from "react-leaflet";
import { useState, useEffect, useRef, useMemo, useContext } from "react";
import { FaLayerGroup, FaCog, FaTimes, FaMapMarkerAlt, FaUser, FaEnvelope, FaLock } from "react-icons/fa";
import io from "socket.io-client";
import * as L from "leaflet";
import "leaflet/dist/leaflet.css";
import axios from "axios";
import { useNavigate, useLocation } from "react-router-dom";
import { v4 as uuidv4 } from 'uuid';
import { UserContext } from '../context/UserContext';

// Socket instance
const socket = io("https://setrafbackend.onrender.com", { withCredentials: true });

// Fix default Leaflet icons
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

const tileOptions = [
  {
    name: "OpenStreetMap",
    url: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
    attribution: '© <a href="https://www.openstreetmap.org/">OSM</a>',
    subdomains: "abc",
  },
  {
    name: "OpenTopoMap",
    url: "https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png",
    attribution: '© <a href="https://opentopomap.org/">OpenTopoMap</a>',
    subdomains: "abc",
  },
  {
    name: "Carto Positron",
    url: "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png",
    attribution: '© <a href="https://carto.com/">Carto</a>',
    subdomains: "abcd",
  },
  {
    name: "Carto Dark Matter",
    url: "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png",
    attribution: '© <a href="https://carto.com/">Carto</a>',
    subdomains: "abcd",
    maxZoom: 19,
  },
  {
    name: "Esri World Imagery (Satellite)",
    url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
    attribution: "Tiles © Esri",
    maxZoom: 19,
  },
  {
    name: "OSM Humanitarian",
    url: "https://{s}.tile.openstreetmap.fr/hot/{z}/{x}/{y}.png",
    attribution: '© <a href="https://www.openstreetmap.fr/">OSM France</a>, Humanitarian OSM',
    subdomains: "abc",
    maxZoom: 20,
  },
  {
    name: "OpenCycleMap",
    url: "https://{s}.tile.thunderforest.com/cycle/{z}/{x}/{y}{r}.png?apikey=1c98397b543d4d3088ae23354ebf4e95",
    attribution: '© <a href="https://www.thunderforest.com/">Thunderforest</a> © <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    subdomains: "abc",
    maxZoom: 22,
  },
  {
    name: "Transport",
    url: "https://{s}.tile.thunderforest.com/transport/{z}/{x}/{y}{r}.png?apikey=1c98397b543d4d3088ae23354ebf4e95",
    attribution: '© <a href="https://www.thunderforest.com/">Thunderforest</a> © <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    subdomains: "abc",
    maxZoom: 22,
  },
  {
    name: "Paysage",
    url: "https://{s}.tile.thunderforest.com/landscape/{z}/{x}/{y}{r}.png?apikey=1c98397b543d4d3088ae23354ebf4e95",
    attribution: '© <a href="https://www.thunderforest.com/">Thunderforest</a> © <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    subdomains: "abc",
    maxZoom: 22,
  },
  {
    name: "En plein air",
    url: "https://{s}.tile.thunderforest.com/outdoors/{z}/{x}/{y}{r}.png?apikey=1c98397b543d4d3088ae23354ebf4e95",
    attribution: '© <a href="https://www.thunderforest.com/">Thunderforest</a> © <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    subdomains: "abc",
    maxZoom: 22,
  },
  {
    name: "Transport sombre",
    url: "https://{s}.tile.thunderforest.com/transport-dark/{z}/{x}/{y}{r}.png?apikey=1c98397b543d4d3088ae23354ebf4e95",
    attribution: '© <a href="https://www.thunderforest.com/">Thunderforest</a> © <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    subdomains: "abc",
    maxZoom: 22,
  },
  {
    name: "Carte de la colonne vertébrale",
    url: "https://{s}.tile.thunderforest.com/spinal-map/{z}/{x}/{y}{r}.png?apikey=1c98397b543d4d3088ae23354ebf4e95",
    attribution: '© <a href="https://www.thunderforest.com/">Thunderforest</a> © <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    subdomains: "abc",
    maxZoom: 22,
  },
  {
    name: "Pionnier",
    url: "https://{s}.tile.thunderforest.com/pioneer/{z}/{x}/{y}{r}.png?apikey=1c98397b543d4d3088ae23354ebf4e95",
    attribution: '© <a href="https://www.thunderforest.com/">Thunderforest</a> © <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    subdomains: "abc",
    maxZoom: 22,
  },
  {
    name: "Atlas mobile",
    url: "https://{s}.tile.thunderforest.com/mobile-atlas/{z}/{x}/{y}{r}.png?apikey=1c98397b543d4d3088ae23354ebf4e95",
    attribution: '© <a href="https://www.thunderforest.com/">Thunderforest</a> © <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    subdomains: "abc",
    maxZoom: 22,
  },
  {
    name: "Quartier",
    url: "https://{s}.tile.thunderforest.com/neighbourhood/{z}/{x}/{y}{r}.png?apikey=1c98397b543d4d3088ae23354ebf4e95",
    attribution: '© <a href="https://www.thunderforest.com/">Thunderforest</a> © <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    subdomains: "abc",
    maxZoom: 22,
  },
  {
    name: "Atlas",
    url: "https://{s}.tile.thunderforest.com/atlas/{z}/{x}/{y}{r}.png?apikey=1c98397b543d4d3088ae23354ebf4e95",
    attribution: '© <a href="https://www.thunderforest.com/">Thunderforest</a> © <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    subdomains: "abc",
    maxZoom: 22,
  },
];

const defaultFilterValues = {
  brightness: 100,
  contrast: 100,
  saturate: 100,
  grayscale: 0,
  sepia: 0,
  hueRotate: 0,
  blur: 0,
  invert: 0,
  opacity: 100,
};

const presets = [
  { name: "Aucun", values: { ...defaultFilterValues } },
  { name: "Grayscale", values: { ...defaultFilterValues, grayscale: 100 } },
  { name: "Sombre", values: { ...defaultFilterValues, brightness: 70 } },
  { name: "Contraste élevé", values: { ...defaultFilterValues, contrast: 150 } },
  { name: "Inversé", values: { ...defaultFilterValues, hueRotate: 180 } },
  { name: "Flou puissant", values: { ...defaultFilterValues, blur: 5 } },
  { name: "Inversion totale", values: { ...defaultFilterValues, invert: 100 } },
  { name: "Sépia intense", values: { ...defaultFilterValues, sepia: 100 } },
  { name: "Saturation extrême", values: { ...defaultFilterValues, saturate: 300 } },
  { name: "Lumineux", values: { ...defaultFilterValues, brightness: 150 } },
  { name: "Contraste extrême", values: { ...defaultFilterValues, contrast: 200 } },
  { name: "Rotation teinte 90°", values: { ...defaultFilterValues, hueRotate: 90 } },
  { name: "Gris contrasté", values: { ...defaultFilterValues, grayscale: 50, contrast: 150 } },
  { name: "Opacité saturée", values: { ...defaultFilterValues, opacity: 60, saturate: 200 } },
  { name: "Sharpen (Texture Améliorée)", values: { ...defaultFilterValues, contrast: 120, brightness: 110 } },
  { name: "Vintage (Texture Rétro)", values: { ...defaultFilterValues, sepia: 50, contrast: 110 } },
  { name: "High Detail (Texture Détaillée)", values: { ...defaultFilterValues, contrast: 150, saturate: 120 } },
  { name: "Night Mode (Texture Nocturne)", values: { ...defaultFilterValues, invert: 100, hueRotate: 180, brightness: 80 } },
  { name: "Embossed (Texture Relief)", values: { ...defaultFilterValues, grayscale: 100, contrast: 200, brightness: 50 } },
];

const getMarkerIcon = (color) => {
  return L.divIcon({
    className: "custom-icon",
    html: `<div style="background-color: ${color}; width: 20px; height: 20px; border-radius: 50%; border: 2px solid black;"></div>`,
    iconSize: [20, 20],
    iconAnchor: [10, 10],
  });
};

const CustomMarker = ({ marker, startEditing }) => {
  const markerRef = useRef(null);
  const timeoutRef = useRef(null);

  useEffect(() => {
    if (markerRef.current) {
      markerRef.current.on("popupopen", (e) => {
        const popupEl = e.popup.getElement();
        if (popupEl) {
          popupEl.addEventListener("mouseenter", () => {
            if (timeoutRef.current) {
              clearTimeout(timeoutRef.current);
              timeoutRef.current = null;
            }
          });
          popupEl.addEventListener("mouseleave", () => {
            markerRef.current.closePopup();
          });
        }
      });
    }
  }, []);

  return (
    <Marker
      ref={markerRef}
      position={[marker.latitude, marker.longitude]}
      icon={getMarkerIcon(marker.color)}
      eventHandlers={{
        mouseover: (e) => e.target.openPopup(),
        mouseout: (e) => {
          timeoutRef.current = setTimeout(() => {
            e.target.closePopup();
          }, 200);
        },
      }}
    >
      <Popup>
        <h3>{marker.title || "Sans titre"}</h3>
        <p>{marker.comment || "Sans commentaire"}</p>
        {marker.photos.map((url, idx) => (
          <img key={idx} src={`https://setrafbackend.onrender.com${url}`} alt="" style={{ width: "100px", margin: "5px" }} />
        ))}
        {marker.videos.map((url, idx) => (
          <video key={idx} src={`https://setrafbackend.onrender.com${url}`} width="100" controls style={{ margin: "5px" }} />
        ))}
        <button onClick={() => startEditing(marker)}>Éditer</button>
      </Popup>
    </Marker>
  );
};

const EnhancedTileLayer = ({ tile, ...otherProps }) => {
  const tileProps = useMemo(
    () => ({
      url: tile.url,
      attribution: tile.attribution,
      subdomains: tile.subdomains || "abc",
      maxZoom: tile.maxZoom || 20,
      maxNativeZoom: tile.maxNativeZoom || undefined,
      updateWhenIdle: false,
      updateWhenZooming: true,
      keepBuffer: 2,
      detectRetina: true,
      crossOrigin: true,
      reuseTiles: true,
      unloadInvisibleTiles: true,
      errorTileUrl: "https://upload.wikimedia.org/wikipedia/commons/6/65/No-Image-Placeholder.svg",
      opacity: 0.95,
      zIndex: 1,
    }),
    [tile]
  );

  return <TileLayer key={tile.name} {...tileProps} {...otherProps} />;
};

const CenterOnUser = ({ latitude, longitude }) => {
  const map = useMap();
  useEffect(() => {
    if (latitude && longitude) {
      map.setView([latitude, longitude], map.getZoom(), { animate: true });
    }
  }, [latitude, longitude, map]);
  return null;
};

const getDeviceInfo = () => {
  const deviceId = localStorage.getItem('deviceId') || uuidv4();
  localStorage.setItem('deviceId', deviceId);
  
  const ua = navigator.userAgent;
  let deviceType = 'desktop';
  let deviceOs = 'unknown';
  let deviceName = 'Web Browser';

  if (/mobile/i.test(ua)) deviceType = 'mobile';
  else if (/tablet/i.test(ua)) deviceType = 'tablet';

  if (/windows/i.test(ua)) deviceOs = 'Windows';
  else if (/mac/i.test(ua)) deviceOs = 'MacOS';
  else if (/linux/i.test(ua)) deviceOs = 'Linux';
  else if (/android/i.test(ua)) deviceOs = 'Android';
  else if (/ios/i.test(ua)) deviceOs = 'iOS';

  return { deviceId, deviceType, deviceName, deviceOs };
};

const GeoTracker = ({ userId }) => {
  const [position, setPosition] = useState({ latitude: null, longitude: null, error: null });
  const lastSent = useRef({ latitude: null, longitude: null });

  useEffect(() => {
    if (!navigator.geolocation || !userId) return;
    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        const { latitude, longitude, accuracy } = pos.coords;
        setPosition({ latitude, longitude, error: null });
        if (latitude !== lastSent.current.latitude || longitude !== lastSent.current.longitude) {
          const deviceInfo = getDeviceInfo();
          console.log("Envoi position au serveur:", latitude, longitude);
          socket.emit("updatePosition", { 
            userId, 
            latitude, 
            longitude, 
            accuracy,
            deviceId: deviceInfo.deviceId,
            deviceType: deviceInfo.deviceType,
            deviceName: deviceInfo.deviceName,
            deviceOs: deviceInfo.deviceOs 
          });
          lastSent.current = { latitude, longitude };
        }
      },
      (err) => setPosition((prev) => ({ ...prev, error: err.message })),
      { enableHighAccuracy: true, maximumAge: 10000, timeout: 5000 }
    );
    return () => navigator.geolocation.clearWatch(watchId);
  }, [userId]);

  return (
    <div>
      {position.error && <p>Erreur: {position.error}</p>}
      {position.latitude && position.longitude ? (
        <p>Latitude: {position.latitude}, Longitude: {position.longitude}</p>
      ) : (
        <p>Chargement de la position...</p>
      )}
    </div>
  );
};

const RegisterForm = ({ setUserId, appVersion = "v1" }) => {
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();
  const { setToken, setUser } = useContext(UserContext);

  const handleRegister = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const formData = new FormData();
      formData.append('firstName', firstName);
      formData.append('lastName', lastName);
      formData.append('email', email);
      formData.append('password', password);
      formData.append('role', 'employee');
      formData.append('appVersion', appVersion);

      await axios.post("https://setrafbackend.onrender.com/api/register", formData);
      // Auto login after register
      const loginRes = await axios.post("https://setrafbackend.onrender.com/api/login", { email, password });
      const token = loginRes.data.token;
      localStorage.setItem('token', token);
      const userRes = await axios.get('https://setrafbackend.onrender.com/api/user/profile', {
        headers: { Authorization: `Bearer ${token}` },
      });
      localStorage.setItem('user', JSON.stringify(userRes.data));
      setToken(token);
      setUser(userRes.data);
      setUserId(userRes.data._id);
      alert(`Inscription réussie pour ${appVersion} ! Veuillez attendre l'approbation de l'administrateur.`);
      navigate("/map");
    } catch (err) {
      setError(err.response?.data?.message || "Erreur lors de l'inscription");
    } finally {
      setLoading(false);
    }
  };

  const css = `
    .register-container {
      display: flex;
      justify-content: center;
      align-items: center;
      min-height: 100vh;
      background: linear-gradient(135deg, #4facfe, #00f2fe);
      padding: 20px;
    }
    .register-form {
      background: white;
      padding: 40px;
      border-radius: 15px;
      box-shadow: 0 10px 25px rgba(0, 0, 0, 0.2);
      width: 100%;
      max-width: 400px;
      display: flex;
      flex-direction: column;
      gap: 20px;
    }
    .register-form h2 {
      text-align: center;
      font-size: 2rem;
      margin-bottom: 10px;
      color: #333;
    }
    .input-group {
      display: flex;
      align-items: center;
      border: 1px solid #ddd;
      padding: 10px 15px;
      border-radius: 10px;
      transition: border 0.3s;
    }
    .input-group:focus-within {
      border-color: #4facfe;
    }
    .input-group .icon {
      margin-right: 10px;
      color: #aaa;
      min-width: 20px;
    }
    .input-group input {
      border: none;
      outline: none;
      flex: 1;
      font-size: 1rem;
    }
    .register-form button {
      padding: 12px;
      background: #4facfe;
      color: white;
      font-size: 1rem;
      font-weight: bold;
      border: none;
      border-radius: 10px;
      cursor: pointer;
      transition: background 0.3s;
    }
    .register-form button:hover {
      background: #00f2fe;
    }
    .register-form button:disabled {
      opacity: 0.6;
      cursor: not-allowed;
    }
    .error {
      color: red;
      text-align: center;
    }
  `;

  return (
    <>
      <style>{css}</style>
      <div className="register-container">
        <form className="register-form" onSubmit={handleRegister}>
          <h2>Inscription</h2>
          {error && <p className="error">{error}</p>}
          <div className="input-group">
            <FaUser className="icon" />
            <input
              type="text"
              placeholder="Prénom"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              required
            />
          </div>
          <div className="input-group">
            <FaUser className="icon" />
            <input
              type="text"
              placeholder="Nom"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              required
            />
          </div>
          <div className="input-group">
            <FaEnvelope className="icon" />
            <input
              type="email"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div className="input-group">
            <FaLock className="icon" />
            <input
              type="password"
              placeholder="Mot de passe"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
          <button type="submit" disabled={loading}>
            {loading ? "Inscription..." : "S'inscrire"}
          </button>
        </form>
      </div>
    </>
  );
};

const LoginForm = ({ setUserId, appVersion = "v1" }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { setToken, setUser, setEmployees, setForms, fetchStats, fetchUsers } = useContext(UserContext);
  const [email, setEmail] = useState(location.state?.email || '');
  const [password, setPassword] = useState('');
  const [verificationCode, setVerificationCode] = useState('');
  const [showCodeInput, setShowCodeInput] = useState(false);
  const [showApprovalMessage, setShowApprovalMessage] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [isDesktop, setIsDesktop] = useState(window.innerWidth > 768);

  useEffect(() => {
    const pendingEmail = localStorage.getItem('pendingApprovalEmail');
    if (pendingEmail) {
      setEmail(pendingEmail);
      setShowApprovalMessage(true);
    }
  }, []);

  useEffect(() => {
    const handleResize = () => {
      setIsDesktop(window.innerWidth > 768);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess('');
    setShowApprovalMessage(false);

    if (showCodeInput) {
      if (verificationCode.length !== 8 || !/^\d{8}$/.test(verificationCode)) {
        setError('Le code de vérification doit être exactement 8 chiffres.');
        setLoading(false);
        return;
      }
      try {
        await axios.post('https://setrafbackend.onrender.com/api/verify-code', { email, code: verificationCode });
      } catch (err) {
        setError(err.response?.data?.message || 'Code de vérification invalide ou expiré.');
        setLoading(false);
        return;
      }
    }

    try {
      const res = await axios.post('https://setrafbackend.onrender.com/api/login', { email, password });
      const token = res.data.token;
      localStorage.setItem('token', token);
      setToken(token);

      const userRes = await axios.get('https://setrafbackend.onrender.com/api/user/profile', {
        headers: { Authorization: `Bearer ${token}` },
      });
      localStorage.setItem('user', JSON.stringify(userRes.data));
      setUser(userRes.data);
      setUserId(userRes.data._id);

      if (userRes.data.role === 'admin' || userRes.data.role === 'manager') {
        const empRes = await axios.get('https://setrafbackend.onrender.com/api/employees', {
          headers: { Authorization: `Bearer ${token}` },
        });
        setEmployees(empRes.data);

        const formsRes = await axios.get('https://setrafbackend.onrender.com/api/forms', {
          headers: { Authorization: `Bearer ${token}` },
        });
        setForms(formsRes.data);
      }
      await fetchStats(token);
      if (userRes.data.role === 'admin') {
        await fetchUsers(token);
      }

      localStorage.removeItem('pendingApprovalEmail');
      socket.emit('authenticate', token);
      alert(`Connexion réussie pour ${appVersion} !`);
      navigate("/map");
    } catch (err) {
      if (err.response?.data?.needsVerification) {
        setShowCodeInput(true);
        setError('Votre compte n\'est pas vérifié. Entrez le code de vérification envoyé par email.');
      } else if (err.response?.data?.needsApproval) {
        setShowApprovalMessage(true);
        localStorage.setItem('pendingApprovalEmail', email);
        setError('Votre compte est en attente d\'approbation par un administrateur.');
      } else {
        setError(err.response?.data?.message || 'Erreur lors de la connexion');
      }
    } finally {
      setLoading(false);
    }
  };

  const css = `
    .whatsapp-container {
      display: flex;
      justify-content: center;
      align-items: center;
      min-height: 100vh;
      background: linear-gradient(135deg, #4facfe, #00f2fe);
      padding: 20px;
    }
    .form-paper {
      background: white;
      padding: 40px;
      border-radius: 15px;
      box-shadow: 0 10px 25px rgba(0, 0, 0, 0.2);
      width: 100%;
      max-width: 400px;
      display: flex;
      flex-direction: column;
      gap: 20px;
    }
    .form-paper h2 {
      text-align: center;
      font-size: 2rem;
      margin-bottom: 10px;
      color: #333;
    }
    .input-field {
      border: 1px solid #ddd;
      padding: 10px 15px;
      border-radius: 10px;
      font-size: 1rem;
      width: 100%;
      box-sizing: border-box;
    }
    .input-field:focus {
      border-color: #4facfe;
      outline: none;
    }
    .whatsapp-button {
      padding: 12px;
      background: #4facfe;
      color: white;
      font-size: 1rem;
      font-weight: bold;
      border: none;
      border-radius: 10px;
      cursor: pointer;
      transition: background 0.3s;
    }
    .whatsapp-button:hover {
      background: #00f2fe;
    }
    .whatsapp-button:disabled {
      opacity: 0.6;
      cursor: not-allowed;
    }
    .error {
      color: red;
      text-align: center;
    }
    .success {
      color: green;
      text-align: center;
    }
    .desktop-version .form-paper {
      max-width: 500px;
      padding: 50px;
    }
  `;

  return (
    <>
      <style>{css}</style>
      <div className={`whatsapp-container ${isDesktop ? 'desktop-version' : 'mobile-version'}`}>
        <div className="form-paper">
          <h2>Connexion</h2>
          {error && <p className="error">{error}</p>}
          {success && <p className="success">{success}</p>}
          {showApprovalMessage && <p className="error">Votre compte est en attente d'approbation. Veuillez patienter jusqu'à ce qu'un administrateur valide votre carte professionnelle.</p>}
          <form onSubmit={handleSubmit}>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Email"
              className="input-field"
              required
            />
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Mot de passe"
              className="input-field"
              required
            />
            {showCodeInput && (
              <input
                type="text"
                value={verificationCode}
                onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, ''))}
                placeholder="Code de vérification (8 chiffres)"
                className="input-field"
                required
                maxLength={8}
                minLength={8}
              />
            )}
            <button type="submit" className="whatsapp-button" disabled={loading}>
              {loading ? 'Chargement...' : showCodeInput ? 'Vérifier et connecter' : 'Se connecter'}
            </button>
          </form>
        </div>
      </div>
    </>
  );
};

const TileLayerControl = () => {
  const [activeTile, setActiveTile] = useState(tileOptions[0]);
  const [hdEnabled, setHdEnabled] = useState(false);
  const [maxZoom, setMaxZoom] = useState(activeTile.maxZoom || 18);
  const [filterValues, setFilterValues] = useState({ ...defaultFilterValues });
  const [showLayerControl, setShowLayerControl] = useState(true);
  const [showHdSettings, setShowHdSettings] = useState(true);
  const [markers, setMarkers] = useState([]);
  const [placingMarker, setPlacingMarker] = useState(false);
  const [showMarkerControl, setShowMarkerControl] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [newMarkerPos, setNewMarkerPos] = useState(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [currentMarker, setCurrentMarker] = useState(null);
  const [titleInput, setTitleInput] = useState("");
  const [commentInput, setCommentInput] = useState("");
  const [colorInput, setColorInput] = useState("#ff0000");
  const [photosFiles, setPhotosFiles] = useState([]);
  const [videosFiles, setVideosFiles] = useState([]);
  const { user } = useContext(UserContext);

  useEffect(() => {
    setMaxZoom(activeTile.maxZoom || 18);
    setFilterValues({ ...defaultFilterValues });
  }, [activeTile]);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) {
      socket.emit('authenticate', token);
      axios.get("https://setrafbackend.onrender.com/api/markers", {
        headers: { Authorization: `Bearer ${token}` },
      }).then(res => setMarkers(res.data));
    }
    socket.on("allMarkers", (data) => setMarkers(data));
    socket.on("newMarker", (marker) => setMarkers((prev) => [...prev, marker]));
    socket.on("markerUpdated", (marker) =>
      setMarkers((prev) =>
        prev.map((m) => (m._id === marker._id ? marker : m))
      )
    );
    socket.on("markerDeleted", (markerId) =>
      setMarkers((prev) => prev.filter((m) => m._id !== markerId))
    );
    return () => {
      socket.off("allMarkers");
      socket.off("newMarker");
      socket.off("markerUpdated");
      socket.off("markerDeleted");
    };
  }, []);

  const toggleHD = () => {
    setHdEnabled(!hdEnabled);
    setMaxZoom(!hdEnabled ? 22 : activeTile.maxZoom || 18);
  };

  const handleMaxZoomChange = (e) => {
    const zoom = parseInt(e.target.value, 10);
    setMaxZoom(zoom);
  };

  const handlePresetChange = (e) => {
    const selectedPreset = presets.find((p) => p.name === e.target.value);
    if (selectedPreset) {
      setFilterValues({ ...selectedPreset.values });
    }
  };

  const updateFilterValue = (key, value) => {
    setFilterValues((prev) => ({ ...prev, [key]: value }));
  };

  const getTileFilter = () => {
    const { brightness, contrast, saturate, grayscale, sepia, hueRotate, blur, invert, opacity } = filterValues;
    return `brightness(${brightness}%) contrast(${contrast}%) saturate(${saturate}%) grayscale(${grayscale}%) sepia(${sepia}%) hue-rotate(${hueRotate}deg) blur(${blur}px) invert(${invert}%) opacity(${opacity}%);`;
  };

  const handleTileLoad = (e) => {
    e.tile.style.filter = getTileFilter();
    e.tile.style.imageRendering = "crisp-edges";
  };

  useMapEvents({
    click: (e) => {
      if (placingMarker) {
        setNewMarkerPos(e.latlng);
        setShowAddModal(true);
        setPlacingMarker(false);
        setTitleInput("");
        setCommentInput("");
        setColorInput("#ff0000");
        setPhotosFiles([]);
        setVideosFiles([]);
      }
    },
  });

  const handleAddSubmit = async () => {
    const token = localStorage.getItem('token');
    const formData = new FormData();
    formData.append("latitude", newMarkerPos.lat);
    formData.append("longitude", newMarkerPos.lng);
    formData.append("title", titleInput);
    formData.append("comment", commentInput);
    formData.append("color", colorInput);
    for (let file of photosFiles) {
      formData.append("photos", file);
    }
    for (let file of videosFiles) {
      formData.append("videos", file);
    }
    try {
      const res = await axios.post("https://setrafbackend.onrender.com/api/markers", formData, {
        headers: { 
          Authorization: `Bearer ${token}`,
          'Content-Type': 'multipart/form-data'
        },
      });
      if (res.status === 200) { // Use res.status to check success
        setShowAddModal(false);
      } else {
        alert("Erreur inattendue lors de l'ajout du marqueur");
      }
    } catch (err) {
      alert(err.response?.data?.message || "Erreur lors de l'ajout du marqueur");
    }
  };

  const startEditing = (marker) => {
    setCurrentMarker(marker);
    setTitleInput(marker.title || "");
    setCommentInput(marker.comment || "");
    setColorInput(marker.color || "#ff0000");
    setPhotosFiles([]);
    setVideosFiles([]);
    setShowEditModal(true);
  };

  const handleEditSubmit = async () => {
    const token = localStorage.getItem('token');
    const formData = new FormData();
    formData.append("title", titleInput);
    formData.append("comment", commentInput);
    formData.append("color", colorInput);
    for (let file of photosFiles) {
      formData.append("photos", file);
    }
    for (let file of videosFiles) {
      formData.append("videos", file);
    }
    try {
      const res = await axios.put(`https://setrafbackend.onrender.com/api/markers/${currentMarker._id}`, formData, {
        headers: { 
          Authorization: `Bearer ${token}`,
          'Content-Type': 'multipart/form-data'
        },
      });
      if (res.status === 200) { // Use res.status to check success
        setShowEditModal(false);
      } else {
        alert("Erreur inattendue lors de la mise à jour du marqueur");
      }
    } catch (err) {
      alert(err.response?.data?.message || "Erreur lors de la mise à jour du marqueur");
    }
  };

  const panelStyle = {
    backgroundColor: "white",
    padding: "10px",
    borderRadius: "8px",
    zIndex: 1000,
    boxShadow: "0 2px 6px rgba(0,0,0,0.3)",
  };

  const toggleButtonStyle = {
    backgroundColor: "white",
    padding: "5px",
    borderRadius: "50%",
    border: "none",
    cursor: "pointer",
    zIndex: 1000,
    boxShadow: "0 2px 6px rgba(0,0,0,0.3)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  };

  const modalStyle = {
    position: "fixed",
    top: 0,
    left: 0,
    width: "100%",
    height: "100%",
    backgroundColor: "rgba(0,0,0,0.5)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 1001,
  };

  const modalContentStyle = {
    backgroundColor: "white",
    padding: "20px",
    borderRadius: "8px",
    width: "300px",
  };

  return (
    <>
      <EnhancedTileLayer
        tile={activeTile}
        maxZoom={maxZoom}
        eventHandlers={{
          tileload: handleTileLoad,
        }}
      />
      {user && user.isVerified && user.isApproved && markers.map((marker) => (
        <CustomMarker key={marker._id} marker={marker} startEditing={startEditing} />
      ))}
      {showLayerControl ? (
        <div style={{ position: "absolute", top: 10, right: 10, ...panelStyle }}>
          <button
            onClick={() => setShowLayerControl(false)}
            style={{ position: "absolute", top: 5, right: 5, background: "none", border: "none", cursor: "pointer" }}
          >
            <FaTimes />
          </button>
          <h4><FaLayerGroup /> Couches</h4>
          {tileOptions.map((tile) => (
            <button
              key={tile.name}
              onClick={() => setActiveTile(tile)}
              style={{
                display: "block",
                margin: "5px 0",
                width: "100%",
                padding: "5px 10px",
                borderRadius: "4px",
                border: "none",
                cursor: "pointer",
                backgroundColor: activeTile.name === tile.name ? "#007bff" : "#eee",
                color: activeTile.name === tile.name ? "#fff" : "#000",
              }}
            >
              {tile.name}
            </button>
          ))}
        </div>
      ) : (
        <button
          onClick={() => setShowLayerControl(true)}
          style={{ position: "absolute", top: 10, right: 10, ...toggleButtonStyle }}
        >
          <FaLayerGroup size={20} />
        </button>
      )}
      {showHdSettings ? (
        <div style={{ position: "absolute", top: 10, left: 10, ...panelStyle, width: "250px" }}>
          <button
            onClick={() => setShowHdSettings(false)}
            style={{ position: "absolute", top: 5, right: 5, background: "none", border: "none", cursor: "pointer" }}
          >
            <FaTimes />
          </button>
          <h4><FaCog /> Paramètres HD</h4>
          <label>
            <input type="checkbox" checked={hdEnabled} onChange={toggleHD} /> Activer HD
          </label>
          <div style={{ marginTop: "5px" }}>
            <label>
              Zoom max :{" "}
              <input
                type="number"
                value={maxZoom}
                min={1}
                max={24}
                onChange={handleMaxZoomChange}
                style={{ width: "50px", marginLeft: "5px" }}
              />
            </label>
          </div>
          <div style={{ marginTop: "10px" }}>
            <h4>Filtres de Texture</h4>
            <label>
              Préréglage :{" "}
              <select onChange={handlePresetChange}>
                {presets.map((p) => (
                  <option key={p.name} value={p.name}>{p.name}</option>
                ))}
              </select>
            </label>
            <div style={{ marginTop: "10px" }}>
              <label>Brightness: {filterValues.brightness}%</label>
              <input type="range" min="0" max="200" value={filterValues.brightness} onChange={(e) => updateFilterValue('brightness', e.target.value)} />
            </div>
            <div>
              <label>Contrast: {filterValues.contrast}%</label>
              <input type="range" min="0" max="300" value={filterValues.contrast} onChange={(e) => updateFilterValue('contrast', e.target.value)} />
            </div>
            <div>
              <label>Saturate: {filterValues.saturate}%</label>
              <input type="range" min="0" max="300" value={filterValues.saturate} onChange={(e) => updateFilterValue('saturate', e.target.value)} />
            </div>
            <div>
              <label>Grayscale: {filterValues.grayscale}%</label>
              <input type="range" min="0" max="100" value={filterValues.grayscale} onChange={(e) => updateFilterValue('grayscale', e.target.value)} />
            </div>
            <div>
              <label>Sepia: {filterValues.sepia}%</label>
              <input type="range" min="0" max="100" value={filterValues.sepia} onChange={(e) => updateFilterValue('sepia', e.target.value)} />
            </div>
            <div>
              <label>Hue Rotate: {filterValues.hueRotate}deg</label>
              <input type="range" min="0" max="360" value={filterValues.hueRotate} onChange={(e) => updateFilterValue('hueRotate', e.target.value)} />
            </div>
            <div>
              <label>Blur: {filterValues.blur}px</label>
              <input type="range" min="0" max="10" step="0.1" value={filterValues.blur} onChange={(e) => updateFilterValue('blur', e.target.value)} />
            </div>
            <div>
              <label>Invert: {filterValues.invert}%</label>
              <input type="range" min="0" max="100" value={filterValues.invert} onChange={(e) => updateFilterValue('invert', e.target.value)} />
            </div>
            <div>
              <label>Opacity: {filterValues.opacity}%</label>
              <input type="range" min="0" max="100" value={filterValues.opacity} onChange={(e) => updateFilterValue('opacity', e.target.value)} />
            </div>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setShowHdSettings(true)}
          style={{ position: "absolute", top: 10, left: 10, ...toggleButtonStyle }}
        >
          <FaCog size={20} />
        </button>
      )}
      {showMarkerControl ? (
        <div style={{ position: "absolute", bottom: 10, right: 10, ...panelStyle }}>
          <button
            onClick={() => setShowMarkerControl(false)}
            style={{ position: "absolute", top: 5, right: 5, background: "none", border: "none", cursor: "pointer" }}
          >
            <FaTimes />
          </button>
          <h4><FaMapMarkerAlt /> Marqueurs</h4>
          <button
            onClick={() => setPlacingMarker(true)}
            style={{
              display: "block",
              margin: "5px 0",
              width: "100%",
              padding: "5px 10px",
              borderRadius: "4px",
              border: "none",
              cursor: "pointer",
              backgroundColor: "#007bff",
              color: "#fff",
            }}
          >
            Ajouter un marqueur
          </button>
        </div>
      ) : (
        <button
          onClick={() => setShowMarkerControl(true)}
          style={{ position: "absolute", bottom: 10, right: 10, ...toggleButtonStyle }}
        >
          <FaMapMarkerAlt size={20} />
        </button>
      )}
      {showAddModal && (
        <div style={modalStyle}>
          <div style={modalContentStyle}>
            <h3>Ajouter Marqueur</h3>
            <input
              type="text"
              placeholder="Titre"
              value={titleInput}
              onChange={(e) => setTitleInput(e.target.value)}
              style={{ display: "block", margin: "10px 0" }}
            />
            <textarea
              placeholder="Commentaire"
              value={commentInput}
              onChange={(e) => setCommentInput(e.target.value)}
              style={{ display: "block", margin: "10px 0" }}
            />
            <label>Couleur: </label>
            <input
              type="color"
              value={colorInput}
              onChange={(e) => setColorInput(e.target.value)}
            />
            <label>Photos: </label>
            <input
              type="file"
              multiple
              accept="image/*"
              onChange={(e) => setPhotosFiles(Array.from(e.target.files))}
              style={{ display: "block", margin: "10px 0" }}
            />
            <label>Vidéos: </label>
            <input
              type="file"
              multiple
              accept="video/*"
              onChange={(e) => setVideosFiles(Array.from(e.target.files))}
              style={{ display: "block", margin: "10px 0" }}
            />
            <button onClick={handleAddSubmit}>Sauvegarder</button>
            <button onClick={() => setShowAddModal(false)}>Annuler</button>
          </div>
        </div>
      )}
      {showEditModal && (
        <div style={modalStyle}>
          <div style={modalContentStyle}>
            <h3>Éditer Marqueur</h3>
            <input
              type="text"
              placeholder="Titre"
              value={titleInput}
              onChange={(e) => setTitleInput(e.target.value)}
              style={{ display: "block", margin: "10px 0" }}
            />
            <textarea
              placeholder="Commentaire"
              value={commentInput}
              onChange={(e) => setCommentInput(e.target.value)}
              style={{ display: "block", margin: "10px 0" }}
            />
            <label>Couleur: </label>
            <input
              type="color"
              value={colorInput}
              onChange={(e) => setColorInput(e.target.value)}
            />
            <label>Ajouter Photos: </label>
            <input
              type="file"
              multiple
              accept="image/*"
              onChange={(e) => setPhotosFiles(Array.from(e.target.files))}
              style={{ display: "block", margin: "10px 0" }}
            />
            <label>Ajouter Vidéos: </label>
            <input
              type="file"
              multiple
              accept="video/*"
              onChange={(e) => setVideosFiles(Array.from(e.target.files))}
              style={{ display: "block", margin: "10px 0" }}
            />
            <button onClick={handleEditSubmit}>Sauvegarder</button>
            <button onClick={() => setShowEditModal(false)}>Annuler</button>
          </div>
        </div>
      )}
    </>
  );
};

const MapTracker = ({ userId }) => {
  const [users, setUsers] = useState([]);
  const { user } = useContext(UserContext);

  const getAuthHeaders = () => {
    const token = localStorage.getItem('token');
    return { Authorization: `Bearer ${token}` };
  };

  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const res = await axios.get("https://setrafbackend.onrender.com/api/users/with-positions", {
          headers: getAuthHeaders()
        });
        const mappedUsers = res.data.map(u => ({
          ...u,
          latitude: u.lastLocation?.lat,
          longitude: u.lastLocation?.lng
        }));
        setUsers(mappedUsers);
      } catch (err) {
        console.error(err);
      }
    };
    if (user && user.isVerified && user.isApproved) {
      fetchUsers();
    }
  }, [user]);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) {
      socket.emit('authenticate', token);
    }

    const handler = (updatedUser) => {
      console.log("MapTracker reçoit positionsUpdate:", updatedUser);
      setUsers(prev => {
        const exists = prev.find(u => u._id === updatedUser.userId);
        const mappedUpdated = {
          ...updatedUser,
          _id: updatedUser.userId,
          latitude: updatedUser.lastLocation?.lat,
          longitude: updatedUser.lastLocation?.lng
        };
        if (exists) {
          return prev.map(u => u._id === updatedUser.userId ? { ...u, ...mappedUpdated } : u);
        } else {
          return [...prev, mappedUpdated];
        }
      });
    };
    socket.on("positionsUpdate", handler);
    socket.on("user-online", (data) => {
      setUsers(prev => prev.map(u => u._id === data.userId ? { ...u, isOnline: true } : u));
    });
    socket.on("user-offline", (data) => {
      setUsers(prev => prev.map(u => u._id === data.userId ? { ...u, isOnline: false } : u));
    });
    return () => {
      socket.off("positionsUpdate");
      socket.off("user-online");
      socket.off("user-offline");
    };
  }, []);

  const currentUser = users.find(u => u._id === userId);

  return (
    <MapContainer center={[0, 0]} zoom={2} style={{ height: "80vh", width: "100%" }}>
      <TileLayerControl />
      {user && user.isVerified && user.isApproved && users.map((user, idx) => (
        user.latitude && user.longitude ? (
          <Marker
            key={user._id || idx}
            position={[user.latitude, user.longitude]}
          >
            <Popup>{user.firstName} {user.lastName}</Popup>
          </Marker>
        ) : null
      ))}
      {currentUser && currentUser.latitude && currentUser.longitude && (
        <CenterOnUser latitude={currentUser.latitude} longitude={currentUser.longitude} />
      )}
    </MapContainer>
  );
};

export default MapTracker;
export { RegisterForm, LoginForm, GeoTracker };
