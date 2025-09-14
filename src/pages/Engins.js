import React, { useState, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import axios from 'axios';

// Fix for default marker icons in React-Leaflet
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: require('leaflet/dist/images/marker-icon-2x.png'),
  iconUrl: require('leaflet/dist/images/marker-icon.png'),
  shadowUrl: require('leaflet/dist/images/marker-shadow.png'),
});

const MapComponent = () => {
  const [currentUser, setCurrentUser] = useState(null);
  const [users, setUsers] = useState([]);
  const [mapCenter, setMapCenter] = useState([48.8566, 2.3522]); // Default to Paris

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      console.error('No authentication token found');
      return;
    }

    axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;

    // Fetch current user profile
    axios.get('https://your-backend-url/api/user/profile') // Replace with actual backend URL, e.g., http://localhost:5000/api/user/profile
      .then(response => {
        setCurrentUser(response.data);
        if (response.data.lastLocation) {
          setMapCenter([response.data.lastLocation.lat, response.data.lastLocation.lng]);
        }
      })
      .catch(error => console.error('Error fetching current user:', error));

    // Function to fetch all users
    const fetchUsers = () => {
      axios.get('https://your-backend-url/api/users') // Replace with actual backend URL
        .then(response => {
          // Filter users who have lastLocation (to display on map)
          const usersWithLocation = response.data.filter(user => user.lastLocation && user.lastLocation.lat && user.lastLocation.lng);
          setUsers(usersWithLocation);
        })
        .catch(error => console.error('Error fetching users:', error));
    };

    fetchUsers();
    const interval = setInterval(fetchUsers, 5000); // Poll every 5 seconds for real-time updates

    return () => clearInterval(interval);
  }, []);

  // Real-time GPS update for current user
  useEffect(() => {
    if (!currentUser || !('geolocation' in navigator)) return;

    const watchId = navigator.geolocation.watchPosition(
      position => {
        const { latitude: lat, longitude: lng, accuracy } = position.coords;
        axios.post('https://your-backend-url/api/users/update-location', { // Replace with actual backend URL
          userId: currentUser._id,
          lat,
          lng,
          accuracy,
          city: '', // Optional, can be enhanced with reverse geocoding if needed
          country: '',
          neighborhood: ''
        })
          .then(() => {
            console.log('Location updated');
            // Update map center to current position if changed
            setMapCenter([lat, lng]);
          })
          .catch(error => console.error('Error updating location:', error));
      },
      error => console.error('Geolocation error:', error),
      { enableHighAccuracy: true, timeout: 5000, maximumAge: 0 }
    );

    return () => navigator.geolocation.clearWatch(watchId);
  }, [currentUser]);

  return (
    <div style={{ height: '100vh', width: '100%' }}>
      <MapContainer center={mapCenter} zoom={13} style={{ height: '100%', width: '100%' }}>
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        />
        {users.map(user => (
          <Marker key={user._id} position={[user.lastLocation.lat, user.lastLocation.lng]}>
            <Popup>
              {user.firstName} {user.lastName}<br />
              Role: {user.role}<br />
              Last seen: {user.lastSeen ? new Date(user.lastSeen).toLocaleString() : 'N/A'}<br />
              Accuracy: {user.lastLocation.accuracy ? `${user.lastLocation.accuracy}m` : 'N/A'}
            </Popup>
          </Marker>
        ))}
        {currentUser && currentUser.lastLocation && (
          <Marker position={[currentUser.lastLocation.lat, currentUser.lastLocation.lng]}>
            <Popup>Your current position</Popup>
          </Marker>
        )}
      </MapContainer>
    </div>
  );
};

export default MapComponent;