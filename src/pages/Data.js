// src/pages/EmployeeCertificates.js
import React, { useState, useEffect, useContext } from 'react';
import { UserContext } from '../context/UserContext';
import { FaClock, FaUser, FaEnvelope, FaUserTie, FaCertificate, FaEye, FaDownload, FaCrown } from 'react-icons/fa';

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
    return <div style={{ color: 'red', textAlign: 'center', padding: '20px' }}>Utilisateur non chargé. Veuillez vous reconnecter.</div>;
  }

  const isAdmin = user.role === 'admin';

  let displayedUsers = [];
  if (user.role === 'admin' || user.role === 'manager') {
    // Les admins voient les employés ET les autres admins
    displayedUsers = users.filter((u) => u.role === 'employee' || (u.role === 'admin' && isAdmin));
  } else if (user.role === 'employee') {
    // Les employés ne voient que leurs propres certificats
    displayedUsers = [user];
  } else {
    return <div style={{ color: 'red', textAlign: 'center', padding: '20px' }}>Accès refusé.</div>;
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

  // Fonction pour déterminer les couleurs en fonction du rôle
  const getCardColors = (userRole) => {
    if (userRole === 'admin') {
      return {
        backgroundColor: '#fff3cd', // Fond orange clair
        borderColor: '#ff8c00', // Bordure orange
        titleColor: '#cc6600' // Titre orange foncé
      };
    }
    return {
      backgroundColor: '#fff',
      borderColor: '#eee',
      titleColor: '#000'
    };
  };

  return (
    <div style={{ 
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
        {isAdmin && <span style={{ color: '#ff8c00', marginLeft: '10px' }}>et Administrateurs</span>}
      </h1>
      <div 
        style={{ 
          maxWidth: user.role === 'employee' ? '600px' : '1200px', // Augmenté pour employé pour mieux afficher les médias
          margin: '0 auto', // Centre la grille
          display: 'grid', 
          gridTemplateColumns: user.role === 'employee' ? '1fr' : 'repeat(auto-fit, minmax(300px, 1fr))', // Une seule carte pour employé, grille pour admin
          gap: '20px', 
          overflowY: 'auto', 
          maxHeight: '80vh', 
          padding: '0 10px'
        }}
      >
        {displayedUsers.map((emp) => {
          const cardColors = getCardColors(emp.role);
          return (
            <div key={emp._id} style={{ 
              padding: '20px', 
              borderRadius: '15px', // Coins arrondis comme dans l'image
              boxShadow: emp.role === 'admin' ? '0 4px 12px rgba(255, 140, 0, 0.3)' : '0 4px 8px rgba(0,0,0,0.3)', 
              backgroundColor: cardColors.backgroundColor,
              border: emp.role === 'admin' ? `2px solid ${cardColors.borderColor}` : 'none',
              color: '#000', 
              width: '100%',
              display: 'flex',
              flexDirection: 'column',
              position: 'relative'
            }}>
              {/* Badge administrateur visible uniquement pour les admins */}
              {emp.role === 'admin' && isAdmin && (
                <div style={{
                  position: 'absolute',
                  top: '10px',
                  right: '10px',
                  backgroundColor: '#ff8c00',
                  color: '#fff',
                  padding: '5px 10px',
                  borderRadius: '20px',
                  fontSize: '12px',
                  fontWeight: 'bold',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '5px'
                }}>
                  <FaCrown size={12} />
                  ADMIN
                </div>
              )}
              
              <div style={{ display: 'flex', gap: '20px', marginBottom: '20px', alignItems: 'flex-start' }}>
                <div style={{ flex: '0 0 100px' }}>
                  {emp.profilePhoto ? (
                    <img
                      src={`http://localhost:5000/${emp.profilePhoto}`}
                      alt="Photo de profil"
                      style={{ 
                        width: '100px', 
                        height: '150px', 
                        objectFit: 'cover', 
                        objectPosition: 'top', 
                        borderRadius: '8px',
                        border: emp.role === 'admin' ? '3px solid #ff8c00' : 'none'
                      }}
                    />
                  ) : (
                    <div style={{ 
                      width: '100px', 
                      height: '150px', 
                      backgroundColor: emp.role === 'admin' ? '#ffe5b3' : '#eee', 
                      borderRadius: '8px', 
                      display: 'flex', 
                      alignItems: 'center', 
                      justifyContent: 'center',
                      border: emp.role === 'admin' ? '3px solid #ff8c00' : 'none'
                    }}>
                      Pas de photo
                    </div>
                  )}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '5px', marginBottom: '5px' }}>
                    <FaUser style={{ color: emp.role === 'admin' ? '#ff8c00' : 'inherit' }} /> 
                    <span style={{ color: cardColors.titleColor, fontWeight: emp.role === 'admin' ? 'bold' : 'normal' }}>
                      {emp.firstName} {emp.lastName}
                    </span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '5px', marginBottom: '5px' }}>
                    <FaEnvelope style={{ color: emp.role === 'admin' ? '#ff8c00' : 'inherit' }} /> 
                    <span>{emp.email}</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '5px', marginBottom: '5px' }}>
                    <FaUserTie style={{ color: emp.role === 'admin' ? '#ff8c00' : 'inherit' }} /> 
                    <span style={{ color: emp.role === 'admin' ? '#ff8c00' : 'inherit', fontWeight: emp.role === 'admin' ? 'bold' : 'normal' }}>
                      Rôle : {emp.role === 'admin' ? 'Administrateur' : emp.role}
                    </span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                    <FaCertificate style={{ color: emp.role === 'admin' ? '#ff8c00' : 'inherit' }} /> 
                    <span>Nombre de certificats : {emp.certificates.length}</span>
                  </div>
                </div>
              </div>
              <h3 style={{ 
                marginBottom: '15px', 
                fontSize: '18px', 
                fontWeight: '600',
                color: cardColors.titleColor
              }}>
                Certificats
              </h3>
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {emp.certificates.length === 0 ? (
                  <p>Aucun certificat.</p>
                ) : (
                  emp.certificates.map((cert, index) => {
                    const mediaKey = `${emp._id}-${index}`;
                    return (
                      <div key={index} style={{ 
                        border: emp.role === 'admin' ? '1px solid #ff8c00' : '1px solid #eee', 
                        padding: '15px', 
                        borderRadius: '10px', 
                        backgroundColor: emp.role === 'admin' ? '#fff8f0' : '#f9f9f9',
                        boxShadow: emp.role === 'admin' ? '0 2px 6px rgba(255, 140, 0, 0.2)' : '0 2px 4px rgba(0,0,0,0.1)',
                        display: 'flex',
                        flexDirection: 'column'
                      }}>
                        <h4 style={{ 
                          margin: '0 0 10px 0', 
                          fontSize: '16px', 
                          fontWeight: '500',
                          color: emp.role === 'admin' ? '#cc6600' : 'inherit'
                        }}>
                          {cert.title}
                        </h4>
                                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '10px' }}>
                          <p style={{ margin: 0 }}>Date de création : {new Date(cert.creationDate).toLocaleDateString()}</p>
                          <p style={{ margin: 0 }}>Date d'expiration : {new Date(cert.expiryDate).toLocaleDateString()}</p>
                        </div>
                        <p style={{ margin: '5px 0' }}>
                          <FaClock style={{ color: emp.role === 'admin' ? '#ff8c00' : 'inherit' }} /> 
                          Écoulement du temps : <span style={{ color: new Date(cert.expiryDate) < new Date() ? '#d32f2f' : (emp.role === 'admin' ? '#cc6600' : '#000') }}>
                            {calculateCountdown(cert.expiryDate)}
                          </span>
                        </p>
                        {new Date(cert.expiryDate) < new Date() && <p style={{ margin: '5px 0', color: '#d32f2f' }}>Délai dépassé</p>}
                        {(cert.imagePath || cert.filePath) && (
                          <button 
                            onClick={() => toggleMedia(mediaKey)} 
                            style={{ 
                              marginTop: '10px', 
                              padding: '8px 16px', 
                              backgroundColor: emp.role === 'admin' ? '#ff8c00' : '#007bff', 
                              color: '#fff', 
                              border: 'none', 
                              borderRadius: '5px', 
                              cursor: 'pointer', 
                              transition: 'background-color 0.3s' 
                            }}
                            onMouseOver={(e) => e.target.style.backgroundColor = emp.role === 'admin' ? '#cc6600' : '#0056b3'}
                            onMouseOut={(e) => e.target.style.backgroundColor = emp.role === 'admin' ? '#ff8c00' : '#007bff'}
                          >
                            {showMedia[mediaKey] ? 'Fermer' : 'Ouvrir le média'}
                          </button>
                        )}
                        {showMedia[mediaKey] && (
                          <div style={{ marginTop: '10px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                            {cert.imagePath && (
                              <img
                                src={`http://localhost:5000/${cert.imagePath}`}
                                alt="Image du certificat"
                                style={{ 
                                  maxWidth: '100%', 
                                  height: 'auto', 
                                  borderRadius: '5px', 
                                  boxShadow: emp.role === 'admin' ? '0 2px 8px rgba(255, 140, 0, 0.3)' : '0 2px 4px rgba(0,0,0,0.1)',
                                  border: emp.role === 'admin' ? '2px solid #ff8c00' : 'none'
                                }}
                              />
                            )}
                            {cert.filePath && (
                              <div style={{ display: 'flex', gap: '15px' }}>
                                <a 
                                  href={`http://localhost:5000/${cert.filePath}`} 
                                  target="_blank" 
                                  rel="noopener noreferrer" 
                                  style={{ 
                                    color: emp.role === 'admin' ? '#ff8c00' : '#007bff', 
                                    textDecoration: 'none', 
                                    display: 'flex', 
                                    alignItems: 'center', 
                                    gap: '5px',
                                    fontWeight: emp.role === 'admin' ? 'bold' : 'normal'
                                  }}
                                >
                                  <FaEye /> Ouvrir PDF
                                </a>
                                <a 
                                  href={`http://localhost:5000/${cert.filePath}`} 
                                  download 
                                  style={{ 
                                    color: emp.role === 'admin' ? '#ff8c00' : '#007bff', 
                                    textDecoration: 'none', 
                                    display: 'flex', 
                                    alignItems: 'center', 
                                    gap: '5px',
                                    fontWeight: emp.role === 'admin' ? 'bold' : 'normal'
                                  }}
                                >
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
          );
        })}
      </div>
    </div>
  );
};

export default EmployeeCertificates;

