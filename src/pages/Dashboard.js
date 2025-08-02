import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
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
import './Dashboard.css'; // Fichier CSS dédié pour le dashboard

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

const Dashboard = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [employees, setEmployees] = useState([]);
  const [forms, setForms] = useState([]);
  const [stats, setStats] = useState({ totalEmployees: 0, totalCertificates: 0, expiredCertificates: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [sidebarOpen, setSidebarOpen] = useState(false); // Pour mobile
  const [currentSection, setCurrentSection] = useState('dashboard'); // Section actuelle

  // États pour édition profil
  const [editProfile, setEditProfile] = useState({ firstName: '', lastName: '' });

  // États pour certificats
  const [certificateForm, setCertificateForm] = useState({ title: '', creationDate: '', expiryDate: '', file: null, image: null });
  const [editingCertIndex, setEditingCertIndex] = useState(null);

  // États pour employés (ajout simple)
  const [newEmployee, setNewEmployee] = useState({ firstName: '', lastName: '', email: '', department: '', position: '', hireDate: '' });

  // États pour formulaires (ajout simple)
  const [newForm, setNewForm] = useState({ name: '', fields: [{ fieldName: '', fieldType: 'text', options: [], required: false }] });

  // Fonction pour calculer le compte à rebours
  const calculateCountdown = (expiryDate) => {
    const now = new Date();
    const expiry = new Date(expiryDate);
    const diff = expiry - now;
    if (diff < 0) return 'Expiré';
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    return `${days} jours, ${hours} heures, ${minutes} minutes restantes`;
  };

  // Fonction de déconnexion
  const handleLogout = () => {
    localStorage.removeItem('token');
    navigate('/login');
  };

  const fetchData = async () => {
    const token = localStorage.getItem('token');
    if (!token) {
      setError('Aucun token trouvé. Veuillez vous connecter.');
      handleLogout();
      return;
    }

    try {
      // Fetch user profile
      const userRes = await axios.get('http://localhost:5000/api/user/profile', {
        headers: { Authorization: `Bearer ${token}` },
      });
      setUser(userRes.data);
      setEditProfile({ firstName: userRes.data.firstName, lastName: userRes.data.lastName });

      // Fetch stats if admin or manager
      if (userRes.data.role === 'admin' || userRes.data.role === 'manager') {
        await fetchStats(token);
        // Fetch employees
        const employeesRes = await axios.get('http://localhost:5000/api/employees', {
          headers: { Authorization: `Bearer ${token}` },
        });
        setEmployees(employeesRes.data);

        // Fetch forms
        const formsRes = await axios.get('http://localhost:5000/api/forms', {
          headers: { Authorization: `Bearer ${token}` },
        });
        setForms(formsRes.data);
      }
    } catch (err) {
      if (err.response?.status === 401 || err.response?.status === 403) {
        setError('Token invalide ou expiré. Veuillez vous reconnecter.');
        handleLogout();
      } else {
        setError(err.response?.data?.message || 'Erreur lors du chargement des données');
      }
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = async (token) => {
    try {
      const statsRes = await axios.get('http://localhost:5000/api/stats', {
        headers: { Authorization: `Bearer ${token}` },
      });
      setStats(statsRes.data);
    } catch (err) {
      console.error('Erreur lors du fetch des stats');
    }
  };

  useEffect(() => {
    fetchData();
  }, [navigate]);

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

  // Ajout employé
  const handleAddEmployee = async (e) => {
    e.preventDefault();
    const token = localStorage.getItem('token');
    try {
      const res = await axios.post('http://localhost:5000/api/employees', newEmployee, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setEmployees([...employees, res.data]);
      setNewEmployee({ firstName: '', lastName: '', email: '', department: '', position: '', hireDate: '' });
      await fetchStats(token);
    } catch (err) {
      setError('Erreur lors de l\'ajout de l\'employé');
    }
  };

  // Ajout formulaire
  const handleAddForm = async (e) => {
    e.preventDefault();
    const token = localStorage.getItem('token');
    try {
      const res = await axios.post('http://localhost:5000/api/forms', newForm, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setForms([...forms, res.data]);
      setNewForm({ name: '', fields: [{ fieldName: '', fieldType: 'text', options: [], required: false }] });
    } catch (err) {
      setError('Erreur lors de l\'ajout du formulaire');
    }
  };

  // Gestion des champs dynamiques pour formulaires
  const addFormField = () => {
    setNewForm({
      ...newForm,
      fields: [...newForm.fields, { fieldName: '', fieldType: 'text', options: [], required: false }]
    });
  };

  const handleFormFieldChange = (index, field, value) => {
    const updatedFields = [...newForm.fields];
    updatedFields[index][field] = value;
    setNewForm({ ...newForm, fields: updatedFields });
  };

  const getChartData = () => {
    let totalCerts = 0;
    let expiredCerts = 0;
    if (user.role === 'admin' || user.role === 'manager') {
      totalCerts = stats.totalCertificates;
      expiredCerts = stats.expiredCertificates;
    } else {
      totalCerts = user.certificates.length;
      expiredCerts = user.certificates.filter(cert => new Date(cert.expiryDate) < new Date()).length;
    }
    return {
      labels: ['Certificats totaux', 'Certificats expirés'],
      datasets: [
        {
          label: 'Statistiques des certificats',
          data: [totalCerts, expiredCerts],
          backgroundColor: ['rgba(75, 192, 192, 0.6)', 'rgba(255, 99, 132, 0.6)'],
          borderColor: ['rgba(75, 192, 192, 1)', 'rgba(255, 99, 132, 1)'],
          borderWidth: 1,
        },
      ],
    };
  };

  if (loading) return <div className="loading">Chargement...</div>;
  if (error) return <div className="error">{error}</div>;

  return (
    <div className="dashboard-container">
      {/* Sidebar navigation */}
      <div className={`sidebar ${sidebarOpen ? 'open' : ''}`}>
        <h3>Menu</h3>
        <ul>
          <li onClick={() => setCurrentSection('dashboard')}>Dashboard</li>
          <li onClick={() => setCurrentSection('profile')}>Profil</li>
          {(user.role === 'admin' || user.role === 'manager') && (
            <>
              <li onClick={() => setCurrentSection('employees')}>Gérer les employés</li>
              <li onClick={() => setCurrentSection('forms')}>Gérer les formulaires</li>
            </>
          )}
          <li onClick={() => setCurrentSection('certificates')}>Mes certificats</li>
          <li onClick={handleLogout}>Déconnexion</li>
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
                    <p>Certificats expirés : {stats.expiredCertificates}</p>
                  </>
                ) : (
                  <>
                    <p>Certificats totaux : {user.certificates.length}</p>
                    <p>Certificats expirés : {user.certificates.filter(cert => new Date(cert.expiryDate) < new Date()).length}</p>
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
                <h3>Mes certificats récents</h3>
                <div className="certificates-grid">
                  {user.certificates.slice(0, 5).map((cert, index) => (
                    <div className="certificate-card" key={index}>
                      <h3>{cert.title}</h3>
                      <p>Créé le : {new Date(cert.creationDate).toLocaleDateString()}</p>
                      <p>Expire le : {new Date(cert.expiryDate).toLocaleDateString()}</p>
                      <div className="countdown-box">
                        <p>Compte à rebours : {calculateCountdown(cert.expiryDate)}</p>
                      </div>
                      {cert.imagePath && (
                        <img src={`http://localhost:5000/${cert.imagePath}`} alt="Certificate Image" className="cert-image" />
                      )}
                      {cert.filePath && (
                        <>
                          <embed
                            src={`http://localhost:5000/${cert.filePath}#toolbar=0`}
                            type="application/pdf"
                            width="100%"
                            height="300px"
                          />
                          <a href={`http://localhost:5000/${cert.filePath}`} target="_blank" rel="noopener noreferrer">Ouvrir PDF</a>
                        </>
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
            <h2>Mes certificats</h2>
            <div className="certificates-grid">
              {user.certificates.map((cert, index) => (
                <div className="certificate-card" key={index}>
                  <h3>{cert.title}</h3>
                  <p>Créé le : {new Date(cert.creationDate).toLocaleDateString()}</p>
                  <p>Expire le : {new Date(cert.expiryDate).toLocaleDateString()}</p>
                  <div className="countdown-box">
                    <p>Compte à rebours : {calculateCountdown(cert.expiryDate)}</p>
                  </div>
                  {cert.imagePath && (
                    <img src={`http://localhost:5000/${cert.imagePath}`} alt="Certificate Image" className="cert-image" />
                  )}
                  {cert.filePath && (
                    <>
                      <embed
                        src={`http://localhost:5000/${cert.filePath}#toolbar=0`}
                        type="application/pdf"
                        width="100%"
                        height="300px"
                      />
                      <a href={`http://localhost:5000/${cert.filePath}`} target="_blank" rel="noopener noreferrer">Ouvrir PDF</a>
                    </>
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
                  <img src={`http://localhost:5000/${user.profilePhoto}`} alt="Profile" className="small-avatar" />
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
                <input
                  type="file"
                  accept="application/pdf"
                  onChange={(e) => setCertificateForm({ ...certificateForm, file: e.target.files[0] })}
                />
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => setCertificateForm({ ...certificateForm, image: e.target.files[0] })}
                />
                <button type="submit" className="whatsapp-button">
                  {editingCertIndex !== null ? 'Sauvegarder' : 'Ajouter'}
                </button>
                {editingCertIndex !== null && (
                  <button type="button" onClick={() => { setEditingCertIndex(null); setCertificateForm({ title: '', creationDate: '', expiryDate: '', file: null, image: null }); }}>
                    Annuler
                  </button>
                )}
              </form>
            </div>
          </div>
        )}

        {currentSection === 'employees' && (user.role === 'admin' || user.role === 'manager') && (
          <div className="employees-section form-paper">
            <h2>Gérer les employés</h2>
            <table className="dashboard-table">
              <thead>
                <tr>
                  <th>Nom</th>
                  <th>Email</th>
                  <th>Département</th>
                  <th>Poste</th>
                  <th>Date d'embauche</th>
                </tr>
              </thead>
              <tbody>
                {employees.map((emp) => (
                  <tr key={emp._id}>
                    <td>{emp.firstName} {emp.lastName}</td>
                    <td>{emp.email}</td>
                    <td>{emp.department}</td>
                    <td>{emp.position}</td>
                    <td>{new Date(emp.hireDate).toLocaleDateString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <h3>Ajouter un employé</h3>
            <form onSubmit={handleAddEmployee}>
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
              <button type="submit" className="whatsapp-button">Ajouter</button>
            </form>
          </div>
        )}

        {currentSection === 'forms' && (user.role === 'admin' || user.role === 'manager') && (
          <div className="forms-section form-paper">
            <h2>Gérer les formulaires</h2>
            <ul>
              {forms.map((form, index) => (
                <li key={index}>
                  {form.name} - Champs : {form.fields.length}
                </li>
              ))}
            </ul>
            <h3>Ajouter un formulaire</h3>
            <form onSubmit={handleAddForm}>
              <input
                type="text"
                value={newForm.name}
                onChange={(e) => setNewForm({ ...newForm, name: e.target.value })}
                placeholder="Nom du formulaire"
                required
              />
              <h4>Champs</h4>
              {newForm.fields.map((field, index) => (
                <div key={index}>
                  <input
                    type="text"
                    value={field.fieldName}
                    onChange={(e) => handleFormFieldChange(index, 'fieldName', e.target.value)}
                    placeholder="Nom du champ"
                    required
                  />
                  <select
                    value={field.fieldType}
                    onChange={(e) => handleFormFieldChange(index, 'fieldType', e.target.value)}
                    required
                  >
                    <option value="text">Texte</option>
                    <option value="number">Nombre</option>
                    <option value="date">Date</option>
                    <option value="select">Sélection</option>
                  </select>
                  {field.fieldType === 'select' && (
                    <input
                      type="text"
                      value={field.options.join(',')}
                      onChange={(e) => handleFormFieldChange(index, 'options', e.target.value.split(','))}
                      placeholder="Options (séparées par virgule)"
                    />
                  )}
                  <label>
                    <input
                      type="checkbox"
                      checked={field.required}
                      onChange={(e) => handleFormFieldChange(index, 'required', e.target.checked)}
                    />
                    Obligatoire
                  </label>
                </div>
              ))}
              <button type="button" onClick={addFormField}>Ajouter un champ</button>
              <button type="submit" className="whatsapp-button">Ajouter le formulaire</button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
};

export default Dashboard;
