import React from 'react';
import { BrowserRouter as Router, Routes, Route, Outlet, useLocation } from 'react-router-dom';
import { ThemeProvider } from './context/ThemeContext';
import { UserProvider } from './context/UserContext';
import NavigationBar from './components/NavigationBar';
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
import Profile from './pages/Profile';
import { CSSTransition, SwitchTransition } from 'react-transition-group';

function MainLayout() {
  const location = useLocation();
  return (
    <div className="pb-5" style={{ position: 'relative', overflow: 'hidden', height: '100vh' }}>
      <SwitchTransition>
        <CSSTransition key={location.pathname} classNames="page" timeout={300}>
          <div style={{ position: 'absolute', width: '100%', left: 0, top: 0, bottom: 0, overflowY: 'auto' }}>
            <Outlet />
          </div>
        </CSSTransition>
      </SwitchTransition>
      <NavigationBar />
    </div>
  );
}

function App() {
  return (
    <ThemeProvider>
      <Router>
        <UserProvider>
          <Routes>
            <Route element={<MainLayout />}>
              <Route path="/" element={<Home />} />
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/people" element={<People />} />
              <Route path="/data" element={<Data />} />
              <Route path="/engins" element={<Engins />} />
              <Route path="/gps" element={<GPS />} />
              <Route path="/news" element={<News />} />
              <Route path="/followers" element={<Followers />} />
              <Route path="/profile" element={<Profile />} />
              <Route path="/login" element={<Login />} />
              <Route path="/register" element={<Register />} />
            </Route>
          </Routes>
        </UserProvider>
      </Router>
    </ThemeProvider>
  );
}

export default App;
