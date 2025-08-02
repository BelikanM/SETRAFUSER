'use client'; // Nécessaire pour Client Component dans Next.js

import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import axios from 'axios';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import DataTable from 'react-data-table-component'; // Alternative à @tanstack/react-table
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import './Dashboard.css';

// Composant Dashboard moderne avec fonctionnalités 2025 : responsivité, dark mode, charts, tables, role-based, notifications
const Dashboard = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [user, setUser] = useState(location.state?.user || null);
  const [employees, setEmployees] = useState([]);
  const [forms, setForms] = useState([]);
  const [stats, setStats] = useState([]);
  const [darkMode, setDarkMode] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filterText, setFilterText] = useState('');

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      navigate('/login');
      return;
    }

    const fetchData = async () => {
      try {
        // Fetch user info if not passed
        if (!user) {
          const userRes = await axios.get('http://localhost:5000/api/user/me', {
            headers: { Authorization: `Bearer ${token}` },
          });
          setUser(userRes.data);
        }

        // Fetch employees if admin/manager
        if (user?.role === 'admin' || user?.role === 'manager') {
          const empRes = await axios.get('http://localhost:5000/api/employees', {
            headers: { Authorization: `Bearer ${token}` },
          });
          setEmployees(empRes.data);

          // Fetch forms
          const formRes = await axios.get('http://localhost:5000/api/forms', {
            headers: { Authorization: `Bearer ${token}` },
          });
          setForms(formRes.data);

          // Exemple de stats pour charts
          setStats([
            { name: 'Employés', value: empRes.data.length },
            { name: 'Formulaires', value: formRes.data.length },
          ]);
        }

        toast.success('Bienvenue sur le dashboard !');
      } catch (err) {
        setError('Erreur lors du chargement des données');
        toast.error('Erreur lors du chargement');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [navigate, user]);

  const toggleDarkMode = () => setDarkMode(!darkMode);

  const handleLogout = () => {
    localStorage.removeItem('token');
    navigate('/login');
    toast.info('Déconnexion réussie');
  };

  // Colonnes pour la table (adaptées pour react-data-table-component)
  const columns = [
    { name: 'Prénom', selector: row => row.firstName, sortable: true },
    { name: 'Nom', selector: row => row.lastName, sortable: true },
    { name: 'Email', selector: row => row.email, sortable: true },
    { name: 'Département', selector: row => row.department, sortable: true },
    { name: 'Poste', selector: row => row.position, sortable: true },
  ];

  // Filtrage global pour la table
  const filteredEmployees = employees.filter(employee =>
    Object.values(employee).some(value =>
      value?.toString().toLowerCase().includes(filterText.toLowerCase())
    )
  );

  if (loading) return <div className="loading">Chargement...</div>;
  if (error) return <div className="error">{error}</div>;

  return (
    <div className={`dashboard-container ${darkMode ? 'dark-mode' : ''}`}>
      <ToastContainer position="top-right" autoClose={3000} />
      <header className="dashboard-header">
        <h1>Dashboard</h1>
        <div className="header-actions">
          <button onClick={toggleDarkMode}>{darkMode ? 'Mode Clair' : 'Mode Sombre'}</button>
          <img
            src={user?.profilePhoto || '/default-photo.jpg'}
            alt="Profil"
            className="profile-photo"
          />
          <span>{user?.firstName} {user?.lastName}</span>
          <button onClick={handleLogout}>Déconnexion</button>
        </div>
      </header>

      <nav className="sidebar">
        <ul>
          <li>Infos Personnelles</li>
          {(user?.role === 'admin' || user?.role === 'manager') && <li>Employés</li>}
          {(user?.role === 'admin' || user?.role === 'manager') && <li>Formulaires</li>}
          <li>Statistiques</li>
        </ul>
      </nav>

      <main className="dashboard-main">
        <section className="personal-info">
          <h2>Informations Personnelles</h2>
          <img
            src={user?.profilePhoto || '/default-photo.jpg'}
            alt="Photo de profil"
            className="personal-photo"
          />
          <p>Nom : {user?.firstName} {user?.lastName}</p>
          <p>Email : {user?.email}</p>
          <p>NIP : {user?.nip || 'Non spécifié'}</p>
          <p>Passeport : {user?.passport || 'Non spécifié'}</p>
          <h3>Certificats</h3>
          <ul>
            {user?.certificates?.map((cert, index) => (
              <li key={index}>
                {cert.title} - Créé le {new Date(cert.creationDate).toLocaleDateString()} - Expire le {new Date(cert.expiryDate).toLocaleDateString()}
                {cert.filePath && (
                  <a href={`http://localhost:5000/${cert.filePath}`} download>Télécharger PDF</a>
                )}
              </li>
            )) || <li>Aucun certificat</li>}
          </ul>
        </section>

        {(user?.role === 'admin' || user?.role === 'manager') && (
          <>
            <section className="employees-section">
              <h2>Liste des Employés</h2>
              <input
                placeholder="Rechercher..."
                value={filterText}
                onChange={e => setFilterText(e.target.value)}
                className="search-input"
              />
              <DataTable
                columns={columns}
                data={filteredEmployees}
                pagination
                paginationPerPage={10}
                paginationRowsPerPageOptions={[10, 20, 30]}
                sortable
                responsive
                striped
                highlightOnHover
                noDataComponent="Aucun employé trouvé"
                customStyles={{
                  table: { style: { backgroundColor: darkMode ? '#2c2c2c' : '#fff' } },
                  headCells: { style: { backgroundColor: darkMode ? '#333' : '#25d366', color: darkMode ? '#fff' : '#fff' } },
                  cells: { style: { backgroundColor: darkMode ? '#2c2c2c' : '#fff', color: darkMode ? '#fff' : '#333' } },
                }}
              />
            </section>

            <section className="forms-section">
              <h2>Formulaires</h2>
              <ul>
                {forms.map(form => (
                  <li key={form._id}>{form.name} - Champs : {form.fields.length}</li>
                ))}
              </ul>
            </section>

            <section className="stats-section">
              <h2>Statistiques</h2>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={stats}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="value" fill="#25d366" />
                </BarChart>
              </ResponsiveContainer>
            </section>
          </>
        )}
      </main>
    </div>
  );
};

export default Dashboard;
