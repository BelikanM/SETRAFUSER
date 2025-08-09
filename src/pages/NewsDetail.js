// NewsDetail.js (complet, adapté avec IP locale pour tests sur téléphone)

import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import axios from 'axios';

const API_URL = 'http://192.168.1.100:5000'; // Remplace par ton IP locale (ex: 192.168.1.x)

const NewsDetail = () => {
  const { id } = useParams();
  const [article, setArticle] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchArticle = async () => {
      try {
        const token = localStorage.getItem('token');
        const res = await axios.get(`${API_URL}/api/forms/${id}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        setArticle(res.data);
      } catch (err) {
        setError(err.response?.data?.message || 'Erreur lors de la récupération de l’article');
      } finally {
        setLoading(false);
      }
    };

    fetchArticle();
  }, [id]);

  if (loading) return <div>Chargement...</div>;
  if (error) return <div>{error}</div>;
  if (!article) return <div>Aucun article trouvé.</div>;

  return (
    <div className="news-detail" style={{ padding: '20px' }}>
      <h1>{article.name}</h1>
      <p>Publié le {new Date(article.createdAt).toLocaleDateString()}</p>
      <div dangerouslySetInnerHTML={{ __html: article.content }} />
    </div>
  );
};

export default NewsDetail;
