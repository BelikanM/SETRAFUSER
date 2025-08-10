import React, { useState, useEffect, useContext, useRef, useMemo } from 'react';
import { UserContext } from '../context/UserContext';
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
import { FaEye, FaDownload, FaFilePdf, FaImage, FaClock, FaHome, FaUser, FaUsers, FaFileAlt, FaCertificate, FaUserCog, FaCheck, FaSignOutAlt, FaEnvelope, FaUserTie, FaCheckCircle, FaFileMedical, FaEdit, FaTrash, FaBuilding, FaBriefcase, FaCalendarAlt, FaTimes, FaSearch } from 'react-icons/fa';
import axios from 'axios';
import ReactQuill from 'react-quill';
import 'react-quill/dist/quill.snow.css';
import './Dashboard.css'; // Fichier CSS dédié pour le dashboard

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

const Dashboard = () => {
  const { user, setUser, employees, setEmployees, forms, setForms, users, setUsers, stats, setStats, loading, error, setError, handleLogout, fetchStats, fetchUsers } = useContext(UserContext);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [currentSection, setCurrentSection] = useState('dashboard');

  // États pour édition profil
  const [editProfile, setEditProfile] = useState({ firstName: '', lastName: '' });

  // États pour certificats
  const [certificateForm, setCertificateForm] = useState({ title: '', creationDate: '', expiryDate: '', file: null, image: null });
  const [editingCertIndex, setEditingCertIndex] = useState(null);

  // États pour employés
  const [newEmployee, setNewEmployee] = useState({ firstName: '', lastName: '', email: '', department: '', position: '', hireDate: '' });
  const [selectedPhoto, setSelectedPhoto] = useState(null);
  const [selectedPdf, setSelectedPdf] = useState(null);
  const [isEditingEmployee, setIsEditingEmployee] = useState(false);
  const [editingEmployeeId, setEditingEmployeeId] = useState(null);

  // États pour formulaires/blog
  const [newFormName, setNewFormName] = useState('');
  const [formContent, setFormContent] = useState('');
  const [isEditingForm, setIsEditingForm] = useState(false);
  const [editingFormId, setEditingFormId] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedForms, setExpandedForms] = useState({});
  const [viewersModal, setViewersModal] = useState({ show: false, viewers: [] });

  // État pour modal PDF
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedPdfPath, setSelectedPdfPath] = useState('');

  // État pour forcer le re-render en temps réel
  const [, setTick] = useState(0);

  const quillRef = useRef();

  // Configuration mémorisée pour ReactQuill
  const modules = useMemo(() => ({
    toolbar: [
      [{ 'header': [1, 2, false] }],
      ['bold', 'italic', 'underline', 'strike', 'blockquote'],
      [{ 'list': 'ordered' }, { 'list': 'bullet' }, { 'indent': '-1' }, { 'indent': '+1' }],
      ['link', 'image'],
      ['clean']
    ],
  }), []);

  const formats = ['header', 'bold', 'italic', 'underline', 'strike', 'blockquote', 'list', 'bullet', 'indent', 'link', 'image'];

  useEffect(() => {
    if (user) {
      setEditProfile({ firstName: user.firstName, lastName: user.lastName });
    }
  }, [user]);

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

  // Mise à jour en temps réel pour les comptes à rebours (seulement dans les sections nécessaires)
  useEffect(() => {
    if (currentSection === 'dashboard' || currentSection === 'certificates') {
      const interval = setInterval(() => {
        setTick((prev) => prev + 1);
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [currentSection]);

  // Intégration des notifications push (abonnement après chargement de l'utilisateur)
  useEffect(() => {
    if (user && 'serviceWorker' in navigator && 'PushManager' in window) {
      navigator.serviceWorker.register('/service-worker.js')
        .then((registration) => {
          return Notification.requestPermission().then((permission) => {
            if (permission === 'granted') {
              return registration.pushManager.subscribe({
                userVisibleOnly: true,
                applicationServerKey: urlBase64ToUint8Array('BFXT9xapyauApeUkChO8rMsl3lUA23ndfiYih724AeNoof7NtqO5h1OlpAINwmMcFYAxUKrnCLFMN8VV8Sk3Bgg'), // Clé VAPID publique
              }).then((subscription) => {
                const token = localStorage.getItem('token');
                return axios.post('http://localhost:5000/api/subscribe-push', subscription, {
                  headers: { Authorization: `Bearer ${token}` },
                });
              }).catch((err) => console.error('Erreur lors de l\'abonnement push:', err));
            }
          });
        })
        .catch((err) => console.error('Erreur d\'enregistrement du service worker:', err));
    }
  }, [user]);

  // Fonction helper pour convertir la clé VAPID en Uint8Array
  const urlBase64ToUint8Array = (base64String) => {
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);
    for (let i = 0; i < rawData.length; ++i) {
      outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
  };

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
        setEmployees([res.data, ...employees]);
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
    setSelectedPhoto(null);
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
    console.log('Soumission du formulaire/blog :', { name: newFormName, content: formContent }); // Log frontend pour debug
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
        setForms([res.data, ...forms]);
      }
      setNewFormName('');
      setFormContent('');
      console.log('Formulaire/blog sauvegardé avec succès'); // Log frontend pour debug
    } catch (err) {
      setError('Erreur lors de l\'opération sur le formulaire');
      console.error('Erreur lors de la soumission du formulaire/blog :', err); // Log frontend pour debug
    }
  };

  // Edition formulaire
  const startEditingForm = (form) => {
    console.log('Édition d\'un formulaire/blog existant :', form); // Log frontend pour debug
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

  // Afficher les viewers
  const handleShowViewers = async (id) => {
    const token = localStorage.getItem('token');
    try {
      const res = await axios.get(`http://localhost:5000/api/forms/${id}/viewers`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setViewersModal({ show: true, viewers: res.data });
    } catch (err) {
      setError('Erreur lors de la récupération des viewers');
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

  // Rejeter inscription
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
      expiringSoon = stats.expiringSoonCertificates || 0;
    } else if (user) {
      totalCerts = user.certificates.length;
      expiredCerts = user.certificates.filter(cert => new Date(cert.expiryDate) < new Date()).length;
      expiringSoon = user.certificates.filter(cert => {
        const diff = new Date(cert.expiryDate) - new Date();
        return diff > 0 && diff < 30 * 24 * 60 * 60 * 1000;
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

  useEffect(() => {
    if (quillRef.current) {
      const quill = quillRef.current.getEditor();
      const toolbar = quill.getModule('toolbar');
      toolbar.addHandler('image', imageHandler);
    }
  }, []);

  const imageHandler = () => {
    const input = document.createElement('input');
    input.setAttribute('type', 'file');
    input.setAttribute('accept', 'image/*');
    input.click();
    input.onchange = async () => {
      const file = input.files[0];
      if (file) {
        const formData = new FormData();
        formData.append('image', file);
        const token = localStorage.getItem('token');
        try {
          const res = await axios.post('http://localhost:5000/api/upload-media', formData, {
            headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'multipart/form-data' },
          });
          const range = quillRef.current.getEditor().getSelection();
          quillRef.current.getEditor().insertEmbed(range.index, 'image', res.data.url);
        } catch (err) {
          console.error('Erreur lors du téléchargement de l\'image');
        }
      }
    };
  };

  if (loading) return <div className="loading">Chargement...</div>;
  if (error) return <div className="error">{error}</div>;
  if (!user) return <div className="error">Utilisateur non chargé. Veuillez vous reconnecter.</div>;

  // Tri des certificats par date d'expiration
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

      <button className="sidebar-toggle" onClick={() => setSidebarOpen(!sidebarOpen)}>
        ☰
      </button>

      <div className="main-content">
        {currentSection === 'dashboard' && (
          <>
            <div className="header">
              <h1>Bienvenue, {user.firstName} {user.lastName} !</h1>
              <p>Rôle : {user.role}</p>
            </div>

            <div className="widgets-grid">
              <div className="widget form-paper">
                <h3>Statistiques</h3>
                {(user.role === 'admin' || user.role === 'manager') ? (
                  <>
                    <p>Employés totaux : {stats.totalEmployees}</p>
                    <p>Certificats totaux : {stats.totalCertificates}</p>
                    <p><FaClock /> Certificats expirés : {stats.expiredCertificates}</p>
                    <p><FaClock /> Certificats expirant bientôt (30 jours) : {stats.expiringSoonCertificates || 0}</p>
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
                    <p>Utilisateurs totaux : {stats.totalUsers || 0}</p>
                    <p>Utilisateurs vérifiés : {stats.verifiedUsers || 0}</p>
                    <p>Utilisateurs approuvés : {stats.approvedUsers || 0}</p>
                  </>
                )}
              </div>
              <div className="widget form-paper">
                <h3>Graphique des certificats</h3>
                <Bar data={getChartData()} options={{ responsive: true, plugins: { legend: { position: 'top' } } }} />
              </div>
            </div>

            {(user.role === 'admin' || user.role === 'manager') ? (
              <div className="table-section form-paper">
                <h3>Employés récents</h3>
                <div className="employees-grid">
                  {employees.slice(0, 5).map((emp) => (
                    <div key={emp._id} className="employee-card">
                      <img src={`http://localhost:5000/${emp.profilePhoto}`} alt="Fond" className="employee-card-image" />
                      <div className="employee-card-content">
                        <div className="employee-info">
                          <FaUser />
                          <span>{emp.firstName} {emp.lastName}</span>
                        </div>
                        <div className="employee-info">
                          <FaEnvelope />
                          <span>{emp.email}</span>
                        </div>
                        <div className="employee-info">
                          <FaUserTie />
                          <span>{emp.position}</span>
                        </div>
                      </div>
                      {emp.pdfPath && (
                        <div className="pdf-actions">
                          <a href={`http://localhost:5000/${emp.pdfPath}`} target="_blank" rel="noopener noreferrer">
                            <FaEye />
                          </a>
                          <button onClick={() => handleDownloadPdf(emp.pdfPath)} className="download-button">
                            <FaDownload />
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
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
                        <p><FaClock /> Décompte : <span className="countdown-text">{calculateCountdown(cert.expiryDate)}</span></p>
                      </div>
                      {cert.imagePath && (
                        <img
                          src={`http://localhost:5000/${cert.imagePath}`}
                          alt={`Certificat ${cert.title}`}
                          className="cert-image"
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
                    <p><FaClock /> Décompte : <span className="countdown-text">{calculateCountdown(cert.expiryDate)}</span></p>
                  </div>
                  {cert.imagePath && (
                    <img
                      src={`http://localhost:5000/${cert.imagePath}`}
                      alt={`Certificat ${cert.title}`}
                      className="cert-image"
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
                    <button onClick={() => handleDeleteCertificate(index)} className="delete-button">Supprimer</button>
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
                    <p><FaClock /> Décompte : <span className="countdown-text">{calculateCountdown(cert.expiryDate)}</span></p>
                  </div>
                  {cert.imagePath && (
                    <img
                      src={`http://localhost:5000/${cert.imagePath}`}
                      alt={`Certificat ${cert.title}`}
                      className="cert-image"
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
                    <button onClick={() => handleDeleteCertificate(index)} className="delete-button">Supprimer</button>
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
                    <p><FaClock /> Décompte : <span className="countdown-text">{calculateCountdown(cert.expiryDate)}</span></p>
                  </div>
                  {cert.imagePath && (
                    <img
                      src={`http://localhost:5000/${cert.imagePath}`}
                      alt={`Certificat ${cert.title}`}
                      className="cert-image"
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
                    <button onClick={() => handleDeleteCertificate(index)} className="delete-button">Supprimer</button>
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
                <div className="file-input-container">
                  <div>
                    <input
                      type="file"
                      accept="application/pdf"
                      id="cert-pdf"
                      className="file-input"
                      onChange={(e) => setCertificateForm({ ...certificateForm, file: e.target.files[0] })}
                    />
                    <label htmlFor="cert-pdf" className="upload-button">
                      <FaFilePdf /> Upload PDF
                    </label>
                  </div>
                  <div>
                    <input
                      type="file"
                      accept="image/*"
                      id="cert-image"
                      className="file-input"
                      onChange={(e) => setCertificateForm({ ...certificateForm, image: e.target.files[0] })}
                    />
                    <label htmlFor="cert-image" className="upload-button">
                      <FaImage /> Upload Image
                    </label>
                  </div>
                </div>
                <div className="form-actions">
                  <button type="submit" className="whatsapp-button">
                    {editingCertIndex !== null ? 'Sauvegarder' : 'Ajouter'}
                  </button>
                  {editingCertIndex !== null && (
                    <button
                      type="button"
                      className="whatsapp-button cancel-button"
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
            <div className="employees-grid">
              {employees.map((emp) => (
                <div className="employee-card" key={emp._id}>
                  <div className="employee-card-image-container">
                    {emp.profilePhoto ? (
                      <img src={`http://localhost:5000/${emp.profilePhoto}`} alt="Photo" className="employee-card-image" />
                    ) : (
                      <div className="employee-card-placeholder">Pas de photo</div>
                    )}
                  </div>
                  <div className="employee-card-content">
                    <div className="employee-info">
                      <FaUser />
                      <span>{emp.firstName} {emp.lastName}</span>
                    </div>
                    <div className="employee-info">
                      <FaEnvelope />
                      <span>{emp.email}</span>
                    </div>
                    <div className="employee-info">
                      <FaBuilding />
                      <span>{emp.department}</span>
                    </div>
                    <div className="employee-info">
                      <FaBriefcase />
                      <span>{emp.position}</span>
                    </div>
                    <div className="employee-info">
                      <FaCalendarAlt />
                      <span>{new Date(emp.hireDate).toLocaleDateString()}</span>
                    </div>
                    {emp.pdfPath && (
                      <div className="pdf-actions">
                        <a href={`http://localhost:5000/${emp.pdfPath}`} target="_blank" rel="noopener noreferrer">
                          <FaEye /> Consulter PDF
                        </a>
                        <button onClick={() => handleDownloadPdf(emp.pdfPath)} className="download-button">
                          <FaDownload /> Télécharger PDF
                        </button>
                      </div>
                    )}
                  </div>
                  <div className="actions">
                    <button onClick={() => startEditingEmployee(emp)} className="edit-button">
                      <FaEdit /> Modifier
                    </button>
                    <button onClick={() => handleDeleteEmployee(emp._id)} className="delete-button">
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
                className="input-field"
              />
              <input
                type="text"
                value={newEmployee.lastName}
                onChange={(e) => setNewEmployee({ ...newEmployee, lastName: e.target.value })}
                placeholder="Nom"
                required
                className="input-field"
              />
              <input
                type="email"
                value={newEmployee.email}
                onChange={(e) => setNewEmployee({ ...newEmployee, email: e.target.value })}
                placeholder="Email"
                required
                className="input-field"
              />
              <input
                type="text"
                value={newEmployee.department}
                onChange={(e) => setNewEmployee({ ...newEmployee, department: e.target.value })}
                placeholder="Département"
                required
                className="input-field"
              />
              <input
                type="text"
                value={newEmployee.position}
                onChange={(e) => setNewEmployee({ ...newEmployee, position: e.target.value })}
                placeholder="Poste"
                required
                className="input-field"
              />
              <input
                type="date"
                value={newEmployee.hireDate}
                onChange={(e) => setNewEmployee({ ...newEmployee, hireDate: e.target.value })}
                required
                className="input-field"
              />
              <div className="file-input-container">
                <div>
                  <input
                    type="file"
                    accept="image/*"
                    id="employee-photo"
                    className="file-input"
                    onChange={(e) => setSelectedPhoto(e.target.files[0])}
                  />
                  <label htmlFor="employee-photo" className="upload-button">
                    <FaImage /> Upload Photo
                  </label>
                </div>
                <div>
                  <input
                    type="file"
                    accept=".pdf,.doc,.docx"
                    id="employee-pdf"
                    className="file-input"
                    onChange={(e) => setSelectedPdf(e.target.files[0])}
                  />
                  <label htmlFor="employee-pdf" className="upload-button">
                    <FaFilePdf /> Upload PDF/DOC
                  </label>
                </div>
              </div>
              <div className="form-actions">
                <button type="submit" className="whatsapp-button">{isEditingEmployee ? 'Sauvegarder' : 'Ajouter'}</button>
                {isEditingEmployee && (
                  <button
                    type="button"
                    onClick={() => {
                      setIsEditingEmployee(false);
                      setNewEmployee({ firstName: '', lastName: '', email: '', department: '', position: '', hireDate: '' });
                      setSelectedPhoto(null);
                      setSelectedPdf(null);
                    }}
                    className="whatsapp-button cancel-button"
                  >
                    Annuler
                  </button>
                )}
              </div>
            </form>
          </div>
        )}

        {currentSection === 'forms' && (user.role === 'admin' || user.role === 'manager') && (
          <div className="forms-section form-paper">
            <h2>Gérer les articles de blog</h2>
            <div className="search-container">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Rechercher un article par titre..."
                className="input-field search-bar"
              />
              <FaSearch className="search-icon" />
            </div>
            <div className="forms-list">
              {forms.filter(form => form.name.toLowerCase().includes(searchQuery.toLowerCase())).map((form) => {
                const contentHtml = form.content ? form.content : '<p>Pas de contenu</p>';
                const isLong = contentHtml.replace(/<[^>]+>/g, '').length > 300;
                const isExpanded = expandedForms[form._id] || false;
                const toggleExpand = () => {
                  const newExpanded = !isExpanded;
                  setExpandedForms(prev => ({ ...prev, [form._id]: newExpanded }));
                  if (newExpanded) {
                    const token = localStorage.getItem('token');
                    axios.post(`http://localhost:5000/api/forms/${form._id}/view`, {}, {
                      headers: { Authorization: `Bearer ${token}` }
                    })
                    .then(response => {
                      setForms(prevForms => prevForms.map(f => f._id === form._id ? { ...f, views: response.data.views } : f));
                    })
                    .catch(err => console.error('Erreur lors de l\'incrémentation des vues:', err));
                  }
                };
                const getExcerpt = (html, length = 300) => {
                  const text = html.replace(/<[^>]+>/g, '');
                  return text.length > length ? text.slice(0, length) + '...' : text;
                };

                return (
                  <div key={form._id} className="form-card">
                    <h4>{form.name}</h4>
                    <p>Créé le : {new Date(form.createdAt).toLocaleDateString()}</p>
                    <button onClick={() => handleShowViewers(form._id)} className="views-button"><FaEye /> {form.views}</button>
                    <div className="blog-content">
                      {isExpanded ? (
                        <div dangerouslySetInnerHTML={{ __html: contentHtml }} />
                      ) : (
                        <p>{getExcerpt(contentHtml)}</p>
                      )}
                    </div>
                    {isLong && (
                      <button onClick={toggleExpand} className="expand-button">
                        {isExpanded ? 'Réduire' : 'Lire plus'}
                      </button>
                    )}
                    <div className="actions" style={{ display: 'flex', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap' }}>
                      <button title="Modifier" onClick={() => startEditingForm(form)} className="edit-button"><FaEdit /></button>
                      <button title="Supprimer" onClick={() => handleDeleteForm(form._id)} className="delete-button"><FaTrash /></button>
                    </div>
                  </div>
                );
              })}
            </div>
            {viewersModal.show && (
              <div className="viewers-modal">
                <h4>Vus par :</h4>
                <ul className="viewers-list scrollable">
                  {viewersModal.viewers.map((viewer) => (
                    <li key={viewer._id}>
                      {viewer.firstName} {viewer.lastName}
                      {viewer.profilePhoto && <img src={`http://localhost:5000/${viewer.profilePhoto}`} alt="Profile" className="small-avatar" />}
                    </li>
                  ))}
                </ul>
                <button onClick={() => setViewersModal({ show: false, viewers: [] })} className="close-button">Fermer</button>
              </div>
            )}
            <h3>{isEditingForm ? 'Modifier l\'article' : 'Créer un article'}</h3>
            <form onSubmit={handleFormSubmit}>
              <input
                type="text"
                value={newFormName}
                onChange={(e) => setNewFormName(e.target.value)}
                placeholder="Titre de l'article"
                required
                className="input-field"
              />
              <ReactQuill
                ref={quillRef}
                value={formContent}
                onChange={setFormContent}
                modules={modules}
                formats={formats}
                className="quill-editor"
              />
              <div className="form-actions">
                <button type="submit" className="whatsapp-button">
                  {isEditingForm ? 'Sauvegarder' : 'Publier'}
                </button>
                {isEditingForm && (
                  <button
                    type="button"
                    className="whatsapp-button cancel-button"
                    onClick={() => {
                      setIsEditingForm(false);
                      setNewFormName('');
                      setFormContent('');
                      setEditingFormId(null);
                    }}
                  >
                    Annuler
                  </button>
                )}
              </div>
            </form>
          </div>
        )}

        {currentSection === 'users' && user.role === 'admin' && (
          <div className="users-section form-paper">
            <h2>Gérer les utilisateurs</h2>
            <table className="dashboard-table">
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
                    <td className="ellipsis">{u.firstName} {u.lastName}</td>
                    <td className="ellipsis">{u.email}</td>
                    <td className="ellipsis">{u.role}</td>
                    <td>
                      <input
                        type="checkbox"
                        checked={u.role === 'admin'}
                        onChange={(e) => handleToggleAdmin(u._id, e.target.checked)}
                      />
                    </td>
                    <td>
                      {u.certificates.length > 0 ? (
                        <ul className="certificate-list">
                          {u.certificates.map((cert, idx) => (
                            <li key={idx} className="ellipsis">{cert.title} (Expire: {new Date(cert.expiryDate).toLocaleDateString()})</li>
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
                      alt="Carte professionnelle"
                      className="professional-card-image"
                    />
                  )}
                  <div className="actions">
                    <button onClick={() => handleApproveUser(u._id)} className="whatsapp-button">Valider</button>
                    <button onClick={() => handleRejectUser(u._id)} className="whatsapp-button reject-button">Invalider</button>
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
