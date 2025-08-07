// src/context/DataCacheContext.js
import React, { createContext, useContext, useState } from 'react';

const DataCacheContext = createContext();

export const DataCacheProvider = ({ children }) => {
  const [cache, setCache] = useState({});

  const setData = (key, data) => {
    setCache((prev) => ({ ...prev, [key]: data }));
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
