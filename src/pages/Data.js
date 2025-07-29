// src/pages/Data.js
import React from "react";
import { motion } from "framer-motion";

const Data = () => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="min-vh-100 d-flex align-items-center justify-content-center"
    >
      <h1 className="display-4 text-dark dark:text-white">Data</h1>
    </motion.div>
  );
};

export default Data;
