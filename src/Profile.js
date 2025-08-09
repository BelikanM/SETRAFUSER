// Profile.js (composant React pour la page de profil, avec un design modernisé respectant les standards actuels : layout responsive, utilisation de CSS moderne avec flexbox/grid, thèmes clairs/sombres si possible, boutons stylés, preview de la photo, etc. Mise en cache avec react-query pour éviter de recharger les données à chaque fois. Ajout d'un bouton pour vider le cache de l'application (react-query et localStorage).)

import React, { useState } from 'react';
import axios from 'axios';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

// Composant réutilisable pour la bulle de profil (à utiliser dynamiquement dans toute l'application, ex: dans App.js, Navbar.js, etc.)
const ProfileBubble = ({ profilePhoto, email }) => {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '24px' }}>
      {profilePhoto ? (
        <img
          src={`http://localhost:5000/${profilePhoto}`}
          alt="Profile Bubble"
          style={{
            width: '60px',
            height: '60px',
            borderRadius: '50%',
            objectFit: 'cover',
            border: '2px solid #e0e0e0',
            boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
          }}
        />
      ) : (
        <div
          style={{
            width: '60px',
            height: '60px',
            borderRadius: '50%',
            backgroundColor: '#f0f0f0',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#555',
            fontWeight: 'bold',
            fontSize: '24px',
            boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
          }}
        >
          {email ? email.charAt(0).toUpperCase() : '?'}
        </div>
      )}
      <span style={{ fontSize: '18px', fontWeight: '600', color: '#333' }}>{email}</span>
    </div>
  );
};

