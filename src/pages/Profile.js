import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { FaClock, FaFilePdf, FaImage, FaEdit, FaTrash, FaEye, FaDownload } from 'react-icons/fa';
import './Profile.css';

// Composant réutilisable pour la bulle de profil (à utiliser dynamiquement dans toute l'application, ex: dans App.js, Navbar.js, etc.)
const ProfileBubble = ({ profilePhoto, email }) => {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '24px' }}>
      {profilePhoto ? (
        <img
          src={`https://setrafbackend.onrender.com/${profilePhoto}`}
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
  const [certificateForm, setCertificateForm] = useState({ title: '', creationDate: '', expiryDate: '', file: null, image: null });
  const [editingCertIndex, setEditingCertIndex] = useState(null);
  const [, setTick] = useState(0);
  const queryClient = useQueryClient();
  const [isDesktop, setIsDesktop] = useState(window.innerWidth > 768);

  const { data: user, isLoading, error } = useQuery({
    queryKey: ['userProfile'],
    queryFn: async () => {
      const token = localStorage.getItem('token');
      if (!token) {
        throw new Error('Aucun token trouvé. Veuillez vous connecter.');
      }
      const response = await axios.get('https://setrafbackend.onrender.com/api/user/profile', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      return response.data;
    },
    refetchInterval: 10000, // rafraîchit toutes les 10 secondes automatiquement
    refetchOnWindowFocus: true, // refait la requête quand tu reviens sur l'onglet/fenêtre
    staleTime: 5 * 60 * 1000, // Données considérées fraîches pendant 5 minutes
    cacheTime: 10 * 60 * 1000, // Cache gardé 10 minutes en mémoire
  });

  const mutation = useMutation({
    mutationFn: async (formData) => {
      const token = localStorage.getItem('token');
      if (!token) {
        throw new Error('Aucun token trouvé. Veuillez vous connecter.');
      }
      const response = await axios.post('https://setrafbackend.onrender.com/api/user/update-profile-photo', formData, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'multipart/form-data',
        },
      });
      return response.data;
    },
    onSuccess: (data) => {
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

  const certificateMutation = useMutation({
    mutationFn: async ({ formData, isEdit }) => {
      const token = localStorage.getItem('token');
      const endpoint = isEdit ? '/api/user/edit-certificate' : '/api/user/add-certificate';
      const response = await axios.post(`https://setrafbackend.onrender.com${endpoint}`, formData, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'multipart/form-data',
        },
      });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['userProfile']);
      setCertificateForm({ title: '', creationDate: '', expiryDate: '', file: null, image: null });
      setEditingCertIndex(null);
      alert('Certificat mis à jour avec succès !');
    },
    onError: (err) => {
      console.error(err);
      alert(err.response?.data?.message || 'Erreur lors de l\'opération sur le certificat.');
    },
  });

  const deleteCertificateMutation = useMutation({
    mutationFn: async (index) => {
      const token = localStorage.getItem('token');
      const response = await axios.post('https://setrafbackend.onrender.com/api/user/delete-certificate', { index }, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['userProfile']);
      alert('Certificat supprimé avec succès !');
    },
    onError: (err) => {
      console.error(err);
      alert(err.response?.data?.message || 'Erreur lors de la suppression du certificat.');
    },
  });

  useEffect(() => {
    const interval = setInterval(() => {
      setTick((prev) => prev + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  // Détection de la taille d'écran pour adaptation desktop/mobile
  useEffect(() => {
    const handleResize = () => {
      setIsDesktop(window.innerWidth > 768);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

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

  const calculateCountdown = (expiryDate) => {
    const now = new Date();
    const expiry = new Date(expiryDate);
    const diff = expiry - now;
    if (diff < 0) return 'Expiré';
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((diff % (1000 * 60)) / 1000);
    return `${days} jours, ${hours} heures, ${minutes} minutes, ${seconds} secondes restantes`;
  };

  const handleCertificateSubmit = (e) => {
    e.preventDefault();
    if (new Date(certificateForm.expiryDate) <= new Date(certificateForm.creationDate)) {
      alert('La date d\'expiration doit être postérieure à la date de création.');
      return;
    }
    const formData = new FormData();
    formData.append('title', certificateForm.title);
    formData.append('creationDate', certificateForm.creationDate);
    formData.append('expiryDate', certificateForm.expiryDate);
    if (certificateForm.file) formData.append('file', certificateForm.file);
    if (certificateForm.image) formData.append('image', certificateForm.image);
    if (editingCertIndex !== null) formData.append('index', editingCertIndex);

    certificateMutation.mutate({ formData, isEdit: editingCertIndex !== null });
  };

  const startEditingCertificate = (index, cert) => {
    setEditingCertIndex(index);
    setCertificateForm({
      title: cert.title,
      creationDate: new Date(cert.creationDate).toISOString().split('T')[0],
      expiryDate: new Date(cert.expiryDate).toISOString().split('T')[0],
      file: null,
      image: null,
    });
  };

  const handleDeleteCertificate = (index) => {
    if (window.confirm('Êtes-vous sûr de vouloir supprimer ce certificat ?')) {
      deleteCertificateMutation.mutate(index);
    }
  };

  const handleClearCache = () => {
    if (window.confirm('Êtes-vous sûr de vouloir vider le cache de l\'application ? Cela déconnectera potentiellement et rafraîchira les données.')) {
      queryClient.clear();
      localStorage.clear();
      window.location.reload();
    }
  };

  // Afficher "Chargement..." seulement si aucune donnée n'est disponible
  if (isLoading && !user) return <div style={{ textAlign: 'center', padding: '40px', fontSize: '18px' }}>Chargement...</div>;
  if (error) return <div style={{ textAlign: 'center', padding: '40px', color: 'red', fontSize: '18px' }}>{error.message || 'Erreur lors de la récupération du profil. Vérifiez si l\'utilisateur existe ou si le token est valide.'}</div>;
  if (!user) return <div style={{ textAlign: 'center', padding: '40px', fontSize: '18px' }}>Utilisateur non trouvé.</div>;

  const sortedCertificates = [...(user?.certificates || [])].sort((a, b) => new Date(a.expiryDate) - new Date(b.expiryDate));

  const expiredCerts = sortedCertificates.filter(cert => new Date(cert.expiryDate) < new Date());
  const expiringSoonCerts = sortedCertificates.filter(cert => {
    const diff = new Date(cert.expiryDate) - new Date();
    return diff > 0 && diff < 30 * 24 * 60 * 60 * 1000;
  });
  const validCerts = sortedCertificates.filter(cert => {
    const diff = new Date(cert.expiryDate) - new Date();
    return diff >= 30 * 24 * 60 * 60 * 1000;
  });

  return (
    <div className={`profile-container ${isDesktop ? 'desktop-version' : 'mobile-version'}`}>
      <h1 className="profile-title">Profil Utilisateur</h1>

      <ProfileBubble profilePhoto={user.profilePhoto} email={user.email} />

      <div style={{ marginBottom: '32px' }}>
        <h2 className="section-title">Informations Personnelles</h2>
        <p className="info-paragraph"><strong>Email :</strong> {user.email}</p>
        <p className="info-paragraph"><strong>Nom :</strong> {user.lastName || 'Non spécifié'}</p>
        <p className="info-paragraph"><strong>Prénom :</strong> {user.firstName || 'Non spécifié'}</p>
        <p className="info-paragraph"><strong>Rôle :</strong> {user.role}</p>
        <p className="info-paragraph"><strong>NIP :</strong> {user.nip || 'Non renseigné'}</p>
        <p className="info-paragraph"><strong>Passeport :</strong> {user.passport || 'Non renseigné'}</p>
      </div>

      <div style={{ marginBottom: '32px' }}>
        <h2 className="section-title">Modifier la Photo de Profil</h2>
        {photoPreview && (
          <img
            src={photoPreview}
            alt="Preview"
            className="photo-preview"
          />
        )}
        <input
          type="file"
          accept="image/*"
          onChange={handlePhotoChange}
          className="file-input"
        />
        <button
          onClick={handleUpdatePhoto}
          disabled={mutation.isLoading}
          className="update-button"
        >
          {mutation.isLoading ? 'Mise à jour...' : 'Mettre à jour la photo'}
        </button>
      </div>

      <div style={{ marginBottom: '32px', paddingTop: '60px', paddingBottom: '80px' }}>
        <h2 className="section-title">Mes Certificats (triés par expiration)</h2>

        <h3 className="subsection-title expired">Expirés</h3>
        <div className="certificates-grid">
          {expiredCerts.map((cert, index) => (
            <div key={index} className="certificate-card">
              <h4 className="certificate-title">{cert.title}</h4>
              <p className="certificate-date">Début: {new Date(cert.creationDate).toLocaleDateString()}</p>
              <p className="certificate-date">Fin: {new Date(cert.expiryDate).toLocaleDateString()}</p>
              <p className="countdown expired"><FaClock /> {calculateCountdown(cert.expiryDate)}</p>
              {cert.imagePath && <img src={`https://setrafbackend.onrender.com/${cert.imagePath}`} alt={cert.title} className="cert-image" />}
              {cert.filePath && (
                <div className="file-actions">
                  <a href={`https://setrafbackend.onrender.com/${cert.filePath}`} target="_blank" rel="noopener noreferrer" className="file-action-link"><FaEye /> Ouvrir</a>
                  <a href={`https://setrafbackend.onrender.com/${cert.filePath}`} download className="file-action-link"><FaDownload /> Télécharger</a>
                </div>
              )}
              <div className="cert-actions">
                <button onClick={() => startEditingCertificate(index, cert)} className="edit-cert-button"><FaEdit /></button>
                <button onClick={() => handleDeleteCertificate(index)} className="delete-cert-button"><FaTrash /></button>
              </div>
            </div>
          ))}
        </div>

        <h3 className="subsection-title expiring-soon">Expirant bientôt (dans 30 jours)</h3>
        <div className="certificates-grid">
          {expiringSoonCerts.map((cert, index) => (
            <div key={index} className="certificate-card">
              <h4 className="certificate-title">{cert.title}</h4>
              <p className="certificate-date">Début: {new Date(cert.creationDate).toLocaleDateString()}</p>
              <p className="certificate-date">Fin: {new Date(cert.expiryDate).toLocaleDateString()}</p>
              <p className="countdown expiring-soon"><FaClock /> {calculateCountdown(cert.expiryDate)}</p>
              {cert.imagePath && <img src={`https://setrafbackend.onrender.com/${cert.imagePath}`} alt={cert.title} className="cert-image" />}
              {cert.filePath && (
                <div className="file-actions">
                  <a href={`https://setrafbackend.onrender.com/${cert.filePath}`} target="_blank" rel="noopener noreferrer" className="file-action-link"><FaEye /> Ouvrir</a>
                  <a href={`https://setrafbackend.onrender.com/${cert.filePath}`} download className="file-action-link"><FaDownload /> Télécharger</a>
                </div>
              )}
              <div className="cert-actions">
                <button onClick={() => startEditingCertificate(index, cert)} className="edit-cert-button"><FaEdit /></button>
                <button onClick={() => handleDeleteCertificate(index)} className="delete-cert-button"><FaTrash /></button>
              </div>
            </div>
          ))}
        </div>

        <h3 className="subsection-title valid">Valides</h3>
        <div className="certificates-grid">
          {validCerts.map((cert, index) => (
            <div key={index} className="certificate-card">
              <h4 className="certificate-title">{cert.title}</h4>
              <p className="certificate-date">Début: {new Date(cert.creationDate).toLocaleDateString()}</p>
              <p className="certificate-date">Fin: {new Date(cert.expiryDate).toLocaleDateString()}</p>
              <p className="countdown valid"><FaClock /> {calculateCountdown(cert.expiryDate)}</p>
              {cert.imagePath && <img src={`https://setrafbackend.onrender.com/${cert.imagePath}`} alt={cert.title} className="cert-image" />}
              {cert.filePath && (
                <div className="file-actions">
                  <a href={`https://setrafbackend.onrender.com/${cert.filePath}`} target="_blank" rel="noopener noreferrer" className="file-action-link"><FaEye /> Ouvrir</a>
                  <a href={`https://setrafbackend.onrender.com/${cert.filePath}`} download className="file-action-link"><FaDownload /> Télécharger</a>
                </div>
              )}
              <div className="cert-actions">
                <button onClick={() => startEditingCertificate(index, cert)} className="edit-cert-button"><FaEdit /></button>
                <button onClick={() => handleDeleteCertificate(index)} className="delete-cert-button"><FaTrash /></button>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div style={{ marginBottom: '32px' }}>
        <h2 className="section-title">{editingCertIndex !== null ? 'Modifier un Certificat' : 'Ajouter un Certificat'}</h2>
        <form onSubmit={handleCertificateSubmit} className="certificate-form">
          <input
            type="text"
            value={certificateForm.title}
            onChange={(e) => setCertificateForm({ ...certificateForm, title: e.target.value })}
            placeholder="Titre du certificat"
            required
            className="form-input"
          />
          <input
            type="date"
            value={certificateForm.creationDate}
            onChange={(e) => setCertificateForm({ ...certificateForm, creationDate: e.target.value })}
            required
            className="form-input"
          />
          <input
            type="date"
            value={certificateForm.expiryDate}
            onChange={(e) => setCertificateForm({ ...certificateForm, expiryDate: e.target.value })}
            required
            className="form-input"
          />
          <div className="file-upload-container">
            <label className="file-upload-label">
              <FaFilePdf /> Upload PDF
              <input
                type="file"
                accept="application/pdf"
                onChange={(e) => setCertificateForm({ ...certificateForm, file: e.target.files[0] })}
                className="file-input-hidden"
              />
            </label>

            <label className="file-upload-label">
              <FaImage /> Upload Image
              <input
                type="file"
                accept="image/*"
                onChange={(e) => setCertificateForm({ ...certificateForm, image: e.target.files[0] })}
                className="file-input-hidden"
              />
            </label>
          </div>

          <button type="submit" disabled={certificateMutation.isLoading} className="submit-button">
            {certificateMutation.isLoading ? (editingCertIndex !== null ? 'Modification...' : 'Ajout...') : (editingCertIndex !== null ? 'Modifier Certificat' : 'Ajouter Certificat')}
          </button>

          {editingCertIndex !== null && (
            <button
              type="button"
              onClick={() => {
                setEditingCertIndex(null);
                setCertificateForm({ title: '', creationDate: '', expiryDate: '', file: null, image: null });
              }}
              className="cancel-button"
            >
              Annuler
            </button>
          )}
        </form>
      </div>

      <div style={{ marginBottom: '32px' }}>
        <button onClick={handleClearCache} className="clear-cache-button">
          Vider le cache de l'application
        </button>
      </div>
    </div>
  );
};

export default Profile;