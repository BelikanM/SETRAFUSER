import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import './Register.css';

const Register = () => {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    firstName: '',
    lastName: '',
    role: 'employee', // Par défaut employé
    profilePhoto: null,
    nip: '',
    passport: '',
    professionalCard: null, // Carte professionnelle pour admin
    certificates: [{ title: '', creationDate: '', expiryDate: '', file: null }],
  });
  const [profilePhotoPreview, setProfilePhotoPreview] = useState(null); // Preview persistante
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Charger la photo depuis sessionStorage au montage
  useEffect(() => {
    const savedPhoto = sessionStorage.getItem('profilePhotoBase64');
    if (savedPhoto) {
      setProfilePhotoPreview(savedPhoto);
    }
  }, []);

  // Gestion des champs du formulaire
  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData({ ...formData, [name]: value });
  };

  // Gestion de la photo de profil avec persistance en base64 dans sessionStorage
  const handlePhotoChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setFormData({ ...formData, profilePhoto: file });
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64 = reader.result;
        setProfilePhotoPreview(base64);
        sessionStorage.setItem('profilePhotoBase64', base64); // Persister en sessionStorage (temporaire)
      };
      reader.readAsDataURL(file);
    }
  };

  // Gestion de la carte professionnelle
  const handleProfessionalCardChange = (e) => {
    setFormData({ ...formData, professionalCard: e.target.files[0] });
  };

  // Gestion des certificats dynamiques
  const handleCertificateChange = (index, field, value) => {
    const updatedCertificates = [...formData.certificates];
    updatedCertificates[index][field] = value;
    setFormData({ ...formData, certificates: updatedCertificates });
  };

  const addCertificate = () => {
    setFormData({
      ...formData,
      certificates: [...formData.certificates, { title: '', creationDate: '', expiryDate: '', file: null }],
    });
  };

  const removeCertificate = (index) => {
    const updatedCertificates = formData.certificates.filter((_, i) => i !== index);
    setFormData({ ...formData, certificates: updatedCertificates });
  };

  // Gestion de la soumission du formulaire
  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess('');

    if (formData.role === 'admin' && !formData.professionalCard) {
      setError('La carte professionnelle est obligatoire pour les administrateurs.');
      setLoading(false);
      return;
    }

    const form = new FormData();
    form.append('email', formData.email);
    form.append('password', formData.password);
    form.append('firstName', formData.firstName);
    form.append('lastName', formData.lastName);
    form.append('role', formData.role);
    form.append('nip', formData.nip);
    form.append('passport', formData.passport);
    if (formData.profilePhoto) form.append('profilePhoto', formData.profilePhoto);
    if (formData.professionalCard) form.append('professionalCard', formData.professionalCard);
    form.append('certificatesData', JSON.stringify(formData.certificates.map(cert => ({
      title: cert.title,
      creationDate: cert.creationDate,
      expiryDate: cert.expiryDate,
    }))));
    formData.certificates.forEach((cert) => {
      if (cert.file) form.append('certificates', cert.file);
    });

    try {
      await axios.post('http://localhost:5000/api/register', form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setSuccess('Inscription réussie ! Un lien de vérification a été envoyé à votre email.');
      sessionStorage.removeItem('profilePhotoBase64'); // Nettoyer sessionStorage après succès
      setTimeout(() => navigate('/login', { state: { email: formData.email } }), 2000);
    } catch (err) {
      setError(err.response?.data?.message || 'Erreur lors de l\'inscription');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="whatsapp-container">
      <div className="form-paper">
        <div className="avatar-container">
          {profilePhotoPreview ? (
            <img src={profilePhotoPreview} alt="Profile" className="avatar" />
          ) : (
            <div className="avatar-placeholder">📷</div>
          )}
          <input
            accept="image/*"
            type="file"
            id="profile-photo-upload"
            className="file-input"
            onChange={handlePhotoChange}
          />
          <label htmlFor="profile-photo-upload" className="upload-button">
            Ajouter une photo
          </label>
        </div>

        <h2>Inscription</h2>
        {error && <p className="error">{error}</p>}
        {success && <p className="success">{success}</p>}

        <form onSubmit={handleSubmit}>
          <input
            type="email"
            name="email"
            value={formData.email}
            onChange={handleInputChange}
            placeholder="Email"
            className="input-field"
            required
          />
          <input
            type="password"
            name="password"
            value={formData.password}
            onChange={handleInputChange}
            placeholder="Mot de passe"
            className="input-field"
            required
          />
          <input
            type="text"
            name="firstName"
            value={formData.firstName}
            onChange={handleInputChange}
            placeholder="Prénom"
            className="input-field"
            required
          />
          <input
            type="text"
            name="lastName"
            value={formData.lastName}
            onChange={handleInputChange}
            placeholder="Nom"
            className="input-field"
            required
          />
          <select
            name="role"
            value={formData.role}
            onChange={handleInputChange}
            className="input-field"
            required
          >
            <option value="employee">Employé</option>
            <option value="admin">Administrateur</option>
          </select>
          {formData.role === 'admin' && (
            <div>
              <input
                accept="application/pdf,image/*"
                type="file"
                id="professional-card-upload"
                className="file-input"
                onChange={handleProfessionalCardChange}
                required
              />
              <label htmlFor="professional-card-upload" className="upload-button">
                Upload Carte Professionnelle (obligatoire)
              </label>
            </div>
          )}
          <input
            type="text"
            name="nip"
            value={formData.nip}
            onChange={handleInputChange}
            placeholder="NIP"
            className="input-field"
          />
          <input
            type="text"
            name="passport"
            value={formData.passport}
            onChange={handleInputChange}
            placeholder="Passeport"
            className="input-field"
          />

          <h3>Certificats</h3>
          {formData.certificates.map((cert, index) => (
            <div key={index} className="certificate-container">
              <input
                type="text"
                value={cert.title}
                onChange={(e) => handleCertificateChange(index, 'title', e.target.value)}
                placeholder="Titre du certificat"
                className="input-field"
                required
              />
              <input
                type="date"
                value={cert.creationDate}
                onChange={(e) => handleCertificateChange(index, 'creationDate', e.target.value)}
                className="input-field"
                required
              />
              <input
                type="date"
                value={cert.expiryDate}
                onChange={(e) => handleCertificateChange(index, 'expiryDate', e.target.value)}
                className="input-field"
                required
              />
              <input
                accept="application/pdf"
                type="file"
                id={`certificate-file-${index}`}
                className="file-input"
                onChange={(e) => handleCertificateChange(index, 'file', e.target.files[0])}
              />
              <label htmlFor={`certificate-file-${index}`} className="upload-button">
                Importer PDF
              </label>
              {index > 0 && (
                <button type="button" className="delete-button" onClick={() => removeCertificate(index)}>
                  🗑️
                </button>
              )}
            </div>
          ))}
          <button type="button" className="add-button" onClick={addCertificate}>
            Ajouter un certificat
          </button>

          <button type="submit" className="whatsapp-button" disabled={loading}>
            {loading ? 'Chargement...' : 'S\'inscrire'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default Register;