const Profile = () => {
  const [selectedPhoto, setSelectedPhoto] = useState(null);
  const [photoPreview, setPhotoPreview] = useState(null);
  const queryClient = useQueryClient();

  const { data: user, isLoading, error } = useQuery({
    queryKey: ['userProfile'],
    queryFn: async () => {
      const token = localStorage.getItem('token');
      if (!token) {
        throw new Error('Aucun token trouvé. Veuillez vous connecter.');
      }
      const response = await axios.get('http://localhost:5000/api/user/profile', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      return response.data;
    },
    staleTime: 5 * 60 * 1000, // Cache pendant 5 minutes
    cacheTime: 30 * 60 * 1000, // Garder en cache pendant 30 minutes
  });

  const mutation = useMutation({
    mutationFn: async (formData) => {
      const token = localStorage.getItem('token');
      if (!token) {
        throw new Error('Aucun token trouvé. Veuillez vous connecter.');
      }
      const response = await axios.post('http://localhost:5000/api/user/update-profile-photo', formData, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'multipart/form-data',
        },
      });
      return response.data;
    },
    onSuccess: (data) => {
      // Invalider et refetcher le profil après mise à jour
      queryClient.invalidateQueries(['userProfile']);
      setSelectedPhoto(null);
      setPhotoPreview(null);
      alert('Photo de profil mise à jour avec succès !');
    },
    onError: (err) => {
      console.error(err);
      alert(err.response?.data?.message || 'Erreur lors de la mise à jour de la photo.');
    },
  });

  const handlePhotoChange = (e) => {
    const file = e.target.files[0];
    setSelectedPhoto(file);
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setPhotoPreview(reader.result);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleUpdatePhoto = () => {
    if (!selectedPhoto) {
      alert('Veuillez sélectionner une photo.');
      return;
    }

    const formData = new FormData();
    formData.append('profilePhoto', selectedPhoto);

    mutation.mutate(formData);
  };

  const handleClearCache = () => {
    if (window.confirm('Êtes-vous sûr de vouloir vider le cache de l\'application ? Cela déconnectera potentiellement et rafraîchira les données.')) {
      queryClient.clear(); // Vider le cache react-query
      localStorage.clear(); // Vider le localStorage (inclut le token, etc.)
      window.location.reload(); // Recharger la page pour appliquer les changements
    }
  };

  if (isLoading) return <div style={{ textAlign: 'center', padding: '40px', fontSize: '18px' }}>Chargement...</div>;
  if (error) return <div style={{ textAlign: 'center', padding: '40px', color: 'red', fontSize: '18px' }}>{error.message || 'Erreur lors de la récupération du profil. Vérifiez si l\'utilisateur existe ou si le token est valide.'}</div>;
  if (!user) return <div style={{ textAlign: 'center', padding: '40px', fontSize: '18px' }}>Utilisateur non trouvé.</div>;

  return (
    <div style={{
      maxWidth: '600px',
      margin: '40px auto',
      padding: '32px',
      backgroundColor: '#fff',
      borderRadius: '12px',
      boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
    }}>
      <h1 style={{ fontSize: '28px', fontWeight: '700', marginBottom: '32px', textAlign: 'center', color: '#222' }}>Profil Utilisateur</h1>
      
      {/* Affichage dynamique de la bulle de profil */}
      <ProfileBubble profilePhoto={user.profilePhoto} email={user.email} />
      
      <div style={{ marginBottom: '32px' }}>
        <h2 style={{ fontSize: '20px', fontWeight: '600', marginBottom: '16px', color: '#333' }}>Informations Personnelles</h2>
        <p style={{ marginBottom: '8px', fontSize: '16px' }}><strong>Email :</strong> {user.email}</p>
        <p style={{ marginBottom: '8px', fontSize: '16px' }}><strong>Nom :</strong> {user.lastName || 'Non spécifié'}</p>
        <p style={{ marginBottom: '8px', fontSize: '16px' }}><strong>Prénom :</strong> {user.firstName || 'Non spécifié'}</p>
        {/* Ajoutez d'autres champs du profil si nécessaire */}
      </div>
      
      <div style={{ marginBottom: '32px' }}>
        <h2 style={{ fontSize: '20px', fontWeight: '600', marginBottom: '16px', color: '#333' }}>Modifier la Photo de Profil</h2>
        {photoPreview && (
          <img
            src={photoPreview}
            alt="Preview"
            style={{
              width: '120px',
              height: '120px',
              borderRadius: '50%',
              objectFit: 'cover',
              marginBottom: '16px',
              display: 'block',
              margin: '0 auto',
              boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
            }}
          />
        )}
        <input
          type="file"
          accept="image/*"
          onChange={handlePhotoChange}
          style={{
            display: 'block',
            margin: '0 auto 16px',
            padding: '8px',
            border: '1px solid #ddd',
            borderRadius: '4px',
            width: '100%',
            maxWidth: '300px',
          }}
        />
        <button
          onClick={handleUpdatePhoto}
          disabled={mutation.isLoading}
          style={{
            display: 'block',
            margin: '0 auto',
            padding: '12px 24px',
            backgroundColor: '#007bff',
            color: '#fff',
            border: 'none',
            borderRadius: '6px',
            fontSize: '16px',
            cursor: 'pointer',
            transition: 'background-color 0.3s',
          }}
          onMouseOver={(e) => (e.target.style.backgroundColor = '#0056b3')}
          onMouseOut={(e) => (e.target.style.backgroundColor = '#007bff')}
        >
          {mutation.isLoading ? 'Mise à jour...' : 'Mettre à jour la photo'}
        </button>
      </div>
      
      <div style={{ textAlign: 'center' }}>
        <button
          onClick={handleClearCache}
          style={{
            padding: '12px 24px',
            backgroundColor: '#dc3545',
            color: '#fff',
            border: 'none',
            borderRadius: '6px',
            fontSize: '16px',
            cursor: 'pointer',
            transition: 'background-color 0.3s',
          }}
          onMouseOver={(e) => (e.target.style.backgroundColor = '#c82333')}
          onMouseOut={(e) => (e.target.style.backgroundColor = '#dc3545')}
        >
          Vider le Cache de l'Application
        </button>
      </div>
    </div>
  );
};

export default Profile;
