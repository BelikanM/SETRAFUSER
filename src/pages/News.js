// src/pages/News.js
import React, { useEffect, useState } from 'react';
import axios from 'axios';
import './News.css'; // si tu as un fichier CSS pour styliser
import { useDataCache } from '../context/DataCacheContext';

const News = () => {
  const { getData, setData } = useDataCache();
  const [articles, setArticles] = useState(getData('newsArticles') || []);
  const [loading, setLoading] = useState(!getData('newsArticles'));
  const [error, setError] = useState(null);

  // Pour appliquer un style spécifique aux images HTML des articles
  useEffect(() => {
    const style = document.createElement('style');
    style.innerHTML = `
      .article-content img {
        max-width: 100%;
        height: auto;
        display: block;
        margin: 0 auto;
        border-radius: 5px;
        box-shadow: 0 2px 4px rgba(0,0,0,0.1);
      }
    `;
    document.head.appendChild(style);
    return () => document.head.removeChild(style);
  }, []);

  useEffect(() => {
    if (getData('newsArticles')) return; // Déjà en cache, pas besoin de fetch

    const fetchArticles = async () => {
      try {
        const token = localStorage.getItem('token');
        if (!token) throw new Error('Vous devez être connecté pour accéder aux articles.');

        const res = await axios.get('http://localhost:5000/api/forms', {
          headers: { Authorization: `Bearer ${token}` },
        });

        const sorted = res.data.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        setArticles(sorted);
        setData('newsArticles', sorted); // Stocker en cache
      } catch (err) {
        setError(err.response?.data?.message || 'Erreur lors du chargement des articles.');
      } finally {
        setLoading(false);
      }
    };

    fetchArticles();
  }, []);

  if (loading) return <div className="loading">Chargement des articles...</div>;
  if (error) return <div className="error">{error}</div>;

  return (
    <div className="news-container">
      <h1>Articles d'actualité</h1>
      {articles.length === 0 ? (
        <p>Aucun article disponible pour le moment.</p>
      ) : (
        articles.map((article) => (
          <div key={article._id} className="article-card">
            <h2>{article.name}</h2>
            <p className="article-date">Publié le : {new Date(article.createdAt).toLocaleString()}</p>
            <div className="article-content" dangerouslySetInnerHTML={{ __html: article.content }} />
          </div>
        ))
      )}
    </div>
  );
};

export default News;
