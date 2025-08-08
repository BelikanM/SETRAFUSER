// src/context/DataCacheContext.js
import React, { createContext, useContext, useState, useEffect } from 'react';

const DataCacheContext = createContext();

export const DataCacheProvider = ({ children }) => {
  const [cache, setCache] = useState({});

  // Charger depuis localStorage au montage
  useEffect(() => {
    const savedCache = localStorage.getItem('appCache');
    if (savedCache) {
      try {
        setCache(JSON.parse(savedCache));
      } catch (err) {
        console.error('Erreur parsing du cache localStorage:', err);
      }
    }
  }, []);

  // Sauvegarder dans localStorage à chaque mise à jour
  useEffect(() => {
    try {
      localStorage.setItem('appCache', JSON.stringify(cache));
    } catch (err) {
      console.error('Erreur sauvegarde du cache localStorage:', err);
    }
  }, [cache]);

  const setData = (key, data) => {
    const payload = {
      data,
      timestamp: new Date().toISOString(),
    };
    setCache((prev) => ({ ...prev, [key]: payload }));
  };

  const getData = (key) => cache[key];

  const clearData = (key) => {
    setCache((prev) => {
      const newCache = { ...prev };
      delete newCache[key];
      return newCache;
    });
  };

  return (
    <DataCacheContext.Provider value={{ getData, setData, clearData }}>
      {children}
    </DataCacheContext.Provider>
  );
};

export const useDataCache = () => useContext(DataCacheContext);
