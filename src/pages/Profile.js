// Profile.js (composant React pour la page de profil, avec récupération du token pour vérifier l'utilisateur, affichage de l'email, modification de la photo de profil, et une bulle de profil dynamique affichée à côté de l'email. Pour l'afficher dynamiquement dans toute l'application, vous pouvez extraire le composant ProfileBubble et l'utiliser dans d'autres parties comme le navbar ou header. Mise en cache avec react-query pour éviter de recharger les données à chaque fois.)

import React, { useState } from 'react';
import axios from 'axios';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

// Composant réutilisable pour la bulle de profil (à utiliser dynamiquement dans toute l'application, ex: dans App.js, Navbar.js, etc.)
const ProfileBubble = ({ profilePhoto, email }) => {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
      {profilePhoto ? (
        <img
          src={`http://localhost:5000/${profilePhoto}`} // Ajout de l'URL complète pour servir les uploads
          alt="Profile Bubble"
          style={{
            width: '40px',
            height: '40px',
            borderRadius: '50%',
            objectFit: 'cover',
            border: '2px solid #ccc',
          }}
        />
      ) : (
        <div
          style={{
            width: '40px',
            height: '40px',
            borderRadius: '50%',
            backgroundColor: '#ccc',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#fff',
            fontWeight: 'bold',
          }}
        >
          {email ? email.charAt(0).toUpperCase() : '?'}
        </div>
      )}
      <span>{email}</span>
    </div>
  );
};

const Profile = () => {
  const [selectedPhoto, setSelectedPhoto] = useState(null);
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
      alert('Photo de profil mise à jour avec succès !');
    },
    onError: (err) => {
      console.error(err);
      alert(err.response?.data?.message || 'Erreur lors de la mise à jour de la photo.');
    },
  });

  const handlePhotoChange = (e) => {
    setSelectedPhoto(e.target.files[0]);
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

  if (isLoading) return <div>Chargement...</div>;
  if (error) return <div>{error.message || 'Erreur lors de la récupération du profil. Vérifiez si l\'utilisateur existe ou si le token est valide.'}</div>;
  if (!user) return <div>Utilisateur non trouvé.</div>;

  return (
    <div style={{ padding: '20px' }}>
      <h1>Page de Profil</h1>
      {/* Affichage dynamique de la bulle de profil à côté de l'email */}
      <ProfileBubble profilePhoto={user.profilePhoto} email={user.email} />
      
      <h2>Modifier la photo de profil</h2>
      <input type="file" accept="image/*" onChange={handlePhotoChange} />
      <button onClick={handleUpdatePhoto} disabled={mutation.isLoading}>
        {mutation.isLoading ? 'Mise à jour...' : 'Mettre à jour la photo'}
      </button>
      
      <p><strong>Email :</strong> {user.email}</p>
      <p><strong>Nom :</strong> {user.lastName}</p>
      <p><strong>Prénom :</strong> {user.firstName}</p>
      {/* Ajoutez d'autres champs du profil si nécessaire */}
    </div>
  );
};

export default Profile;
