// src/pages/EmployeeCertificates.js
import React, { useState, useEffect, useContext } from 'react';
import { UserContext } from '../context/UserContext';
import { FaClock, FaUser, FaEnvelope, FaUserTie, FaCertificate, FaEye, FaDownload } from 'react-icons/fa';
import './EmployeeCertificates.css'; // Remplace l'import de Dashboard.css



const EmployeeCertificates = () => {
  const { user, users } = useContext(UserContext);
  const [tick, setTick] = useState(0);
  const [showMedia, setShowMedia] = useState({});

  useEffect(() => {
    const interval = setInterval(() => {
      setTick((prev) => prev + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  if (!user) {
    return <div className="error">Utilisateur non chargé. Veuillez vous reconnecter.</div>;
  }

  const isAdmin = user.role === 'admin';

  let displayedUsers = [];
  if (user.role === 'admin' || user.role === 'manager') {
    displayedUsers = users.filter((u) => u.role === 'employee');
  } else if (user.role === 'employee') {
    displayedUsers = [user];
  } else {
    return <div className="error">Accès refusé.</div>;
  }

  // Fonction pour calculer le compte à rebours (écoulement du temps)
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

  const toggleMedia = (key) => {
    setShowMedia((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  return (
    <div className="employees-certificates-container" style={{ 
      padding: '20px', 
      minHeight: '100vh', 
      backgroundColor: '#2d2d2d', // Fond sombre inspiré de l'image
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center'
    }}>
      <h1 style={{ 
        textAlign: 'center', 
        marginBottom: '20px', 
        color: '#fff', // Titre en blanc comme dans l'image
        fontSize: '24px',
        fontWeight: 'bold'
      }}>
        {user.role === 'employee' ? 'Mes certificats' : 'Certificats des employés'}
      </h1>
      <div 
        className="employees-grid" 
        style={{ 
          maxWidth: user.role === 'employee' ? '400px' : '1200px', // Largeur ajustée pour centrage et grille
          margin: '0 auto', // Centre la grille
          display: 'grid', 
          gridTemplateColumns: user.role === 'employee' ? '1fr' : 'repeat(auto-fit, minmax(300px, 1fr))', // Une seule carte pour employé, grille pour admin
          gap: '20px', 
          overflowY: 'auto', 
          maxHeight: '80vh', 
          padding: '0 10px'
        }}
      >
        {displayedUsers.map((emp) => (
          <div key={emp._id} className="employee-card form-paper" style={{ 
            padding: '20px', 
            borderRadius: '15px', // Coins arrondis comme dans l'image
            boxShadow: '0 4px 8px rgba(0,0,0,0.3)', 
            backgroundColor: '#fff', 
            color: '#000', 
            width: '100%',
            display: 'flex',
            flexDirection: 'column'
          }}>
            <div style={{ display: 'flex', gap: '20px', marginBottom: '20px', alignItems: 'flex-start' }}>
              <div style={{ flex: '0 0 100px' }}>
                {emp.profilePhoto ? (
                  <img
                    src={`http://localhost:5000/${emp.profilePhoto}`}
                    alt="Photo de profil"
                    style={{ width: '100px', height: '150px', objectFit: 'cover', objectPosition: 'top', borderRadius: '8px' }} // Affichage jusqu'au thorax
                  />
                ) : (
                  <div style={{ width: '100px', height: '150px', backgroundColor: '#eee', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    Pas de photo
                  </div>
                )}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '5px', marginBottom: '5px' }}>
                  <FaUser /> <span>{emp.firstName} {emp.lastName}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '5px', marginBottom: '5px' }}>
                  <FaEnvelope /> <span>{emp.email}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '5px', marginBottom: '5px' }}>
                  <FaUserTie /> <span>Rôle : {emp.role}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                  <FaCertificate /> <span>Nombre de certificats : {emp.certificates.length}</span>
                </div>
              </div>
            </div>
            <h3 style={{ marginBottom: '15px', fontSize: '18px', fontWeight: '600' }}>Certificats</h3>
            <div className="certificates-list" style={{ flex: 1 }}>
              {emp.certificates.length === 0 ? (
                <p>Aucun certificat.</p>
              ) : (
                emp.certificates.map((cert, index) => {
                  const mediaKey = `${emp._id}-${index}`;
                  return (
                    <div key={index} className="certificate-item" style={{ 
                      border: '1px solid #eee', 
                      padding: '15px', 
                      marginBottom: '10px', 
                      borderRadius: '10px', 
                      backgroundColor: '#f9f9f9'
                    }}>
                      <h4 style={{ margin: '0 0 10px 0', fontSize: '16px', fontWeight: '500' }}>{cert.title}</h4>
                      <p style={{ margin: '5px 0' }}>Date de création : {new Date(cert.creationDate).toLocaleDateString()}</p>
                      <p style={{ margin: '5px 0' }}>Date d'expiration : {new Date(cert.expiryDate).toLocaleDateString()}</p>
                      <p style={{ margin: '5px 0' }}>
                        <FaClock /> Écoulement du temps : <span style={{ color: new Date(cert.expiryDate) < new Date() ? '#d32f2f' : '#000' }}>{calculateCountdown(cert.expiryDate)}</span>
                      </p>
                      {new Date(cert.expiryDate) < new Date() && <p style={{ margin: '5px 0', color: '#d32f2f' }}>Délai dépassé</p>}
                      {(cert.imagePath || cert.filePath) && (
                        <button 
                          onClick={() => toggleMedia(mediaKey)} 
                          style={{ marginTop: '10px', padding: '5px 10px', backgroundColor: '#007bff', color: '#fff', border: 'none', borderRadius: '5px', cursor: 'pointer' }}
                        >
                          {showMedia[mediaKey] ? 'Fermer' : 'Ouvrir'}
                        </button>
                      )}
                      {showMedia[mediaKey] && (
                        <div className="media-actions" style={{ marginTop: '10px' }}>
                          {cert.imagePath && (
                            <img
                              src={`http://localhost:5000/${cert.imagePath}`}
                              alt="Image du certificat"
                              style={{ maxWidth: '100%', height: 'auto', marginBottom: '10px' }}
                            />
                          )}
                          {cert.filePath && (
                            <div style={{ display: 'flex', gap: '10px' }}>
                              <a href={`http://localhost:5000/${cert.filePath}`} target="_blank" rel="noopener noreferrer" style={{ color: '#000' }}>
                                <FaEye /> Ouvrir PDF
                              </a>
                              <a href={`http://localhost:5000/${cert.filePath}`} download style={{ color: '#000' }}>
                                <FaDownload /> Télécharger PDF
                              </a>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default EmployeeCertificates;
