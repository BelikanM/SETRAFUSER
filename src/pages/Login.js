import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import axios from 'axios';
import './Register.css'; // Réutiliser le même CSS pour cohérence stylistique

const Login = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState(location.state?.email || '');
  const [password, setPassword] = useState('');
  const [verificationCode, setVerificationCode] = useState('');
  const [showCodeInput, setShowCodeInput] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess('');

    // Si le code est requis, vérifier d'abord le code
    if (showCodeInput) {
      if (verificationCode.length !== 8 || !/^\d{8}$/.test(verificationCode)) {
        setError('Le code de vérification doit être exactement 8 chiffres.');
        setLoading(false);
        return;
      }
      try {
        await axios.post('http://localhost:5000/api/verify-code', { email, code: verificationCode });
      } catch (err) {
        setError(err.response?.data?.message || 'Code de vérification invalide ou expiré.');
        setLoading(false);
        return;
      }
    }

    // Procéder à la connexion
    try {
      const res = await axios.post('http://localhost:5000/api/login', { email, password });
      localStorage.setItem('token', res.data.token); // Stocker le token JWT
      setSuccess('Connexion réussie !');
      setTimeout(() => navigate('/dashboard'), 2000); // Rediriger vers le dashboard (à adapter)
    } catch (err) {
      if (err.response?.data?.needsVerification) {
        setShowCodeInput(true);
        setError('Votre compte n\'est pas vérifié. Entrez le code de vérification (8 chiffres) envoyé par email.');
      } else {
        setError(err.response?.data?.message || 'Erreur lors de la connexion');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="whatsapp-container">
      <div className="form-paper">
        <h2>Connexion</h2>
        {error && <p className="error">{error}</p>}
        {success && <p className="success">{success}</p>}

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
              onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, ''))} // Accepte seulement les chiffres
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
  );
};

export default Login;
