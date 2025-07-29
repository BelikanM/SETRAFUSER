// src/components/Dashboard.js
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import './Dashboard.css';

const Dashboard = () => {
  const [user, setUser] = useState(null);
  const [formFields, setFormFields] = useState([]);
  const [dynamicFormData, setDynamicFormData] = useState({});
  const [validityForm, setValidityForm] = useState({
    title: '',
    startDate: '',
    endDate: '',
    pdf: null,
  });
  const [reminderForm, setReminderForm] = useState({
    title: '',
    startDate: '',
    endDate: '',
    pdf: null,
  });
  const [employees, setEmployees] = useState([]);
  const [countdown, setCountdown] = useState('');
  const [verificationCode, setVerificationCode] = useState('');
  const [inputCode, setInputCode] = useState('');
  const [isVerified, setIsVerified] = useState(false);
  const navigate = useNavigate();

  // Vérification du token et récupération des employés
  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      navigate('/login');
      return;
    }

    fetch('http://localhost:5000/api/employees', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    })
      .then(res => {
        if (!res.ok) throw new Error('Erreur lors de la récupération des employés');
        return res.json();
      })
      .then(data => {
        setEmployees(data);
        setUser(JSON.parse(localStorage.getItem('user')));
      })
      .catch(err => {
        console.error(err);
        navigate('/login');
      });
  }, [navigate]);

  // Générer un code de vérification
  const generateVerificationCode = () => {
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    setVerificationCode(code);
    alert(`Code de vérification envoyé : ${code}`);
  };

  // Vérifier le code
  const verifyCode = () => {
    if (inputCode === verificationCode) {
      setIsVerified(true);
      alert('Code vérifié avec succès !');
    } else {
      alert('Code incorrect.');
    }
  };

  // Ajouter un champ dynamique
  const addField = (type) => {
    const newField = {
      fieldName: `${type}_${formFields.length + 1}`,
      fieldType: type,
      required: type === 'photo',
      options: type === 'select' ? ['Option 1', 'Option 2'] : [],
    };
    setFormFields([...formFields, newField]);
  };

  // Gérer les changements dans le formulaire dynamique
  const handleDynamicFormChange = (fieldName, value) => {
    setDynamicFormData({ ...dynamicFormData, [fieldName]: value });
  };

  // Soumettre le formulaire dynamique
  const handleDynamicFormSubmit = async (e) => {
    e.preventDefault();
    if (!isVerified) {
      alert('Veuillez vérifier le code.');
      return;
    }

    const formData = new FormData();
    Object.keys(dynamicFormData).forEach(key => {
      formData.append(key, dynamicFormData[key]);
    });
    formData.append('customFields', JSON.stringify(dynamicFormData));

    try {
      const token = localStorage.getItem('token');
      const response = await fetch('http://localhost:5000/api/employees', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
        body: formData,
      });

      if (!response.ok) throw new Error('Erreur lors de l\'ajout de l\'employé');
      alert('Employé ajouté avec succès !');
      setDynamicFormData({});
      setFormFields([]);
      setIsVerified(false);
      setInputCode('');
    } catch (err) {
      console.error(err);
      alert('Erreur lors de l\'ajout de l\'employé.');
    }
  };

  // Gérer le formulaire de validité
  const handleValidityFormSubmit = async (e) => {
    e.preventDefault();
    const formData = new FormData();
    formData.append('title', validityForm.title);
    formData.append('startDate', validityForm.startDate);
    formData.append('endDate', validityForm.endDate);
    formData.append('type', 'validity');
    formData.append('file', validityForm.pdf);

    try {
      const token = localStorage.getItem('token');
      const response = await fetch('http://localhost:5000/api/documents', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
        body: formData,
      });

      if (!response.ok) throw new Error('Erreur lors de la création du document');
      alert('Formulaire de validité créé !');
      setValidityForm({ title: '', startDate: '', endDate: '', pdf: null });
    } catch (err) {
      console.error(err);
      alert('Erreur lors de la création du document.');
    }
  };

  // Gérer le formulaire de rappel
  const handleReminderFormSubmit = async (e) => {
    e.preventDefault();
    const formData = new FormData();
    formData.append('title', reminderForm.title);
    formData.append('startDate', reminderForm.startDate);
    formData.append('endDate', reminderForm.endDate);
    formData.append('type', 'reminder');
    formData.append('file', reminderForm.pdf);

    try {
      const token = localStorage.getItem('token');
      const response = await fetch('http://localhost:5000/api/documents', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
        body: formData,
      });

      if (!response.ok) throw new Error('Erreur lors de la création du document');
      alert('Formulaire de rappel créé !');
      setReminderForm({ title: '', startDate: '', endDate: '', pdf: null });
    } catch (err) {
      console.error(err);
      alert('Erreur lors de la création du document.');
    }
  };

  // Compte à rebours pour le formulaire de validité
  useEffect(() => {
    if (validityForm.endDate) {
      const interval = setInterval(() => {
        const now = new Date();
        const end = new Date(validityForm.endDate);
        const diff = end - now;
        if (diff <= 0) {
          setCountdown('Expiré');
          clearInterval(interval);
        } else {
          const days = Math.floor(diff / (1000 * 60 * 60 * 24));
          const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
          const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
          setCountdown(`${days}j ${hours}h ${minutes}m`);
        }
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [validityForm.endDate]);

  // Mise à jour du profil utilisateur
  const handleProfileUpdate = async (e) => {
    e.preventDefault();
    const updatedData = { email: user.email, firstName: user.firstName, lastName: user.lastName };
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('http://localhost:5000/api/users', {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updatedData),
      });

      if (!response.ok) throw new Error('Erreur lors de la mise à jour du profil');
      const data = await response.json();
      localStorage.setItem('user', JSON.stringify(data));
      setUser(data);
      alert('Profil mis à jour !');
    } catch (err) {
      console.error(err);
      alert('Erreur lors de la mise à jour du profil.');
    }
  };

  return (
    <div className="dashboard">
      {/* Header */}
      <header className="header">
        <h1>Tableau de bord</h1>
        {user && (
          <div className="user-info">
            <p>{user.firstName} {user.lastName} ({user.email}, {user.role})</p>
            <form onSubmit={handleProfileUpdate}>
              <input
                type="text"
                placeholder="Prénom"
                value={user.firstName || ''}
                onChange={(e) => setUser({ ...user, firstName: e.target.value })}
              />
              <input
                type="text"
                placeholder="Nom"
                value={user.lastName || ''}
                onChange={(e) => setUser({ ...user, lastName: e.target.value })}
              />
              <input
                type="email"
                placeholder="Email"
                value={user.email}
                onChange={(e) => setUser({ ...user, email: e.target.value })}
                required
              />
              <button type="submit">Mettre à jour le profil</button>
            </form>
            <button onClick={() => { localStorage.removeItem('token'); localStorage.removeItem('user'); navigate('/login'); }}>
              Déconnexion
            </button>
          </div>
        )}
      </header>

      {/* Vérification du code */}
      <div className="verification">
        <h2>Vérification</h2>
        <button onClick={generateVerificationCode}>Générer un code</button>
        <input
          type="text"
          placeholder="Entrez le code"
          value={inputCode}
          onChange={(e) => setInputCode(e.target.value)}
        />
        <button onClick={verifyCode}>Vérifier</button>
      </div>

      {/* Formulaire dynamique */}
      {isVerified && (
        <div className="dynamic-form">
          <h2>Formulaire dynamique</h2>
          <div className="field-selector">
            <button onClick={() => addField('text')}>Ajouter Texte</button>
            <button onClick={() => addField('number')}>Ajouter Numéro</button>
            <button onClick={() => addField('select')}>Ajouter Sélecteur</button>
            <button onClick={() => addField('photo')}>Ajouter Photo</button>
          </div>
          <form onSubmit={handleDynamicFormSubmit}>
            {formFields.map((field, index) => (
              <div key={index} className="form-field">
                {field.fieldType === 'text' && (
                  <input
                    type="text"
                    placeholder={field.fieldName}
                    onChange={(e) => handleDynamicFormChange(field.fieldName, e.target.value)}
                    required={field.required}
                  />
                )}
                {field.fieldType === 'number' && (
                  <input
                    type="number"
                    placeholder={field.fieldName}
                    onChange={(e) => handleDynamicFormChange(field.fieldName, e.target.value)}
                    required={field.required}
                  />
                )}
                {field.fieldType === 'select' && (
                  <select
                    onChange={(e) => handleDynamicFormChange(field.fieldName, e.target.value)}
                    required={field.required}
                  >
                    <option value="">Sélectionnez une option</option>
                    {field.options.map((option, i) => (
                      <option key={i} value={option}>{option}</option>
                    ))}
                  </select>
                )}
                {field.fieldType === 'photo' && (
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => handleDynamicFormChange(field.fieldName, e.target.files[0])}
                    required={field.required}
                  />
                )}
              </div>
            ))}
            <button type="submit">Soumettre</button>
          </form>
        </div>
      )}

      {/* Formulaire de validité */}
      <div className="validity-form">
        <h2>Formulaire de validité</h2>
        <form onSubmit={handleValidityFormSubmit}>
          <input
            type="text"
            placeholder="Titre"
            value={validityForm.title}
            onChange={(e) => setValidityForm({ ...validityForm, title: e.target.value })}
            required
          />
          <input
            type="date"
            value={validityForm.startDate}
            onChange={(e) => setValidityForm({ ...validityForm, startDate: e.target.value })}
            required
          />
          <input
            type="date"
            value={validityForm.endDate}
            onChange={(e) => setValidityForm({ ...validityForm, endDate: e.target.value })}
            required
          />
          <input
            type="file"
            accept="application/pdf"
            onChange={(e) => setValidityForm({ ...validityForm, pdf: e.target.files[0] })}
            required
          />
          <button type="submit">Soumettre</button>
        </form>
        {countdown && <p>Compte à rebours : {countdown}</p>}
      </div>

      {/* Formulaire de rappel */}
      <div className="reminder-form">
        <h2>Formulaire de rappel</h2>
        <form onSubmit={handleReminderFormSubmit}>
          <input
            type="text"
            placeholder="Titre"
            value={reminderForm.title}
            onChange={(e) => setReminderForm({ ...reminderForm, title: e.target.value })}
            required
          />
          <input
            type="date"
            value={reminderForm.startDate}
            onChange={(e) => setReminderForm({ ...reminderForm, startDate: e.target.value })}
            required
          />
          <input
            type="date"
            value={reminderForm.endDate}
            onChange={(e) => setReminderForm({ ...reminderForm, endDate: e.target.value })}
            required
          />
          <input
            type="file"
            accept="application/pdf"
            onChange={(e) => setReminderForm({ ...reminderForm, pdf: e.target.files[0] })}
            required
          />
          <button type="submit">Soumettre</button>
        </form>
      </div>

      {/* Affichage des employés */}
      <div className="employee-list">
        <h2>Employés</h2>
        <div className="employee-cards">
          {employees.map(employee => (
            <div key={employee._id} className="employee-card">
              <img
                src={employee.photo ? `http://localhost:5000/${employee.photo}` : 'default-profile.png'}
                alt="Profil"
                className="profile-pic"
              />
              <h3>{employee.firstName} {employee.lastName}</h3>
              <p>Email: {employee.email}</p>
              <p>Département: {employee.department}</p>
              <p>Position: {employee.position}</p>
              <p>Date d'embauche: {new Date(employee.hireDate).toLocaleDateString()}</p>
              <p>Documents: {employee.customFields?.pdf ? 1 : 0}</p>
              <p>Créé par: {employee.createdBy?.email}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
