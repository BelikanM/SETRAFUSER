// src/components/ScrollRestorer.js
import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

const ScrollRestorer = () => {
  const location = useLocation();

  useEffect(() => {
    const savedY = sessionStorage.getItem(`scroll-${location.pathname}`);
    if (savedY) {
      window.scrollTo(0, parseInt(savedY, 10));
    }

    const saveScroll = () => {
      sessionStorage.setItem(`scroll-${location.pathname}`, window.scrollY);
    };

    window.addEventListener('scroll', saveScroll);
    return () => window.removeEventListener('scroll', saveScroll);
  }, [location.pathname]);

  return null;
};

export default ScrollRestorer;
