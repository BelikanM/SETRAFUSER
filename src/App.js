import React from 'react';
import { BrowserRouter as Router, Routes, Route, Outlet } from 'react-router-dom';
import { ThemeProvider } from './context/ThemeContext';
import { UserProvider } from './context/UserContext';
import NavigationBar from './components/NavigationBar'; // Changé en NavigationBar (assumé être FooterNav)
import Home from './pages/Home';
import Dashboard from './pages/Dashboard';
import People from './pages/People';
import Data from './pages/Data';
import Engins from './pages/Engins';
import GPS from './pages/GPS';
import News from './pages/News';
import Followers from './pages/Followers';
import Login from './pages/Login';
import Register from './pages/Register';
import Profile from './pages/Profile'; // Nouvelle importation pour la page Profile

// Layout principal pour les pages avec NavigationBar persistant
function MainLayout() {
  return (
    <div className="pb-5">
      <Outlet /> {/* Le contenu de la page changera ici */}
      <NavigationBar /> {/* Utilisation de NavigationBar au lieu de FooterNav */}
    </div>
  );
}

function App() {
  return (
    <ThemeProvider>
      <Router>
        <UserProvider>
          <Routes>
            {/* Toutes les routes nested avec MainLayout pour persistance de la barre */}
            <Route element={<MainLayout />}>
              <Route path="/" element={<Home />} />
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/people" element={<People />} />
              <Route path="/data" element={<Data />} />
              <Route path="/engins" element={<Engins />} />
              <Route path="/gps" element={<GPS />} />
              <Route path="/news" element={<News />} />
              <Route path="/followers" element={<Followers />} />
              <Route path="/profile" element={<Profile />} /> {/* Nouvelle route pour Profile */}
              <Route path="/login" element={<Login />} /> {/* Déplacée ici pour avoir la barre */}
              <Route path="/register" element={<Register />} /> {/* Déplacée ici pour avoir la barre */}
            </Route>
          </Routes>
        </UserProvider>
      </Router>
    </ThemeProvider>
  );
}

export default App;
