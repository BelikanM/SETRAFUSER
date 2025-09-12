// src/pages/EmployeeCertificates.js
import React, { useState, useEffect, useContext } from 'react';
import { UserContext } from '../context/UserContext';
import { FaClock, FaUser, FaEnvelope, FaUserTie, FaCertificate, FaEye, FaDownload, FaCrown } from 'react-icons/fa';
import './EmployeeCertificates.css';

const EmployeeCertificates = () => {
  const { user, users } = useContext(UserContext);
  const [tick, setTick] = useState(0);
  const [showMedia, setShowMedia] = useState({});
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState('all'); // all, expired, expiring, valid
  const [isDesktop, setIsDesktop] = useState(window.innerWidth > 768);

  useEffect(() => {
    const interval = setInterval(() => {
      setTick((prev) => prev + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const handleResize = () => {
      setIsDesktop(window.innerWidth > 768);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  if (!user) {
    return (
      <div className="error-container">
        Utilisateur non chargé. Veuillez vous reconnecter.
      </div>
    );
  }

  const isAdmin = user.role === 'admin';

  let displayedUsers = [];
  if (user.role === 'admin' || user.role === 'manager') {
    displayedUsers = users.filter((u) => u.role === 'employee' || (u.role === 'admin' && isAdmin));
  } else if (user.role === 'employee') {
    displayedUsers = [user];
  } else {
    return (
      <div className="error-container">
        Accès refusé.
      </div>
    );
  }

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

  const filteredUsers = displayedUsers
    .filter((emp) => {
      const nameMatch = `${emp.firstName} ${emp.lastName}`.toLowerCase().includes(searchQuery.toLowerCase());
      const certMatch = emp.certificates.some((cert) =>
        cert.title.toLowerCase().includes(searchQuery.toLowerCase())
      );
      return nameMatch || certMatch;
    });

  return (
    <div className="certificates-page">
      <div className="certificates-container">
        <header className="page-header">
          <h1 className="page-title">
            {user.role === 'employee' ? 'Mes certificats' : 'Certificats des employés'}
            {isAdmin && <span className="admin-subtitle">et Administrateurs</span>}
          </h1>
        </header>

        <main className="certificates-content">
          <div className="search-filters">
            <input
              type="text"
              placeholder="Rechercher par nom d'employé ou titre de certificat..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="search-input"
            />
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="filter-select"
            >
              <option value="all">Tous les statuts</option>
              <option value="expired">Expirés</option>
              <option value="expiring">Expirant bientôt</option>
              <option value="valid">Valides</option>
            </select>
          </div>
          <div className={`certificates-grid ${user.role === 'employee' ? 'single-column' : 'multi-column'} ${isDesktop ? 'desktop' : 'mobile'}`}>
            {filteredUsers.map((emp) => {
              const filteredCerts = emp.certificates.filter((cert) => {
                const now = new Date();
                const expiry = new Date(cert.expiryDate);
                const diff = expiry - now;
                if (filterStatus === 'expired') return diff < 0;
                if (filterStatus === 'expiring') return diff > 0 && diff < 30 * 24 * 60 * 60 * 1000;
                if (filterStatus === 'valid') return diff >= 30 * 24 * 60 * 60 * 1000;
                return true;
              });

              return (
                <div key={emp._id} className={`certificate-card ${emp.role === 'admin' ? 'admin-card' : ''}`}>
                  {emp.role === 'admin' && isAdmin && (
                    <div className="admin-badge">
                      <FaCrown size={12} />
                      ADMIN
                    </div>
                  )}
                  
                  <div className="employee-info">
                    <div className="profile-section">
                      {emp.profilePhoto ? (
                        <img
                          src={`https://setrafbackend.onrender.com/${emp.profilePhoto}`}
                          alt="Photo de profil"
                          className={`profile-photo ${emp.role === 'admin' ? 'admin-photo' : ''}`}
                        />
                      ) : (
                        <div className={`profile-placeholder ${emp.role === 'admin' ? 'admin-placeholder' : ''}`}>
                          Pas de photo
                        </div>
                      )}
                    </div>
                    
                    <div className="employee-details">
                      <div className="detail-item">
                        <FaUser className={emp.role === 'admin' ? 'admin-icon' : ''} />
                        <span className={`employee-name ${emp.role === 'admin' ? 'admin-text' : ''}`}>
                          {emp.firstName} {emp.lastName}
                        </span>
                      </div>
                      <div className="detail-item">
                        <FaEnvelope className={emp.role === 'admin' ? 'admin-icon' : ''} />
                        <span>{emp.email}</span>
                      </div>
                      <div className="detail-item">
                        <FaUserTie className={emp.role === 'admin' ? 'admin-icon' : ''} />
                        <span className={emp.role === 'admin' ? 'admin-text' : ''}>
                          Rôle : {emp.role === 'admin' ? 'Administrateur' : emp.role}
                        </span>
                      </div>
                      <div className="detail-item">
                        <FaCertificate className={emp.role === 'admin' ? 'admin-icon' : ''} />
                        <span>Nombre de certificats : {filteredCerts.length}</span>
                      </div>
                    </div>
                  </div>

                  <h3 className={`certificates-title ${emp.role === 'admin' ? 'admin-title' : ''}`}>
                    Certificats
                  </h3>

                  <div className="certificates-list">
                    {filteredCerts.length === 0 ? (
                      <p className="no-certificates">Aucun certificat.</p>
                    ) : (
                      filteredCerts.map((cert, index) => {
                        const mediaKey = `${emp._id}-${index}`;
                        const isExpired = new Date(cert.expiryDate) < new Date();
                        
                        return (
                          <div key={index} className={`certificate-item ${emp.role === 'admin' ? 'admin-certificate' : ''}`}>
                            <h4 className={`certificate-title ${emp.role === 'admin' ? 'admin-cert-title' : ''}`}>
                              {cert.title}
                            </h4>
                            
                            <div className="certificate-dates">
                              <p>Date de création : {new Date(cert.creationDate).toLocaleDateString()}</p>
                              <p>Date d'expiration : {new Date(cert.expiryDate).toLocaleDateString()}</p>
                            </div>
                            
                            <p className="countdown-info">
                              <FaClock className={emp.role === 'admin' ? 'admin-icon' : ''} />
                              Écoulement du temps : 
                              <span className={`countdown ${isExpired ? 'expired' : (emp.role === 'admin' ? 'admin-countdown' : '')}`}>
                                {calculateCountdown(cert.expiryDate)}
                              </span>
                            </p>
                            
                            {isExpired && (
                              <p className="expired-notice">Délai dépassé</p>
                            )}
                            
                            {(cert.imagePath || cert.filePath) && (
                              <button 
                                onClick={() => toggleMedia(mediaKey)} 
                                className={`media-toggle-btn ${emp.role === 'admin' ? 'admin-btn' : ''}`}
                              >
                                {showMedia[mediaKey] ? 'Fermer' : 'Ouvrir le média'}
                              </button>
                            )}
                            
                            {showMedia[mediaKey] && (
                              <div className="media-content">
                                {cert.imagePath && (
                                  <img
                                    src={`https://setrafbackend.onrender.com/${cert.imagePath}`}
                                    alt="Image du certificat"
                                    className={`certificate-image ${emp.role === 'admin' ? 'admin-image' : ''}`}
                                  />
                                )}
                                {cert.filePath && (
                                  <div className="pdf-actions">
                                    <a 
                                      href={`https://setrafbackend.onrender.com/${cert.filePath}`} 
                                      target="_blank" 
                                      rel="noopener noreferrer" 
                                      className={`pdf-link ${emp.role === 'admin' ? 'admin-link' : ''}`}
                                    >
                                      <FaEye /> Ouvrir PDF
                                    </a>
                                    <a 
                                      href={`https://setrafbackend.onrender.com/${cert.filePath}`} 
                                      download 
                                      className={`pdf-link ${emp.role === 'admin' ? 'admin-link' : ''}`}
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
        </main>

        <footer className="page-footer">
          <div className="footer-content">
            <p>&copy; 2024 Gestion des Certificats - Tous droits réservés</p>
            <p>Dernière mise à jour : {new Date().toLocaleDateString()}</p>
          </div>
        </footer>
      </div>
    </div>
  );
};

export default EmployeeCertificates;