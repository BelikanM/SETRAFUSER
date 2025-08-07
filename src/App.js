// src/App.js
import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { ThemeProvider } from './context/ThemeContext';
import { UserProvider } from './context/UserContext';
import { DataCacheProvider } from './context/DataCacheContext';

import MainLayout from './MainLayout'; // ou './layouts/MainLayout' selon ton dossier

import Home from './pages/Home';
import Dashboard from './pages/Dashboard';
import People from './pages/People';
import Data from './pages/Data';
import Engins from './pages/Engins';
import GPS from './pages/GPS';
import News from './pages/News'; // ✅ ici on utilise News, pas Blog
import Followers from './pages/Followers';
import Login from './pages/Login';
import Register from './pages/Register';
import Profile from './pages/Profile';

const App = () => {
  return (
    <ThemeProvider>
      <Router>
        <UserProvider>
          <DataCacheProvider>
            <Routes>
              <Route element={<MainLayout />}>
                <Route path="/" element={<Home />} />
                <Route path="/dashboard" element={<Dashboard />} />
                <Route path="/people" element={<People />} />
                <Route path="/data" element={<Data />} />
                <Route path="/engins" element={<Engins />} />
                <Route path="/gps" element={<GPS />} />
                <Route path="/news" element={<News />} /> {/* ✅ ici aussi */}
                <Route path="/followers" element={<Followers />} />
                <Route path="/profile" element={<Profile />} />
                <Route path="/login" element={<Login />} />
                <Route path="/register" element={<Register />} />
              </Route>
            </Routes>
          </DataCacheProvider>
        </UserProvider>
      </Router>
    </ThemeProvider>
  );
};

export default App;
