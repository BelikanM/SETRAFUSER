import { createContext, useState, useEffect } from 'react';
import axios from 'axios';

export const MediaContext = createContext();

export const MediaProvider = ({ children }) => {
  const [mediaMessages, setMediaMessages] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchMedia = async () => {
      const token = localStorage.getItem('token');
      if (!token) return;

      const saved = localStorage.getItem('mediaMessages');
      if (saved) {
        setMediaMessages(JSON.parse(saved));
        setLoading(false);
      }

      try {
        const res = await axios.get('http://localhost:5000/api/chat/media-messages', {
          headers: { Authorization: `Bearer ${token}` },
        });
        setMediaMessages(res.data);
        localStorage.setItem('mediaMessages', JSON.stringify(res.data));
        setLoading(false);
      } catch (err) {
        console.error(err);
        setLoading(false);
      }
    };
    fetchMedia();
  }, []);

  useEffect(() => {
    if (mediaMessages.length > 0) {
      localStorage.setItem('mediaMessages', JSON.stringify(mediaMessages));
    }
  }, [mediaMessages]);

  return (
    <MediaContext.Provider value={{ mediaMessages, setMediaMessages, loading }}>
      {children}
    </MediaContext.Provider>
  );
};
