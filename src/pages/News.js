// src/pages/Blog.js
import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './Blog.css'; // Fichier CSS dédié pour la page blog

const Blog = () => {
  const [articles, setArticles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchArticles = async () => {
      try {
        const token = localStorage.getItem('token');
        if (!token) {
          throw new Error('Vous devez être connecté pour accéder aux articles.');
        }
        const res = await axios.get('http://localhost:5000/api/forms', {
          headers: { Authorization: `Bearer ${token}` },
        });
        // Trier les articles par date de création (du plus récent au plus ancien)
        const sortedArticles = res.data.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        setArticles(sortedArticles);
        setLoading(false);
      } catch (err) {
        setError(err.response?.data?.message || 'Erreur lors du chargement des articles. Vérifiez que vous avez les permissions nécessaires.');
        setLoading(false);
      }
    };

    fetchArticles();
  }, []);

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

  if (loading) return <div className="loading">Chargement des articles...</div>;
  if (error) return <div className="error">{error}</div>;

  return (
    <div className="blog-container">
      <h1>Articles du Blog</h1>
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

export default Blog;
