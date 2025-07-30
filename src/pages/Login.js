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
  const [isVerificationStep, setIsVerificationStep] = useState(false);
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
        setIsVerificationStep(true);
        setMessage('Un code de vérification a été envoyé à votre email.');
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Erreur lors de la vérification du statut');
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData({ ...formData, [name]: value });
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setMessage('');

    try {
      const res = await axios.post('http://localhost:5000/api/login', {
        email: formData.email,
        password: formData.password,
      });
      if (res.data.message === 'Compte non vérifié. Vérifiez votre email pour le code.') {
        setIsVerificationStep(true);
        setMessage('Un code de vérification a été envoyé à votre email.');
      } else {
        localStorage.setItem('token', res.data.token);
        navigate('/dashboard');
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Erreur lors de la connexion');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyCode = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setMessage('');

    try {
      const res = await axios.post('http://localhost:5000/api/verify-code', {
        email: formData.email,
        code: formData.verificationCode,
      });
      localStorage.setItem('token', res.data.token);
      navigate('/dashboard');
    } catch (err) {
      setError(err.response?.data?.message || 'Code de vérification invalide');
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
        <h2>{isVerificationStep ? 'Vérification du code' : 'Connexion'}</h2>
        {error && <p className="error">{error}</p>}
        {message && <p className="success">{message}</p>}

        {!isVerificationStep ? (
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
            <button type="submit" className="whatsapp-button" disabled={loading}>
              {loading ? 'Chargement...' : 'Se connecter'}
            </button>
          </form>
        ) : (
          <form onSubmit={handleVerifyCode}>
            <input
              type="text"
              name="verificationCode"
              value={formData.verificationCode}
              onChange={handleInputChange}
              placeholder="Code de vérification"
              className="input-field"
              required
            />
            <button type="submit" className="whatsapp-button" disabled={loading}>
              {loading ? 'Chargement...' : 'Vérifier'}
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
        )}
      </div>
    </div>
  );
};

export default Login;
