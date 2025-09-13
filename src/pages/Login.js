// src/pages/Login.js
import React, { useState, useEffect, useContext } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { UserContext } from '../context/UserContext'; // Import UserContext
import axios from 'axios';
import './Login.css'; // Assume same as Register CSS

const Login = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { setToken, setUser, setEmployees, setForms, fetchStats, fetchUsers } = useContext(UserContext); // Ajout de setEmployees, setForms, fetchStats, fetchUsers
  const [email, setEmail] = useState(location.state?.email || '');
  const [password, setPassword] = useState('');
  const [verificationCode, setVerificationCode] = useState('');
  const [showCodeInput, setShowCodeInput] = useState(false);
  const [showApprovalMessage, setShowApprovalMessage] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [isDesktop, setIsDesktop] = useState(window.innerWidth > 768);

  // Vérifier le localStorage au montage pour persister l'état d'attente d'approbation
  useEffect(() => {
    const pendingEmail = localStorage.getItem('pendingApprovalEmail');
    if (pendingEmail) {
      setEmail(pendingEmail);
      setShowApprovalMessage(true);
    }
  }, []);

  // Détection de la taille d'écran pour adaptation desktop/mobile
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
    setShowApprovalMessage(false); // Réinitialiser le message en cas de tentative

    // Si le code est requis, vérifier d'abord le code
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

    // Procéder à la connexion
    try {
      const res = await axios.post('https://setrafbackend.onrender.com/api/login', { email, password });
      const token = res.data.token;
      localStorage.setItem('token', token); // Stocker le token JWT
      setToken(token); // Mettre à jour le context immédiatement

      // Récupérer les données utilisateur
      const userRes = await axios.get('https://setrafbackend.onrender.com/api/user/profile', {
        headers: { Authorization: `Bearer ${token}` },
      });
      setUser(userRes.data); // Mettre à jour le context

      // Précharger les autres données avant navigation (fix pour afficher les données sans reload)
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

      localStorage.removeItem('pendingApprovalEmail'); // Nettoyer si succès
      navigate('/dashboard'); // Redirection après chargement des données
    } catch (err) {
      if (err.response?.data?.needsVerification) {
        setShowCodeInput(true);
        setError('Votre compte n\'est pas vérifié. Entrez le code de vérification (8 chiffres) envoyé par email.');
      } else if (err.response?.data?.needsApproval) {
        setShowApprovalMessage(true);
        localStorage.setItem('pendingApprovalEmail', email); // Persister l'email en attente
        setError('Votre compte est en attente d\'approbation par un administrateur. Veuillez patienter.');
      } else {
        setError(err.response?.data?.message || 'Erreur lors de la connexion');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
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