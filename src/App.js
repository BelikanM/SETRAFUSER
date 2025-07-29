// src/App.js
import React from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import { ThemeProvider } from "./context/ThemeContext";
import FooterNav from "./components/FooterNav";
import Home from "./pages/Home";
import Profile from "./pages/Profile";
import People from "./pages/People";
import Data from "./pages/Data";

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
          </Routes>
          <FooterNav />
        </div>
      </Router>
    </ThemeProvider>
  );
}

export default App;
