import React, { useState, useContext } from "react";
import { NavLink } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { HomeIcon, UserIcon, UsersIcon, CircleStackIcon, SunIcon, MoonIcon } from "@heroicons/react/24/outline";
import { ThemeContext } from "../context/ThemeContext";

const FooterNav = () => {
  const { isDarkMode, toggleTheme } = useContext(ThemeContext);
  const [isCircleOpen, setIsCircleOpen] = useState(false);

  const toggleCircleNav = () => {
    setIsCircleOpen((prev) => !prev);
  };

  const navItems = [
    { path: "/", icon: HomeIcon, label: "Accueil" },
    { path: "/profile", icon: UserIcon, label: "Profil" },
    { path: "/people", icon: UsersIcon, label: "Personnes" },
    { path: "/data", icon: CircleStackIcon, label: "Data" },
  ];

  const circleNavItems = [
    { path: "/profile", icon: UserIcon, label: "Profil" },
    { path: "/people", icon: UsersIcon, label: "Personnes" },
    { path: "/data", icon: CircleStackIcon, label: "Data" },
  ];

  return (
    <>
      {/* Barre de navigation principale */}
      <motion.nav
        initial={{ y: 100 }}
        animate={{ y: 0 }}
        transition={{ type: "spring", stiffness: 120 }}
        className={`fixed-bottom navbar navbar-expand ${isDarkMode ? "bg-dark" : "bg-light"} shadow-lg d-flex justify-content-around align-items-center py-3`}
      >
        {navItems.slice(0, 2).map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            className={({ isActive }) =>
              `nav-link d-flex flex-column align-items-center ${isActive ? "active" : ""}`
            }
          >
            <item.icon className="w-6 h-6" />
            <span className="small">{item.label}</span>
          </NavLink>
        ))}

        {/* Bouton central */}
        <motion.button
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.9 }}
          onClick={toggleCircleNav}
          className="btn btn-success rounded-circle d-flex align-items-center justify-content-center"
          style={{ width: "48px", height: "48px", marginTop: "-24px", backgroundColor: "var(--whatsapp-green)" }}
          aria-label="Toggle circular navigation"
        >
          <HomeIcon className="w-6 h-6 text-white" />
        </motion.button>

        {navItems.slice(2).map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            className={({ isActive }) =>
              `nav-link d-flex flex-column align-items-center ${isActive ? "active" : ""}`
            }
          >
            <item.icon className="w-6 h-6" />
            <span className="small">{item.label}</span>
          </NavLink>
        ))}

        {/* Toggle thème */}
        <motion.button
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.9 }}
          onClick={toggleTheme}
          className="nav-link d-flex flex-column align-items-center"
          aria-label="Toggle theme"
        >
          {isDarkMode ? <SunIcon className="w-6 h-6" /> : <MoonIcon className="w-6 h-6" />}
          <span className="small">{isDarkMode ? "Clair" : "Sombre"}</span>
        </motion.button>
      </motion.nav>

      {/* Navigation circulaire arc-en-ciel */}
      <AnimatePresence>
        {isCircleOpen && (
          <motion.div
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            transition={{ type: "spring", stiffness: 100 }}
            className="position-fixed bottom-20 end-0 w-48 h-48"
            style={{ zIndex: 20 }}
          >
            <div className="position-relative w-100 h-100">
              <motion.div
                className="position-absolute w-100 h-100 circular-nav rounded-circle"
                initial={{ rotate: -90 }}
                animate={{ rotate: 0 }}
                transition={{ duration: 0.5 }}
                style={{ transformOrigin: "bottom right", transform: "scale(0.75)" }}
              />
              <div className="position-absolute w-100 h-100 d-flex flex-column align-items-end justify-content-center gap-3 pe-4">
                {circleNavItems.map((item, index) => (
                  <motion.div
                    key={item.path}
                    initial={{ x: 50, opacity: 0 }}
                    animate={{ x: 0, opacity: 1 }}
                    transition={{ delay: index * 0.1 }}
                  >
                    <NavLink
                      to={item.path}
                      className="d-flex align-items-center gap-2 text-white"
                      style={{ textDecoration: "none" }}
                      onClick={() => setIsCircleOpen(false)}
                    >
                      <item.icon className="w-5 h-5" />
                      <span>{item.label}</span>
                    </NavLink>
                  </motion.div>
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};

export default FooterNav;
