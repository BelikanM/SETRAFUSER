import React, { useState } from 'react';
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
    profilePhoto: null,
    nip: '',
    passport: '',
    certificates: [{ title: '', creationDate: '', expiryDate: '', file: null }],
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Gestion des champs du formulaire
  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData({ ...formData, [name]: value });
  };

  // Gestion de la photo de profil
  const handlePhotoChange = (e) => {
    setFormData({ ...formData, profilePhoto: e.target.files[0] });
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

    const form = new FormData();
    form.append('email', formData.email);
    form.append('password', formData.password);
    form.append('firstName', formData.firstName);
    form.append('lastName', formData.lastName);
    form.append('nip', formData.nip);
    form.append('passport', formData.passport);
    if (formData.profilePhoto) form.append('profilePhoto', formData.profilePhoto);
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
      setSuccess('Inscription réussie ! Un code de vérification a été envoyé à votre email.');
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
          {formData.profilePhoto ? (
            <img src={URL.createObjectURL(formData.profilePhoto)} alt="Profile" className="avatar" />
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
