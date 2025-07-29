// src/App.js
import React from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import { ThemeProvider } from "./context/ThemeContext";
import FooterNav from "./components/FooterNav";
import Home from "./pages/Home";
import Profile from "./pages/Profile";
import People from "./pages/People";
import Data from "./pages/Data";
import Engins from "./pages/Engins";
import GPS from "./pages/GPS";
import News from "./pages/News";
import Followers from "./pages/Followers";

function App() {
  return (
    <ThemeProvider>
      <Router>
        <div className="pb-5">
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/profile" element={<Profile />} />
            <Route path="/people" element={<People />} />
            <Route path="/data" element={<Data />} />
            <Route path="/engins" element={<Engins />} />
            <Route path="/gps" element={<GPS />} />
            <Route path="/news" element={<News />} />
            <Route path="/followers" element={<Followers />} />
          </Routes>
          <FooterNav />
        </div>
      </Router>
    </ThemeProvider>
  );
}

export default App;
