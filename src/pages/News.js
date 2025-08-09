import React, { useContext, useState } from 'react';
import { UserContext } from '../context/UserContext';
import { useQuery } from '@tanstack/react-query';
import axios from 'axios';
import 'react-quill/dist/quill.snow.css';
import './News.css';

const fetchArticles = async () => {
  const token = localStorage.getItem('token');
  if (!token) throw new Error('Token non trouvé. Veuillez vous reconnecter.');

  const res = await axios.get('http://localhost:5000/api/forms', {
    headers: { Authorization: `Bearer ${token}` },
  });

  return res.data.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
};

const News = () => {
  const { user } = useContext(UserContext);
  const [expanded, setExpanded] = useState({});

  const { data: articles = [], isLoading, isError, error } = useQuery({
    queryKey: ['news'],
    queryFn: fetchArticles,
    refetchInterval: 10000, // Mise à jour toutes les 10 secondes
    refetchOnWindowFocus: true, // Rafraîchissement discret au retour sur la page
  });

  const toggleExpand = (id) => {
    setExpanded((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  if (isLoading && articles.length === 0) {
    return <div className="loading">Chargement des articles...</div>;
  }
  if (isError) {
    return <div className="error">{error.message}</div>;
  }
  if (!user) {
    return <div className="error">Utilisateur non chargé. Veuillez vous reconnecter.</div>;
  }

  return (
    <div className="news-container">
      <h1>Flux d'actualités</h1>
      <p>
        Bienvenue, {user.firstName} {user.lastName} ({user.role}).  
        Les articles s’actualisent automatiquement.
      </p>
      <div className="articles-feed">
        {articles.length === 0 ? (
          <p>Aucun article disponible pour le moment.</p>
        ) : (
          articles.map((article) => {
            const isLong = article.content.length > 1000;
            return (
              <div key={article._id} className="article-card">
                <h2>{article.name}</h2>
                <p className="article-date">
                  Publié le : {new Date(article.createdAt).toLocaleDateString()}
                </p>
                <div
                  className={`article-content ${expanded[article._id] ? 'expanded' : ''}`}
                  dangerouslySetInnerHTML={{ __html: article.content }}
                ></div>
                {isLong && (
                  <button
                    className="expand-button"
                    onClick={() => toggleExpand(article._id)}
                  >
                    {expanded[article._id] ? 'Réduire' : 'Dérouler le reste'}
                  </button>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

export default News;
