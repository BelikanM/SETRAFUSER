import React from 'react';
import { NavLink } from 'react-router-dom';
import { 
  MdDashboard, 
  MdDataUsage, 
  MdConstruction, 
  MdPeople, 
  MdGpsFixed, 
  MdHome, 
  MdRssFeed, 
  MdPerson, 
  MdLogin, 
  MdPersonAdd 
} from 'react-icons/md';
import { FaHardHat } from 'react-icons/fa'; // Correction: Importation de FaHardHat depuis react-icons/fa
import './NavigationBar.css';

const NavigationBar = () => {
  const navItems = [
    { path: '/dashboard', label: 'Dashboard', icon: <MdDashboard /> },
    { path: '/data', label: 'Data', icon: <MdDataUsage /> },
    { path: '/engins', label: 'Engins', icon: <FaHardHat /> }, // Icône casque de chantier
    { path: '/followers', label: 'Followers', icon: <MdPeople /> },
    { path: '/gps', label: 'GPS', icon: <MdGpsFixed /> },
    { path: '/home', label: 'Home', icon: <MdHome /> },
    { path: '/news', label: 'News', icon: <MdRssFeed /> },
    { path: '/profile', label: 'Profile', icon: <MdPerson /> },
    { path: '/login', label: 'Login', icon: <MdLogin /> },
    { path: '/register', label: 'Register', icon: <MdPersonAdd /> },
  ];

  return (
    <nav className="nav-container">
      <div className="nav-wrapper">
        {navItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
          >
            {item.icon}
            <span>{item.label}</span>
          </NavLink>
        ))}
      </div>
    </nav>
  );
};

export default NavigationBar;
