import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import axios from 'axios';
import './Verify.css';

const Verify = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [message, setMessage] = useState('Vérification en cours...');
  const [error, setError] = useState('');

  useEffect(() => {
    const verifyAccount = async () => {
      const params = new URLSearchParams(location.search);
      const token = params.get('token');
      if (!token) {
        setError('Lien de vérification invalide');
        return;
      }

      try {
        const res = await axios.get(`http://localhost:5000/api/verify?token=${token}`);
        localStorage.setItem('token', res.data.token);
        setMessage('Compte vérifié avec succès ! Redirection vers le tableau de bord...');
        setTimeout(() => navigate('/dashboard'), 2000);
      } catch (err) {
        setError(err.response?.data?.message || 'Erreur lors de la vérification');
      }
    };

    verifyAccount();
  }, [location, navigate]);

  return (
    <div className="whatsapp-container">
      <div className="form-paper">
        <h2>Vérification du compte</h2>
        {error && <p className="error">{error}</p>}
        {message && <p className="success">{message}</p>}
      </div>
    </div>
  );
};

export default Verify;
