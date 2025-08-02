import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import axios from 'axios';
import './Login.css';

const Login = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const initialEmail = location.state?.email || '';
  const [formData, setFormData] = useState({
    email: initialEmail,
    password: '',
    verificationCode: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  // Vérifier si l'utilisateur est déjà inscrit mais non vérifié au chargement
  useEffect(() => {
    if (initialEmail) {
      checkVerificationStatus(initialEmail);
    }
  }, [initialEmail]);

  const checkVerificationStatus = async (email) => {
    try {
      const res = await axios.post('http://localhost:5000/api/check-verification', { email });
      if (res.data.isRegistered && !res.data.isVerified) {
        setMessage('Un code de vérification a été envoyé à votre email.');
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Erreur lors de la vérification du statut');
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    if (name === 'verificationCode' && !/^\d{0,8}$/.test(value)) return; // Limite à 8 chiffres numériques
    setFormData({ ...formData, [name]: value });
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setMessage('');

    try {
      const res = await axios.post('http://localhost:5000/api/login', formData);
      localStorage.setItem('token', res.data.token);
      // Récupérer les données complètes de l'utilisateur pour les passer au dashboard
      const userRes = await axios.get('http://localhost:5000/api/user/me', {
        headers: { Authorization: `Bearer ${res.data.token}` },
      });
      setMessage('Connexion réussie ! Redirection...');
      navigate('/dashboard', { state: { user: userRes.data } });
    } catch (err) {
      if (err.response?.data?.message.includes('non vérifié')) {
        setMessage('Vérifiez votre email pour le code et saisissez-le.');
      } else {
        setError(err.response?.data?.message || 'Erreur lors de la connexion');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleResendCode = async () => {
    setLoading(true);
    setError('');
    setMessage('');

    try {
      await axios.post('http://localhost:5000/api/resend-code', {
        email: formData.email,
      });
      setMessage('Un nouveau code de vérification a été envoyé à votre email.');
    } catch (err) {
      setError(err.response?.data?.message || 'Erreur lors de l\'envoi du code');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="whatsapp-container">
      <div className="form-paper">
        <h2>Connexion</h2>
        {error && <p className="error">{error}</p>}
        {message && <p className="success">{message}</p>}

        <form onSubmit={handleLogin}>
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
            name="verificationCode"
            value={formData.verificationCode}
            onChange={handleInputChange}
            placeholder="Code de vérification (8 chiffres, si nécessaire)"
            className="input-field"
            maxLength={8}
          />
          <button type="submit" className="whatsapp-button" disabled={loading}>
            {loading ? 'Chargement...' : 'Se connecter'}
          </button>
          <button
            type="button"
            className="resend-button"
            onClick={handleResendCode}
            disabled={loading}
          >
            Renvoyer le code
          </button>
        </form>
      </div>
    </div>
  );
};

export default Login;
