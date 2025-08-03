// src/pages/Dashboard.js
import React, { useState, useEffect, useContext } from 'react';
import { UserContext } from '../context/UserContext'; // New import
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';
import { Bar } from 'react-chartjs-2';
import { FaEye, FaDownload, FaFilePdf, FaImage, FaClock, FaHome, FaUser, FaUsers, FaFileAlt, FaCertificate, FaUserCog, FaCheck, FaSignOutAlt, FaEnvelope, FaUserTie, FaCheckCircle, FaFileMedical, FaEdit, FaTrash, FaBuilding, FaBriefcase, FaCalendarAlt } from 'react-icons/fa';
import axios from 'axios';
import ReactQuill from 'react-quill';
import 'react-quill/dist/quill.snow.css';
import './Dashboard.css'; // Fichier CSS dédié pour le dashboard

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

const Dashboard = () => {
  const { user, setUser, employees, setEmployees, forms, setForms, users, setUsers, stats, setStats, loading, error, setError, handleLogout, fetchStats, fetchUsers, fetchData } = useContext(UserContext);
  const [sidebarOpen, setSidebarOpen] = useState(false); // Pour mobile
  const [currentSection, setCurrentSection] = useState('dashboard'); // Section actuelle

  // États pour édition profil
  const [editProfile, setEditProfile] = useState({ firstName: '', lastName: '' });

  // États pour certificats
  const [certificateForm, setCertificateForm] = useState({ title: '', creationDate: '', expiryDate: '', file: null, image: null });
  const [editingCertIndex, setEditingCertIndex] = useState(null);

  // États pour employés
  const [newEmployee, setNewEmployee] = useState({ firstName: '', lastName: '', email: '', department: '', position: '', hireDate: '' });
  const [selectedPhoto, setSelectedPhoto] = useState(null); // Photo upload
  const [selectedPdf, setSelectedPdf] = useState(null); // PDF/DOC upload
  const [isEditingEmployee, setIsEditingEmployee] = useState(false); // Flag édition
  const [editingEmployeeId, setEditingEmployeeId] = useState(null); // ID pour édition

  // États pour formulaires/blog
  const [newFormName, setNewFormName] = useState('');
  const [formContent, setFormContent] = useState('');
  const [isEditingForm, setIsEditingForm] = useState(false);
  const [editingFormId, setEditingFormId] = useState(null);

  // État pour forcer le re-render en temps réel
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (user) {
      setEditProfile({ firstName: user.firstName, lastName: user.lastName });
    }
  }, [user]);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token && !user && !loading) {
      fetchData(token);
    }
  }, [user, loading, fetchData]);

  // Fonction pour calculer le compte à rebours
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

  // Mise à jour en temps réel pour les comptes à rebours
  useEffect(() => {
    const interval = setInterval(() => {
      setTick((prev) => prev + 1);
    }, 1000); // Mise à jour toutes les secondes pour un effet chronomètre
    return () => clearInterval(interval);
  }, []);

  // Mise à jour photo profil
  const handlePhotoUpdate = async (e) => {
    const file = e.target.files[0];
    if (file) {
      const formData = new FormData();
      formData.append('profilePhoto', file);
      const token = localStorage.getItem('token');
      try {
        const res = await axios.post('http://localhost:5000/api/user/update-profile-photo', formData, {
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'multipart/form-data' },
        });
        setUser({ ...user, profilePhoto: res.data.profilePhoto });
      } catch (err) {
        if (err.response?.status === 401 || err.response?.status === 403) {
          setError('Token invalide. Veuillez vous reconnecter.');
          handleLogout();
        } else {
          setError('Erreur lors de la mise à jour de la photo');
        }
      }
    }
  };

  // Mise à jour nom profil
  const handleProfileUpdate = async (e) => {
    e.preventDefault();
    const token = localStorage.getItem('token');
    try {
      const res = await axios.post('http://localhost:5000/api/user/update-profile', editProfile, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setUser({ ...user, firstName: res.data.firstName, lastName: res.data.lastName });
      setError('');
    } catch (err) {
      setError('Erreur lors de la mise à jour du profil');
    }
  };

  // Gestion du formulaire pour ajouter/modifier un certificat
  const handleCertificateSubmit = async (e) => {
    e.preventDefault();
    if (new Date(certificateForm.expiryDate) <= new Date(certificateForm.creationDate)) {
      setError('La date d\'expiration doit être postérieure à la date de création.');
      return;
    }
    const formData = new FormData();
    formData.append('title', certificateForm.title);
    formData.append('creationDate', certificateForm.creationDate);
    formData.append('expiryDate', certificateForm.expiryDate);
    if (certificateForm.file) formData.append('file', certificateForm.file);
    if (certificateForm.image) formData.append('image', certificateForm.image);

    const token = localStorage.getItem('token');
    try {
      let res;
      if (editingCertIndex !== null) {
        formData.append('index', editingCertIndex);
        res = await axios.post('http://localhost:5000/api/user/edit-certificate', formData, {
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'multipart/form-data' },
        });
      } else {
        res = await axios.post('http://localhost:5000/api/user/add-certificate', formData, {
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'multipart/form-data' },
        });
      }
      setUser({ ...user, certificates: res.data.certificates });
      setCertificateForm({ title: '', creationDate: '', expiryDate: '', file: null, image: null });
      setEditingCertIndex(null);
      setError('');
      if (user.role === 'admin' || user.role === 'manager') {
        await fetchStats(token);
      }
    } catch (err) {
      setError('Erreur lors de l\'opération sur le certificat');
    }
  };

  // Préparation à la modification d'un certificat
  const startEditingCertificate = (index, cert) => {
    setEditingCertIndex(index);
    setCertificateForm({
      title: cert.title,
      creationDate: new Date(cert.creationDate).toISOString().split('T')[0],
      expiryDate: new Date(cert.expiryDate).toISOString().split('T')[0],
      file: null,
      image: null,
    });
  };

  // Suppression d'un certificat
  const handleDeleteCertificate = async (index) => {
    const token = localStorage.getItem('token');
    try {
      const res = await axios.post('http://localhost:5000/api/user/delete-certificate', { index }, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setUser({ ...user, certificates: res.data.certificates });
      if (user.role === 'admin' || user.role === 'manager') {
        await fetchStats(token);
      }
    } catch (err) {
      setError('Erreur lors de la suppression du certificat');
    }
  };

  // Ajout/Edition employé
  const handleEmployeeSubmit = async (e) => {
    e.preventDefault();
    const token = localStorage.getItem('token');
    const formData = new FormData();
    formData.append('firstName', newEmployee.firstName);
    formData.append('lastName', newEmployee.lastName);
    formData.append('email', newEmployee.email);
    formData.append('department', newEmployee.department);
    formData.append('position', newEmployee.position);
    formData.append('hireDate', newEmployee.hireDate);
    if (selectedPhoto) formData.append('profilePhoto', selectedPhoto);
    if (selectedPdf) formData.append('pdf', selectedPdf);

    try {
      let res;
      if (isEditingEmployee) {
        res = await axios.put(`http://localhost:5000/api/employees/${editingEmployeeId}`, formData, {
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'multipart/form-data' },
        });
        setEmployees(employees.map(emp => emp._id === editingEmployeeId ? res.data : emp));
        setIsEditingEmployee(false);
        setEditingEmployeeId(null);
      } else {
        res = await axios.post('http://localhost:5000/api/employees', formData, {
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'multipart/form-data' },
        });
        setEmployees([res.data, ...employees]); // Ajoute en premier
      }
      setNewEmployee({ firstName: '', lastName: '', email: '', department: '', position: '', hireDate: '' });
      setSelectedPhoto(null);
      setSelectedPdf(null);
      await fetchStats(token);
    } catch (err) {
      setError('Erreur lors de l\'opération sur l\'employé');
    }
  };

  // Edition employé
  const startEditingEmployee = (emp) => {
    setNewEmployee({
      firstName: emp.firstName,
      lastName: emp.lastName,
      email: emp.email,
      department: emp.department,
      position: emp.position,
      hireDate: new Date(emp.hireDate).toISOString().split('T')[0],
    });
    setSelectedPhoto(null); // Reset pour nouveau upload optionnel
    setSelectedPdf(null);
    setIsEditingEmployee(true);
    setEditingEmployeeId(emp._id);
  };

  // Suppression employé
  const handleDeleteEmployee = async (id) => {
    const token = localStorage.getItem('token');
    try {
      await axios.delete(`http://localhost:5000/api/employees/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setEmployees(employees.filter(emp => emp._id !== id));
      await fetchStats(token);
    } catch (err) {
      setError('Erreur lors de la suppression de l\'employé');
    }
  };

  // Fonction pour télécharger le PDF directement
  const handleDownloadPdf = async (pdfPath) => {
    const token = localStorage.getItem('token');
    try {
      const response = await axios.get(`http://localhost:5000/${pdfPath}`, {
        responseType: 'blob',
        headers: { Authorization: `Bearer ${token}` },
      });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', pdfPath.split('/').pop());
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (err) {
      setError('Erreur lors du téléchargement du PDF');
    }
  };

  // Ajout/Edition formulaire (blog)
  const handleFormSubmit = async (e) => {
    e.preventDefault();
    const token = localStorage.getItem('token');
    try {
      let res;
      if (isEditingForm) {
        res = await axios.put(`http://localhost:5000/api/forms/${editingFormId}`, { name: newFormName, content: formContent }, {
          headers: { Authorization: `Bearer ${token}` },
        });
        setForms(forms.map(f => f._id === editingFormId ? res.data : f));
        setIsEditingForm(false);
        setEditingFormId(null);
      } else {
        res = await axios.post('http://localhost:5000/api/forms', { name: newFormName, content: formContent }, {
          headers: { Authorization: `Bearer ${token}` },
        });
        setForms([res.data, ...forms]); // Ajoute en premier
      }
      setNewFormName('');
      setFormContent('');
    } catch (err) {
      setError('Erreur lors de l\'opération sur le formulaire');
    }
  };

  // Edition formulaire
  const startEditingForm = (form) => {
    setNewFormName(form.name);
    setFormContent(form.content || '');
    setIsEditingForm(true);
    setEditingFormId(form._id);
  };

  // Suppression formulaire
  const handleDeleteForm = async (id) => {
    const token = localStorage.getItem('token');
    try {
      await axios.delete(`http://localhost:5000/api/forms/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setForms(forms.filter(f => f._id !== id));
    } catch (err) {
      setError('Erreur lors de la suppression du formulaire');
    }
  };

  // Toggle rôle admin
  const handleToggleAdmin = async (userId, isAdmin) => {
    const token = localStorage.getItem('token');
    const newRole = isAdmin ? 'admin' : 'employee';
    try {
      await axios.post(`http://localhost:5000/api/users/${userId}/update-role`, { role: newRole }, {
        headers: { Authorization: `Bearer ${token}` },
      });
      await fetchUsers(token);
    } catch (err) {
      setError('Erreur lors de la mise à jour du rôle');
    }
  };

  // Approuver inscription
  const handleApproveUser = async (userId) => {
    const token = localStorage.getItem('token');
    try {
      await axios.post(`http://localhost:5000/api/users/${userId}/approve`, {}, {
        headers: { Authorization: `Bearer ${token}` },
      });
      await fetchUsers(token);
    } catch (err) {
      setError('Erreur lors de l\'approbation');
    }
  };

  // Rejeter inscription (invalider carte professionnelle)
  const handleRejectUser = async (userId) => {
    const token = localStorage.getItem('token');
    try {
      await axios.post(`http://localhost:5000/api/users/${userId}/reject`, {}, {
        headers: { Authorization: `Bearer ${token}` },
      });
      await fetchUsers(token);
    } catch (err) {
      setError('Erreur lors du rejet');
    }
  };

  const getChartData = () => {
    let totalCerts = 0;
    let expiredCerts = 0;
    let expiringSoon = 0;
    if (user?.role === 'admin' || user?.role === 'manager') {
      totalCerts = stats.totalCertificates;
      expiredCerts = stats.expiredCertificates;
      expiringSoon = 0; // Assumer que le backend peut être mis à jour pour fournir cette valeur
    } else if (user) {
      totalCerts = user.certificates.length;
      expiredCerts = user.certificates.filter(cert => new Date(cert.expiryDate) < new Date()).length;
      expiringSoon = user.certificates.filter(cert => {
        const diff = new Date(cert.expiryDate) - new Date();
        return diff > 0 && diff < 30 * 24 * 60 * 60 * 1000; // Dans les 30 prochains jours
      }).length;
    }
    return {
      labels: ['Certificats valides', 'Expirant bientôt', 'Certificats expirés'],
      datasets: [
        {
          label: 'Statistiques des certificats',
          data: [totalCerts - expiredCerts - expiringSoon, expiringSoon, expiredCerts],
          backgroundColor: ['rgba(75, 192, 192, 0.6)', 'rgba(255, 159, 64, 0.6)', 'rgba(255, 99, 132, 0.6)'],
          borderColor: ['rgba(75, 192, 192, 1)', 'rgba(255, 159, 64, 1)', 'rgba(255, 99, 132, 1)'],
          borderWidth: 1,
        },
      ],
    };
  };

  if (loading) return <div className="loading">Chargement...</div>;
  if (error) return <div className="error">{error}</div>;
  if (!user) return <div className="error">Utilisateur non chargé. Veuillez vous reconnecter.</div>;

  // Tri des certificats par date d'expiration (chronologie : le plus proche en premier)
  const sortedCertificates = [...(user?.certificates || [])].sort((a, b) => new Date(a.expiryDate) - new Date(b.expiryDate));

  // Classification des certificats
  const expiredCerts = sortedCertificates.filter(cert => new Date(cert.expiryDate) < new Date());
  const expiringSoonCerts = sortedCertificates.filter(cert => {
    const diff = new Date(cert.expiryDate) - new Date();
    return diff > 0 && diff < 30 * 24 * 60 * 60 * 1000;
  });
  const validCerts = sortedCertificates.filter(cert => {
    const diff = new Date(cert.expiryDate) - new Date();
    return diff >= 30 * 24 * 60 * 60 * 1000;
  });

  return (
    <div className="dashboard-container">
      {/* Sidebar navigation */}
      <div className={`sidebar ${sidebarOpen ? 'open' : ''}`}>
        <ul>
          <li onClick={() => setCurrentSection('dashboard')} title="Dashboard"><FaHome /></li>
          <li onClick={() => setCurrentSection('profile')} title="Profil"><FaUser /></li>
          {(user.role === 'admin' || user.role === 'manager') && (
            <>
              <li onClick={() => setCurrentSection('employees')} title="Gérer les employés"><FaUsers /></li>
              <li onClick={() => setCurrentSection('forms')} title="Gérer les formulaires"><FaFileAlt /></li>
            </>
          )}
          <li onClick={() => setCurrentSection('certificates')} title="Mes certificats"><FaCertificate /></li>
          {user.role === 'admin' && (
            <>
              <li onClick={() => setCurrentSection('users')} title="Gérer les utilisateurs"><FaUserCog /></li>
              <li onClick={() => setCurrentSection('approvals')} title="Valider les inscriptions"><FaCheck /></li>
            </>
          )}
          <li onClick={handleLogout} title="Déconnexion"><FaSignOutAlt /></li>
        </ul>
      </div>

      {/* Bouton toggle sidebar pour mobile */}
      <button className="sidebar-toggle" onClick={() => setSidebarOpen(!sidebarOpen)}>
        ☰
      </button>

      {/* Contenu principal basé sur la section */}
      <div className="main-content">
        {currentSection === 'dashboard' && (
          <>
            <div className="header">
              <h1>Bienvenue, {user.firstName} {user.lastName} !</h1>
              <p>Rôle : {user.role}</p>
            </div>

            {/* Widgets de stats */}
            <div className="widgets-grid">
              <div className="widget form-paper">
                <h3>Statistiques</h3>
                {(user.role === 'admin' || user.role === 'manager') ? (
                  <>
                    <p>Employés totaux : {stats.totalEmployees}</p>
                    <p>Certificats totaux : {stats.totalCertificates}</p>
                    <p><FaClock /> Certificats expirés : {stats.expiredCertificates}</p>
                    <p><FaClock /> Certificats expirant bientôt (30 jours) : {0 /* Assumer backend pour valeur globale */}</p>
                  </>
                ) : (
                  <>
                    <p>Certificats totaux : {user.certificates.length}</p>
                    <p><FaClock /> Certificats expirés : {user.certificates.filter(cert => new Date(cert.expiryDate) < new Date()).length}</p>
                    <p><FaClock /> Certificats expirant bientôt (30 jours) : {user.certificates.filter(cert => {
                      const diff = new Date(cert.expiryDate) - new Date();
                      return diff > 0 && diff < 30 * 24 * 60 * 60 * 1000;
                    }).length}</p>
                  </>
                )}
                {user.role === 'admin' && (
                  <>
                    <p>Utilisateurs totaux : {stats.totalUsers}</p>
                    <p>Utilisateurs vérifiés : {stats.verifiedUsers}</p>
                    <p>Utilisateurs approuvés : {stats.approvedUsers}</p>
                  </>
                )}
              </div>
              <div className="widget form-paper">
                <h3>Graphique des certificats</h3>
                <Bar data={getChartData()} options={{ responsive: true, plugins: { legend: { position: 'top' } } }} />
              </div>
            </div>

            {/* Tableau récent */}
            {(user.role === 'admin' || user.role === 'manager') ? (
              <div className="table-section form-paper">
                <h3>Employés récents</h3>
                <table className="dashboard-table">
                  <thead>
                    <tr>
                      <th>Nom</th>
                      <th>Email</th>
                      <th>Poste</th>
                    </tr>
                  </thead>
                  <tbody>
                    {employees.slice(0, 5).map((emp) => (
                      <tr key={emp._id}>
                        <td>{emp.firstName} {emp.lastName}</td>
                        <td>{emp.email}</td>
                        <td>{emp.position}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="table-section form-paper">
                <h3>Mes certificats récents (triés par expiration proche)</h3>
                <div className="certificates-grid">
                  {sortedCertificates.slice(0, 5).map((cert, index) => (
                    <div className="certificate-card" key={index}>
                      <h3>{cert.title}</h3>
                      <p>Date de début : {new Date(cert.creationDate).toLocaleDateString()}</p>
                      <p>Date de fin : {new Date(cert.expiryDate).toLocaleDateString()}</p>
                      <div className="countdown-box">
                        <p><FaClock /> Décompte : <span style={{ color: 'red' }}>{calculateCountdown(cert.expiryDate)}</span></p>
                      </div>
                      {cert.imagePath && (
                        <img 
                          src={`http://localhost:5000/${cert.imagePath}`} 
                          alt="Certificate Image" 
                          className="cert-image" 
                          style={{ maxWidth: '100%', height: 'auto', objectFit: 'contain', display: 'block' }}
                        />
                      )}
                      {cert.filePath && (
                        <div className="pdf-actions">
                          <a href={`http://localhost:5000/${cert.filePath}`} target="_blank" rel="noopener noreferrer">
                            <FaEye /> Ouvrir
                          </a>
                          <a href={`http://localhost:5000/${cert.filePath}`} download>
                            <FaDownload /> Télécharger
                          </a>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}

        {currentSection === 'profile' && (
          <div className="profile-section form-paper">
            <h2>Profil</h2>
            <div className="avatar-container">
              {user.profilePhoto ? (
                <img src={`http://localhost:5000/${user.profilePhoto}`} alt="Profile" className="avatar" />
              ) : (
                <div className="avatar-placeholder">📷</div>
              )}
              <input
                accept="image/*"
                type="file"
                id="profile-photo-update"
                className="file-input"
                onChange={handlePhotoUpdate}
              />
              <label htmlFor="profile-photo-update" className="upload-button">
                Mettre à jour la photo
              </label>
            </div>
            <form onSubmit={handleProfileUpdate}>
              <input
                type="text"
                value={editProfile.firstName}
                onChange={(e) => setEditProfile({ ...editProfile, firstName: e.target.value })}
                placeholder="Prénom"
                className="input-field"
                required
              />
              <input
                type="text"
                value={editProfile.lastName}
                onChange={(e) => setEditProfile({ ...editProfile, lastName: e.target.value })}
                placeholder="Nom"
                className="input-field"
                required
              />
              <button type="submit" className="whatsapp-button">Mettre à jour le profil</button>
            </form>
            <p>NIP : {user.nip || 'Non renseigné'}</p>
            <p>Passeport : {user.passport || 'Non renseigné'}</p>
          </div>
        )}

        {currentSection === 'certificates' && (
          <div className="certificates-section form-paper">
            <h2>Mes certificats (classifiés par statut d'expiration)</h2>
            <h3>Expirés</h3>
            <div className="certificates-grid">
              {expiredCerts.map((cert, index) => (
                <div className="certificate-card" key={index}>
                  <h3>{cert.title}</h3>
                  <p>Date de début : {new Date(cert.creationDate).toLocaleDateString()}</p>
                  <p>Date de fin : {new Date(cert.expiryDate).toLocaleDateString()}</p>
                  <div className="countdown-box">
                    <p><FaClock /> Décompte : <span style={{ color: 'red' }}>{calculateCountdown(cert.expiryDate)}</span></p>
                  </div>
                  {cert.imagePath && (
                    <img 
                      src={`http://localhost:5000/${cert.imagePath}`} 
                      alt="Certificate Image" 
                      className="cert-image" 
                      style={{ maxWidth: '100%', height: 'auto', objectFit: 'contain', display: 'block' }}
                    />
                  )}
                  {cert.filePath && (
                    <div className="pdf-actions">
                      <a href={`http://localhost:5000/${cert.filePath}`} target="_blank" rel="noopener noreferrer">
                        <FaEye /> Ouvrir
                      </a>
                      <a href={`http://localhost:5000/${cert.filePath}`} download>
                        <FaDownload /> Télécharger
                      </a>
                    </div>
                  )}
                  <div className="actions">
                    <button onClick={() => startEditingCertificate(index, cert)}>Modifier</button>
                    <button onClick={() => handleDeleteCertificate(index)}>Supprimer</button>
                  </div>
                </div>
              ))}
            </div>
            <h3>Expirant bientôt (dans 30 jours)</h3>
            <div className="certificates-grid">
              {expiringSoonCerts.map((cert, index) => (
                <div className="certificate-card" key={index}>
                  <h3>{cert.title}</h3>
                  <p>Date de début : {new Date(cert.creationDate).toLocaleDateString()}</p>
                  <p>Date de fin : {new Date(cert.expiryDate).toLocaleDateString()}</p>
                  <div className="countdown-box">
                    <p><FaClock /> Décompte : <span style={{ color: 'red' }}>{calculateCountdown(cert.expiryDate)}</span></p>
                  </div>
                  {cert.imagePath && (
                    <img 
                      src={`http://localhost:5000/${cert.imagePath}`} 
                      alt="Certificate Image" 
                      className="cert-image" 
                      style={{ maxWidth: '100%', height: 'auto', objectFit: 'contain', display: 'block' }}
                    />
                  )}
                  {cert.filePath && (
                    <div className="pdf-actions">
                      <a href={`http://localhost:5000/${cert.filePath}`} target="_blank" rel="noopener noreferrer">
                        <FaEye /> Ouvrir
                      </a>
                      <a href={`http://localhost:5000/${cert.filePath}`} download>
                        <FaDownload /> Télécharger
                      </a>
                    </div>
                  )}
                  <div className="actions">
                    <button onClick={() => startEditingCertificate(index, cert)}>Modifier</button>
                    <button onClick={() => handleDeleteCertificate(index)}>Supprimer</button>
                  </div>
                </div>
              ))}
            </div>
            <h3>Valides</h3>
            <div className="certificates-grid">
              {validCerts.map((cert, index) => (
                <div className="certificate-card" key={index}>
                  <h3>{cert.title}</h3>
                  <p>Date de début : {new Date(cert.creationDate).toLocaleDateString()}</p>
                  <p>Date de fin : {new Date(cert.expiryDate).toLocaleDateString()}</p>
                  <div className="countdown-box">
                    <p><FaClock /> Décompte : <span style={{ color: 'red' }}>{calculateCountdown(cert.expiryDate)}</span></p>
                  </div>
                  {cert.imagePath && (
                    <img 
                      src={`http://localhost:5000/${cert.imagePath}`} 
                      alt="Certificate Image" 
                      className="cert-image" 
                      style={{ maxWidth: '100%', height: 'auto', objectFit: 'contain', display: 'block' }}
                    />
                  )}
                  {cert.filePath && (
                    <div className="pdf-actions">
                      <a href={`http://localhost:5000/${cert.filePath}`} target="_blank" rel="noopener noreferrer">
                        <FaEye /> Ouvrir
                      </a>
                      <a href={`http://localhost:5000/${cert.filePath}`} download>
                        <FaDownload /> Télécharger
                      </a>
                    </div>
                  )}
                  <div className="actions">
                    <button onClick={() => startEditingCertificate(index, cert)}>Modifier</button>
                    <button onClick={() => handleDeleteCertificate(index)}>Supprimer</button>
                  </div>
                </div>
              ))}
            </div>
            <div className="certificate-form-card">
              <h3>{editingCertIndex !== null ? 'Modifier le certificat' : 'Ajouter un certificat'}</h3>
              {user.profilePhoto && (
                <div className="profile-circle">
                  <img 
                    src={`http://localhost:5000/${user.profilePhoto}`} 
                    alt="Profile" 
                    className="small-avatar" 
                    style={{ maxWidth: '100%', height: 'auto', objectFit: 'contain', display: 'block', borderRadius: '50%' }}
                  />
                </div>
              )}
              <form onSubmit={handleCertificateSubmit}>
                <input
                  type="text"
                  value={certificateForm.title}
                  onChange={(e) => setCertificateForm({ ...certificateForm, title: e.target.value })}
                  placeholder="Titre"
                  required
                />
                <input
                  type="date"
                  value={certificateForm.creationDate}
                  onChange={(e) => setCertificateForm({ ...certificateForm, creationDate: e.target.value })}
                  required
                />
                <input
                  type="date"
                  value={certificateForm.expiryDate}
                  onChange={(e) => setCertificateForm({ ...certificateForm, expiryDate: e.target.value })}
                  required
                />
                <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginBottom: '10px' }}>
                  <div style={{ flex: '1 1 200px' }}>
                    <input
                      type="file"
                      accept="application/pdf"
                      id="cert-pdf"
                      className="file-input"
                      onChange={(e) => setCertificateForm({ ...certificateForm, file: e.target.files[0] })}
                      style={{ display: 'none' }}
                    />
                    <label htmlFor="cert-pdf" className="upload-button" style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                      <FaFilePdf /> Upload PDF
                    </label>
                  </div>
                  <div style={{ flex: '1 1 200px' }}>
                    <input
                      type="file"
                      accept="image/*"
                      id="cert-image"
                      className="file-input"
                      onChange={(e) => setCertificateForm({ ...certificateForm, image: e.target.files[0] })}
                      style={{ display: 'none' }}
                    />
                    <label htmlFor="cert-image" className="upload-button" style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                      <FaImage /> Upload Image
                    </label>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                  <button type="submit" className="whatsapp-button" style={{ flex: '1 1 100px' }}>
                    {editingCertIndex !== null ? 'Sauvegarder' : 'Ajouter'}
                  </button>
                  {editingCertIndex !== null && (
                    <button 
                      type="button" 
                      className="whatsapp-button" 
                      style={{ flex: '1 1 100px' }}
                      onClick={() => { setEditingCertIndex(null); setCertificateForm({ title: '', creationDate: '', expiryDate: '', file: null, image: null }); }}
                    >
                      Annuler
                    </button>
                  )}
                </div>
              </form>
            </div>
          </div>
        )}

        {currentSection === 'employees' && (user.role === 'admin' || user.role === 'manager') && (
          <div className="employees-section form-paper">
            <h2>Gérer les employés</h2>
            <div className="employees-grid" style={{ overflowY: 'auto', maxHeight: '400px', display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '20px' }}>
              {employees.map((emp) => (
                <div className="employee-card" key={emp._id} style={{ display: 'flex', gap: '20px', border: '1px solid #ddd', padding: '15px', borderRadius: '12px', backgroundColor: '#fff', boxShadow: '0 4px 8px rgba(0,0,0,0.2)', transition: 'transform 0.2s', cursor: 'pointer' }}>
                  <div style={{ flex: '0 0 100px' }}>
                    {emp.profilePhoto ? (
                      <img src={`http://localhost:5000/${emp.profilePhoto}`} alt="Photo" style={{ width: '100px', height: '100px', borderRadius: '8px', objectFit: 'cover' }} />
                    ) : (
                      <div style={{ width: '100px', height: '100px', backgroundColor: '#eee', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>Pas de photo</div>
                    )}
                  </div>
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '5px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '5px', color: 'blue' }}>
                      <FaUser />
                      <span>{emp.firstName} {emp.lastName}</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '5px', color: 'blue' }}>
                      <FaEnvelope />
                      <span>{emp.email}</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '5px', color: 'blue' }}>
                      <FaBuilding />
                      <span>{emp.department}</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '5px', color: 'blue' }}>
                      <FaBriefcase />
                      <span>{emp.position}</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '5px', color: 'blue' }}>
                      <FaCalendarAlt />
                      <span>{new Date(emp.hireDate).toLocaleDateString()}</span>
                    </div>
                    {emp.pdfPath && (
                      <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
                        <a href={`http://localhost:5000/${emp.pdfPath}`} target="_blank" rel="noopener noreferrer">
                          <FaEye /> Consulter PDF
                        </a>
                        <button onClick={() => handleDownloadPdf(emp.pdfPath)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
                          <FaDownload /> Télécharger PDF
                        </button>
                      </div>
                    )}
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', gap: '10px' }}>
                    <button onClick={() => startEditingEmployee(emp)} style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                      <FaEdit /> Modifier
                    </button>
                    <button onClick={() => handleDeleteEmployee(emp._id)} style={{ display: 'flex', alignItems: 'center', gap: '5px', backgroundColor: 'red' }}>
                      <FaTrash /> Supprimer
                    </button>
                  </div>
                </div>
              ))}
            </div>
            <h3>{isEditingEmployee ? 'Modifier l\'employé' : 'Ajouter un employé'}</h3>
            <form onSubmit={handleEmployeeSubmit}>
              <input
                type="text"
                value={newEmployee.firstName}
                onChange={(e) => setNewEmployee({ ...newEmployee, firstName: e.target.value })}
                placeholder="Prénom"
                required
              />
              <input
                type="text"
                value={newEmployee.lastName}
                onChange={(e) => setNewEmployee({ ...newEmployee, lastName: e.target.value })}
                placeholder="Nom"
                required
              />
              <input
                type="email"
                value={newEmployee.email}
                onChange={(e) => setNewEmployee({ ...newEmployee, email: e.target.value })}
                placeholder="Email"
                required
              />
              <input
                type="text"
                value={newEmployee.department}
                onChange={(e) => setNewEmployee({ ...newEmployee, department: e.target.value })}
                placeholder="Département"
                required
              />
              <input
                type="text"
                value={newEmployee.position}
                onChange={(e) => setNewEmployee({ ...newEmployee, position: e.target.value })}
                placeholder="Poste"
                required
              />
              <input
                type="date"
                value={newEmployee.hireDate}
                onChange={(e) => setNewEmployee({ ...newEmployee, hireDate: e.target.value })}
                required
              />
              <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginBottom: '10px' }}>
                <div style={{ flex: '1 1 200px' }}>
                  <input
                    type="file"
                    accept="image/*"
                    id="employee-photo"
                    className="file-input"
                    onChange={(e) => setSelectedPhoto(e.target.files[0])}
                    style={{ display: 'none' }}
                  />
                  <label htmlFor="employee-photo" className="upload-button" style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                    <FaImage /> Upload Photo
                  </label>
                </div>
                <div style={{ flex: '1 1 200px' }}>
                  <input
                    type="file"
                    accept=".pdf,.doc,.docx"
                    id="employee-pdf"
                    className="file-input"
                    onChange={(e) => setSelectedPdf(e.target.files[0])}
                    style={{ display: 'none' }}
                  />
                  <label htmlFor="employee-pdf" className="upload-button" style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                    <FaFilePdf /> Upload PDF/DOC
                  </label>
                </div>
              </div>
              <button type="submit" className="whatsapp-button">{isEditingEmployee ? 'Sauvegarder' : 'Ajouter'}</button>
              {isEditingEmployee && (
                <button type="button" onClick={() => { setIsEditingEmployee(false); setNewEmployee({ firstName: '', lastName: '', email: '', department: '', position: '', hireDate: '' }); setSelectedPhoto(null); setSelectedPdf(null); }} className="whatsapp-button" style={{ backgroundColor: 'gray', marginLeft: '10px' }}>
                  Annuler
                </button>
              )}
            </form>
          </div>
        )}

        {currentSection === 'forms' && (user.role === 'admin' || user.role === 'manager') && (
          <div className="forms-section form-paper">
            <h2>Gérer les articles de blog</h2>
            <div className="forms-list" style={{ marginBottom: '20px' }}>
              {forms.map((form) => (
                <div key={form._id} style={{ border: '1px solid #ddd', padding: '15px', marginBottom: '10px', borderRadius: '8px' }}>
                  <h4>{form.name}</h4>
                  <div dangerouslySetInnerHTML={{ __html: form.content ? form.content.substring(0, 200) + '...' : 'Pas de contenu' }} />
                  <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
                    <button onClick={() => startEditingForm(form)}><FaEdit /> Modifier</button>
                    <button onClick={() => handleDeleteForm(form._id)} style={{ backgroundColor: 'red' }}><FaTrash /> Supprimer</button>
                  </div>
                </div>
              ))}
            </div>
            <h3>{isEditingForm ? 'Modifier l\'article' : 'Créer un article'}</h3>
            <form onSubmit={handleFormSubmit}>
              <input
                type="text"
                value={newFormName}
                onChange={(e) => setNewFormName(e.target.value)}
                placeholder="Titre de l'article"
                required
              />
              <ReactQuill 
                value={formContent}
                onChange={setFormContent}
                modules={{
                  toolbar: [
                    [{ 'header': [1, 2, false] }],
                    ['bold', 'italic', 'underline', 'strike', 'blockquote'],
                    [{'list': 'ordered'}, {'list': 'bullet'}, {'indent': '-1'}, {'indent': '+1'}],
                    ['link', 'image'],
                    ['clean']
                  ],
                }}
                formats={['header', 'bold', 'italic', 'underline', 'strike', 'blockquote', 'list', 'bullet', 'indent', 'link', 'image']}
                style={{ height: '300px', marginBottom: '20px' }}
              />
              <button type="submit" className="whatsapp-button">{isEditingForm ? 'Sauvegarder' : 'Publier'}</button>
              {isEditingForm && (
                <button type="button" onClick={() => { setIsEditingForm(false); setNewFormName(''); setFormContent(''); setEditingFormId(null); }} className="whatsapp-button" style={{ backgroundColor: 'gray', marginLeft: '10px' }}>
                  Annuler
                </button>
              )}
            </form>
          </div>
        )}

        {currentSection === 'users' && user.role === 'admin' && (
          <div className="users-section form-paper" style={{ overflowX: 'auto' }}>
            <h2>Gérer les utilisateurs</h2>
            <table className="dashboard-table" style={{ minWidth: '800px' }}>
              <thead>
                <tr>
                  <th><FaUser /> Nom</th>
                  <th><FaEnvelope /> Email</th>
                  <th><FaUserTie /> Rôle</th>
                  <th><FaCheckCircle /> Admin ?</th>
                  <th><FaFileMedical /> Certificats</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u._id}>
                    <td style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '150px' }}>{u.firstName} {u.lastName}</td>
                    <td style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '200px' }}>{u.email}</td>
                    <td style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '100px' }}>{u.role}</td>
                    <td>
                      <input
                        type="checkbox"
                        checked={u.role === 'admin'}
                        onChange={(e) => handleToggleAdmin(u._id, e.target.checked)}
                      />
                    </td>
                    <td style={{ maxWidth: '300px' }}>
                      {u.certificates.length > 0 ? (
                        <ul style={{ listStyleType: 'none', padding: 0, margin: 0, maxHeight: '100px', overflowY: 'auto' }}>
                          {u.certificates.map((cert, idx) => (
                            <li key={idx} style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{cert.title} (Expire: {new Date(cert.expiryDate).toLocaleDateString()})</li>
                          ))}
                        </ul>
                      ) : 'Aucun certificat'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {currentSection === 'approvals' && user.role === 'admin' && (
          <div className="approvals-section form-paper">
            <h2>Valider ou invalider les cartes professionnelles (admins en attente)</h2>
            <div className="certificates-grid">
              {users.filter(u => u.role === 'admin' && !u.isApproved).map((u) => (
                <div className="certificate-card" key={u._id}>
                  <h3>{u.firstName} {u.lastName} ({u.email})</h3>
                  <p>Carte professionnelle :</p>
                  {u.professionalCard && (
                    <img 
                      src={`http://localhost:5000/${u.professionalCard}`} 
                      alt="Professional Card" 
                      style={{ maxWidth: '100%', height: 'auto', objectFit: 'contain', display: 'block' }}
                    />
                  )}
                  <div style={{ display: 'flex', gap: '10px' }}>
                    <button onClick={() => handleApproveUser(u._id)} className="whatsapp-button">Valider</button>
                    <button onClick={() => handleRejectUser(u._id)} className="whatsapp-button" style={{ backgroundColor: 'red' }}>Invalider</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Dashboard;
