// src/pages/Blog.js
import React, { useState, useEffect, useContext } from 'react';
import { UserContext } from '../context/UserContext';
import { FaSearch, FaCalendarAlt } from 'react-icons/fa';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import './Blog.css'; // Fichier CSS dédié pour la page blog (à créer avec des styles modernes)

const Blog = () => {
  const { forms, setForms, loading, error, setError } = useContext(UserContext);
  const [searchQuery, setSearchQuery] = useState('');
  const [filteredArticles, setFilteredArticles] = useState([]);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchArticles = async () => {
      const token = localStorage.getItem('token');
      try {
        const res = await axios.get('http://localhost:5000/api/forms', {
          headers: { Authorization: `Bearer ${token}` },
        });
        setForms(res.data);
      } catch (err) {
        setError('Erreur lors de la récupération des articles');
      }
    };

    if (!forms.length) {
      fetchArticles();
    }
  }, [forms, setForms, setError]);

  useEffect(() => {
    const filtered = forms.filter(article => article.name.toLowerCase().includes(searchQuery.toLowerCase()));
    setFilteredArticles(filtered);
  }, [searchQuery, forms]);

  const getExcerpt = (content) => {
    const text = content.replace(/<[^>]*>/g, ''); // Supprimer les tags HTML
    return text.length > 150 ? `${text.substring(0, 150)}...` : text;
  };

  const getFeaturedImage = (content) => {
    const match = content.match(/<img [^>]*src="([^"]*)"[^>]*>/);
    return match ? match[1] : null; // Retourne la première image trouvée dans le contenu
  };

  if (loading) return <div className="loading">Chargement des articles...</div>;
  if (error) return <div className="error">{error}</div>;

  return (
    <div className="blog-container">
      <header className="blog-header">
        <h1>Notre Blog</h1>
        <div className="search-container">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Rechercher un article..."
            className="search-bar"
          />
          <FaSearch className="search-icon" />
        </div>
      </header>

      <div className="articles-grid">
        {filteredArticles.length > 0 ? (
          filteredArticles.map((article) => {
            const featuredImage = getFeaturedImage(article.content);
            return (
              <div key={article._id} className="article-card">
                {featuredImage && (
                  <img
                    src={featuredImage}
                    alt={article.name}
                    className="article-image"
                    loading="lazy" // Lazy loading pour optimisation dynamique
                    style={{ maxWidth: '100%', height: 'auto' }} // Pour ne pas dépasser l'écran et rendre responsive
                  />
                )}
                <div className="article-content">
                  <h2 className="article-title">{article.name}</h2>
                  <p className="article-date">
                    <FaCalendarAlt /> Publié le {new Date(article.createdAt).toLocaleDateString()}
                  </p>
                  <p className="article-excerpt">{getExcerpt(article.content)}</p>
                  <button className="read-more-button" onClick={() => navigate(`/blog/${article._id}`)}>Lire l'article complet</button>
                </div>
              </div>
            );
          })
        ) : (
          <p>Aucun article trouvé.</p>
        )}
      </div>
    </div>
  );
};

export default Blog;
