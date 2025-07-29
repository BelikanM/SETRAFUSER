// src/pages/Dashboard.js
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { MdHome, MdPerson, MdPeople, MdDataUsage, MdEmail, MdLock, MdPersonAdd, MdDirectionsCar, MdLocationPin, MdArticle, MdGroup, MdBusiness, MdWork, MdCalendarToday, MdMenu } from 'react-icons/md';
import '../components/Dashboard.css';

const Dashboard = () => {
  const [user, setUser] = useState(null);
  const [formFields, setFormFields] = useState(() => {
    // Restaurer formFields depuis localStorage au chargement
    const savedFields = localStorage.getItem('formFields');
    return savedFields ? JSON.parse(savedFields) : [];
  });
  const [dynamicFormData, setDynamicFormData] = useState(() => {
    // Restaurer dynamicFormData depuis localStorage au chargement
    const savedData = localStorage.getItem('dynamicFormData');
    return savedData ? JSON.parse(savedData) : {};
  });
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
  const [messageForm, setMessageForm] = useState({
    subject: '',
    body: '',
    recipients: '',
  });
  const [employees, setEmployees] = useState([]);
  const [countdown, setCountdown] = useState('');
  const [inputCode, setInputCode] = useState('');
  const [isVerified, setIsVerified] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const navigate = useNavigate();

  // Liste prédéfinie de départements pour le sélecteur
  const defaultOptions = ['RH', 'IT', 'Marketing', 'Finance'];

  // Sauvegarder formFields et dynamicFormData dans localStorage à chaque changement
  useEffect(() => {
    localStorage.setItem('formFields', JSON.stringify(formFields));
    localStorage.setItem('dynamicFormData', JSON.stringify(dynamicFormData));
  }, [formFields, dynamicFormData]);

  // Charger les employés et vérifier l'utilisateur
  useEffect(() => {
    const token = localStorage.getItem('token');
    const storedUser = localStorage.getItem('user');
    if (!token || !storedUser) {
      navigate('/login');
      return;
    }

    setUser(JSON.parse(storedUser));

    fetch('http://localhost:5000/api/employees', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    })
      .then(res => {
        if (!res.ok) {
          if (res.status === 403) throw new Error('Accès non autorisé (403)');
          if (res.status === 401) throw new Error('Token invalide ou expiré (401)');
          throw new Error('Erreur lors de la récupération des employés');
        }
        return res.json();
      })
      .then(data => setEmployees(data))
      .catch(err => {
        console.error('Erreur:', err.message);
        alert(err.message);
        if (err.message.includes('401')) navigate('/login');
      });
  }, [navigate]);

  const requestVerificationCode = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('http://localhost:5000/api/send-verification-code', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Erreur lors de l\'envoi du code');
      }
      alert('Code de vérification envoyé à votre email');
    } catch (err) {
      console.error(err);
      alert(err.message);
    }
  };

  const verifyCode = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('http://localhost:5000/api/verify-code', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ code: inputCode }),
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Erreur lors de la vérification du code');
      }
      setIsVerified(true);
      alert('Code vérifié avec succès !');
    } catch (err) {
      console.error(err);
      alert(err.message);
    }
  };

  const addField = (type, customOptions = defaultOptions) => {
    const newField = {
      fieldName: `${type}_${formFields.length + 1}`,
      fieldType: type,
      required: type === 'photo',
      options: type === 'select' ? customOptions : [],
    };
    setFormFields([...formFields, newField]);
    setIsMenuOpen(false);
  };

  const handleDynamicFormChange = (fieldName, value) => {
    setDynamicFormData({ ...dynamicFormData, [fieldName]: value });
  };

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

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Erreur lors de l\'ajout de l\'employé');
      }
      alert('Employé ajouté avec succès !');
      // Réinitialiser le formulaire et localStorage
      setDynamicFormData({});
      setFormFields([]);
      setIsVerified(false);
      setInputCode('');
      localStorage.removeItem('formFields');
      localStorage.removeItem('dynamicFormData');
    } catch (err) {
      console.error(err);
      alert(err.message);
    }
  };

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

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Erreur lors de la création du document');
      }
      alert('Formulaire de validité créé !');
      setValidityForm({ title: '', startDate: '', endDate: '', pdf: null });
    } catch (err) {
      console.error(err);
      alert(err.message);
    }
  };

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

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Erreur lors de la création du document');
      }
      alert('Formulaire de rappel créé !');
      setReminderForm({ title: '', startDate: '', endDate: '', pdf: null });
    } catch (err) {
      console.error(err);
      alert(err.message);
    }
  };

  const handleMessageSubmit = async (e) => {
    e.preventDefault();
    const recipients = messageForm.recipients.split(',').map(email => email.trim());
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('http://localhost:5000/api/messages', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          subject: messageForm.subject,
          body: messageForm.body,
          recipients,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Erreur lors de l\'envoi du message');
      }
      alert('Message envoyé avec succès !');
      setMessageForm({ subject: '', body: '', recipients: '' });
    } catch (err) {
      console.error(err);
      alert(err.message);
    }
  };

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

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Erreur lors de la mise à jour du profil');
      }
      const data = await response.json();
      localStorage.setItem('user', JSON.stringify(data));
      setUser(data);
      alert('Profil mis à jour !');
    } catch (err) {
      console.error(err);
      alert(err.message);
    }
  };

  const toggleMenu = () => {
    setIsMenuOpen(!isMenuOpen);
  };

  const handleFieldSelect = (e) => {
    const fieldType = e.target.value;
    if (fieldType === 'select') {
      // Demander des options personnalisées pour le sélecteur
      const customOptions = prompt('Entrez les options pour le sélecteur (séparées par des virgules) :', defaultOptions.join(','));
      if (customOptions) {
        addField(fieldType, customOptions.split(',').map(opt => opt.trim()));
      } else {
        addField(fieldType);
      }
    } else if (fieldType) {
      addField(fieldType);
    }
  };

  return (
    <div className="dashboard">
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

      <div className="verification">
        <h2>Vérification</h2>
        <button onClick={requestVerificationCode}>Envoyer le code par email</button>
        <input
          type="text"
          placeholder="Entrez le code reçu"
          value={inputCode}
          onChange={(e) => setInputCode(e.target.value)}
        />
        <button onClick={verifyCode}>Vérifier</button>
      </div>

      {isVerified && (
        <div className="dynamic-form">
          <h2>Formulaire dynamique</h2>
          <div className="field-selector">
            <button className="hamburger-button" onClick={toggleMenu} aria-label="Ouvrir le menu des champs">
              <MdMenu className="hamburger-icon" />
            </button>
            {isMenuOpen && (
              <select onChange={handleFieldSelect} className="field-select">
                <option value="">Choisir un type de champ</option>
                <option value="text">Texte</option>
                <option value="photo">Photo</option>
                <option value="number">Numéro</option>
                <option value="select">Sélecteur (Départements)</option>
              </select>
            )}
          </div>
          <form onSubmit={handleDynamicFormSubmit}>
            {formFields.map((field, index) => (
              <div key={index} className="form-field">
                {field.fieldType === 'text' && (
                  <input
                    type="text"
                    placeholder={field.fieldName}
                    value={dynamicFormData[field.fieldName] || ''}
                    onChange={(e) => handleDynamicFormChange(field.fieldName, e.target.value)}
                    required={field.required}
                  />
                )}
                {field.fieldType === 'number' && (
                  <input
                    type="number"
                    placeholder={field.fieldName}
                    value={dynamicFormData[field.fieldName] || ''}
                    onChange={(e) => handleDynamicFormChange(field.fieldName, e.target.value)}
                    required={field.required}
                  />
                )}
                {field.fieldType === 'select' && (
                  <select
                    value={dynamicFormData[field.fieldName] || ''}
                    onChange={(e) => handleDynamicFormChange(field.fieldName, e.target.value)}
                    required={field.required}
                  >
                    <option value="">Sélectionnez un département</option>
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

      {user && user.role === 'admin' && (
        <div className="message-form">
          <h2>Envoyer un message</h2>
          <form onSubmit={handleMessageSubmit}>
            <input
              type="text"
              placeholder="Sujet"
              value={messageForm.subject}
              onChange={(e) => setMessageForm({ ...messageForm, subject: e.target.value })}
              required
            />
            <textarea
              placeholder="Corps du message"
              value={messageForm.body}
              onChange={(e) => setMessageForm({ ...messageForm, body: e.target.value })}
              required
            />
            <input
              type="text"
              placeholder="Destinataires (emails séparés par des virgules)"
              value={messageForm.recipients}
              onChange={(e) => setMessageForm({ ...messageForm, recipients: e.target.value })}
              required
            />
            <button type="submit">Envoyer</button>
          </form>
        </div>
      )}

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
              <div className="employee-info">
                <p><MdEmail className="info-icon" /> Email: {employee.email}</p>
                <p><MdBusiness className="info-icon" /> Département: {employee.department}</p>
                <p><MdWork className="info-icon" /> Position: {employee.position}</p>
                <p><MdCalendarToday className="info-icon" /> Date d'embauche: {new Date(employee.hireDate).toLocaleDateString()}</p>
                <p><MdArticle className="info-icon" /> Documents: {employee.customFields?.pdf ? 1 : 0}</p>
                <p><MdPerson className="info-icon" /> Créé par: {employee.createdBy?.email}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
