import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import './Dashboard.css'; // Fichier CSS dédié pour le dashboard

const Dashboard = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [employees, setEmployees] = useState([]);
  const [forms, setForms] = useState([]);
  const [stats, setStats] = useState({ totalEmployees: 0, expiredCertificates: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [sidebarOpen, setSidebarOpen] = useState(false); // Pour mobile
  const [currentSection, setCurrentSection] = useState('dashboard'); // Section actuelle

  // États pour édition profil
  const [editProfile, setEditProfile] = useState({ firstName: '', lastName: '' });

  // États pour certificats
  const [newCertificate, setNewCertificate] = useState({ title: '', creationDate: '', expiryDate: '', file: null });
  const [editingCertIndex, setEditingCertIndex] = useState(null);
  const [editCertificate, setEditCertificate] = useState({ title: '', creationDate: '', expiryDate: '', file: null });

  // États pour employés (ajout simple)
  const [newEmployee, setNewEmployee] = useState({ firstName: '', lastName: '', email: '', department: '', position: '', hireDate: '' });

  // États pour formulaires (ajout simple)
  const [newForm, setNewForm] = useState({ name: '', fields: [{ fieldName: '', fieldType: 'text', options: [], required: false }] });

  // Fonction de déconnexion
  const handleLogout = () => {
    localStorage.removeItem('token');
    navigate('/login');
  };

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      setError('Aucun token trouvé. Veuillez vous connecter.');
      handleLogout();
      return;
    }

    const fetchData = async () => {
      try {
        // Fetch user profile
        const userRes = await axios.get('http://localhost:5000/api/user/profile', {
          headers: { Authorization: `Bearer ${token}` },
        });
        setUser(userRes.data);
        setEditProfile({ firstName: userRes.data.firstName, lastName: userRes.data.lastName });

        // Fetch stats
        if (userRes.data.role === 'admin' || userRes.data.role === 'manager') {
          const statsRes = await axios.get('http://localhost:5000/api/stats', {
            headers: { Authorization: `Bearer ${token}` },
          });
          setStats(statsRes.data);

          // Fetch employees
          const employeesRes = await axios.get('http://localhost:5000/api/employees', {
            headers: { Authorization: `Bearer ${token}` },
          });
          setEmployees(employeesRes.data);

          // Fetch forms (assume endpoint /api/forms)
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

  // Ajout certificat
  const handleAddCertificate = async (e) => {
    e.preventDefault();
    const formData = new FormData();
    formData.append('title', newCertificate.title);
    formData.append('creationDate', newCertificate.creationDate);
    formData.append('expiryDate', newCertificate.expiryDate);
    if (newCertificate.file) formData.append('file', newCertificate.file);
    const token = localStorage.getItem('token');
    try {
      const res = await axios.post('http://localhost:5000/api/user/add-certificate', formData, {
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'multipart/form-data' },
      });
      setUser({ ...user, certificates: res.data.certificates });
      setNewCertificate({ title: '', creationDate: '', expiryDate: '', file: null });
    } catch (err) {
      setError('Erreur lors de l\'ajout du certificat');
    }
  };

  // Modification certificat
  const handleEditCertificate = async (e) => {
    e.preventDefault();
    const formData = new FormData();
    formData.append('index', editingCertIndex);
    formData.append('title', editCertificate.title);
    formData.append('creationDate', editCertificate.creationDate);
    formData.append('expiryDate', editCertificate.expiryDate);
    if (editCertificate.file) formData.append('file', editCertificate.file);
    const token = localStorage.getItem('token');
    try {
      const res = await axios.post('http://localhost:5000/api/user/edit-certificate', formData, {
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'multipart/form-data' },
      });
      setUser({ ...user, certificates: res.data.certificates });
      setEditingCertIndex(null);
      setEditCertificate({ title: '', creationDate: '', expiryDate: '', file: null });
    } catch (err) {
      setError('Erreur lors de la modification du certificat');
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
                <p>Employés totaux : {stats.totalEmployees}</p>
                <p>Certificats expirés : {stats.expiredCertificates}</p>
              </div>
              <div className="widget form-paper">
                <h3>Graphique (placeholder)</h3>
                <p>Ex. : Répartition des rôles</p>
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
                <ul>
                  {user.certificates.slice(0, 5).map((cert, index) => (
                    <li key={index}>
                      {cert.title} - Expire le : {new Date(cert.expiryDate).toLocaleDateString()}
                    </li>
                  ))}
                </ul>
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
            <ul>
              {user.certificates.map((cert, index) => (
                <li key={index}>
                  {editingCertIndex === index ? (
                    <form onSubmit={handleEditCertificate}>
                      <input
                        type="text"
                        value={editCertificate.title}
                        onChange={(e) => setEditCertificate({ ...editCertificate, title: e.target.value })}
                        placeholder="Titre"
                        required
                      />
                      <input
                        type="date"
                        value={editCertificate.creationDate}
                        onChange={(e) => setEditCertificate({ ...editCertificate, creationDate: e.target.value })}
                        required
                      />
                      <input
                        type="date"
                        value={editCertificate.expiryDate}
                        onChange={(e) => setEditCertificate({ ...editCertificate, expiryDate: e.target.value })}
                        required
                      />
                      <input
                        type="file"
                        accept="application/pdf"
                        onChange={(e) => setEditCertificate({ ...editCertificate, file: e.target.files[0] })}
                      />
                      <button type="submit" className="whatsapp-button">Sauvegarder</button>
                      <button type="button" onClick={() => setEditingCertIndex(null)}>Annuler</button>
                    </form>
                  ) : (
                    <>
                      {cert.title} - Créé le : {new Date(cert.creationDate).toLocaleDateString()} - Expire le : {new Date(cert.expiryDate).toLocaleDateString()}
                      <button onClick={() => {
                        setEditingCertIndex(index);
                        setEditCertificate({ title: cert.title, creationDate: cert.creationDate, expiryDate: cert.expiryDate, file: null });
                      }}>Modifier</button>
                    </>
                  )}
                </li>
              ))}
            </ul>
            <h3>Ajouter un certificat</h3>
            <form onSubmit={handleAddCertificate}>
              <input
                type="text"
                value={newCertificate.title}
                onChange={(e) => setNewCertificate({ ...newCertificate, title: e.target.value })}
                placeholder="Titre"
                required
              />
              <input
                type="date"
                value={newCertificate.creationDate}
                onChange={(e) => setNewCertificate({ ...newCertificate, creationDate: e.target.value })}
                required
              />
              <input
                type="date"
                value={newCertificate.expiryDate}
                onChange={(e) => setNewCertificate({ ...newCertificate, expiryDate: e.target.value })}
                required
              />
              <input
                type="file"
                accept="application/pdf"
                onChange={(e) => setNewCertificate({ ...newCertificate, file: e.target.files[0] })}
              />
              <button type="submit" className="whatsapp-button">Ajouter</button>
            </form>
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
