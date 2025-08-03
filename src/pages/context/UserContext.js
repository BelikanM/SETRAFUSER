// src/context/UserContext.js
import React, { createContext, useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';

export const UserContext = createContext();

export const UserProvider = ({ children }) => {
  const navigate = useNavigate();
  const [token, setToken] = useState(localStorage.getItem('token'));
  const [user, setUser] = useState(null);
  const [employees, setEmployees] = useState([]);
  const [forms, setForms] = useState([]);
  const [users, setUsers] = useState([]);
  const [stats, setStats] = useState({ totalEmployees: 0, totalCertificates: 0, expiredCertificates: 0, totalUsers: 0, verifiedUsers: 0, approvedUsers: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchData = useCallback(async (authToken) => {
    if (!authToken) {
      setError('Aucun token trouvé. Veuillez vous connecter.');
      handleLogout();
      return;
    }

    try {
      // Fetch user profile
      const userRes = await axios.get('http://localhost:5000/api/user/profile', {
        headers: { Authorization: `Bearer ${authToken}` },
      });
      setUser(userRes.data);

      // Fetch stats if admin or manager
      if (userRes.data.role === 'admin' || userRes.data.role === 'manager') {
        await fetchStats(authToken);
        // Fetch employees
        const employeesRes = await axios.get('http://localhost:5000/api/employees', {
          headers: { Authorization: `Bearer ${authToken}` },
        });
        setEmployees(employeesRes.data);

        // Fetch forms
        const formsRes = await axios.get('http://localhost:5000/api/forms', {
          headers: { Authorization: `Bearer ${authToken}` },
        });
        setForms(formsRes.data);
      }

      // Fetch all users if admin
      if (userRes.data.role === 'admin') {
        await fetchUsers(authToken);
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
  }, []);

  const fetchStats = async (authToken) => {
    try {
      const statsRes = await axios.get('http://localhost:5000/api/stats', {
        headers: { Authorization: `Bearer ${authToken}` },
      });
      setStats(statsRes.data);
    } catch (err) {
      console.error('Erreur lors du fetch des stats');
    }
  };

  const fetchUsers = async (authToken) => {
    try {
      const usersRes = await axios.get('http://localhost:5000/api/users', {
        headers: { Authorization: `Bearer ${authToken}` },
      });
      const fetchedUsers = usersRes.data;
      setUsers(fetchedUsers);
      // Calculer stats supplémentaires pour super admin
      const totalUsers = fetchedUsers.length;
      const verifiedUsers = fetchedUsers.filter(u => u.isVerified).length;
      const approvedUsers = fetchedUsers.filter(u => u.isApproved).length;
      setStats(prev => ({ ...prev, totalUsers, verifiedUsers, approvedUsers }));
    } catch (err) {
      console.error('Erreur lors du fetch des utilisateurs');
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    setToken(null);
    setUser(null);
    setEmployees([]);
    setForms([]);
    setUsers([]);
    setStats({ totalEmployees: 0, totalCertificates: 0, expiredCertificates: 0, totalUsers: 0, verifiedUsers: 0, approvedUsers: 0 });
    navigate('/login');
  };

  useEffect(() => {
    if (token) {
      fetchData(token);
    } else {
      setLoading(false);
    }
  }, [token, fetchData]);

  const value = {
    token,
    setToken,
    user,
    setUser,
    employees,
    setEmployees,
    forms,
    setForms,
    users,
    setUsers,
    stats,
    setStats,
    loading,
    error,
    setError,
    handleLogout,
    fetchData,
    fetchStats,
    fetchUsers,
  };

  return <UserContext.Provider value={value}>{children}</UserContext.Provider>;
};
