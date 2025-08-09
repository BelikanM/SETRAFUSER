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

// Récupère la première image
const extractFirstImage = (html) => {
  const match = html.match(/<img[^>]+src="([^">]+)"/i);
  return match ? match[1] : null;
};

// Récupère le titre (premier h1 ou h2)
const extractFirstTitle = (html) => {
  const match = html.match(/<h[1-2][^>]*>(.*?)<\/h[1-2]>/i);
  return match ? match[1] : null;
};

// Supprime l'image et le titre du contenu
const cleanContent = (html) => {
  return html
    .replace(/<img[^>]*>/i, '') // enlève première image
    .replace(/<h[1-2][^>]*>.*?<\/h[1-2]>/i, ''); // enlève premier titre
};

// Tronque le texte
const getExcerpt = (html, length = 300) => {
  const text = html.replace(/<[^>]+>/g, '');
  return text.length > length ? text.slice(0, length) + '...' : text;
};

const News = () => {
  const { user } = useContext(UserContext);
  const [expanded, setExpanded] = useState({});

  const { data: articles = [], isLoading, isError, error } = useQuery({
    queryKey: ['news'],
    queryFn: fetchArticles,
    refetchInterval: 10000,
    refetchOnWindowFocus: true,
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
        
      </p>
      <div className="articles-feed" style={{ paddingBottom: '80px' }}>
        {articles.length === 0 ? (
          <p>Aucun article disponible pour le moment.</p>
        ) : (
          articles.map((article) => {
            const isLong = article.content.replace(/<[^>]+>/g, '').length > 300;
            const firstImage = extractFirstImage(article.content);
            const firstTitle = extractFirstTitle(article.content);
            const cleanedContent = cleanContent(article.content);

            return (
              <div key={article._id} className="article-card">
                {/* Image vignette + titre en dessous */}
                {firstImage && (
                  <div className="article-image-wrapper">
                    <img
                      src={firstImage}
                      alt="Vignette"
                      className="article-image"
                    />
                    {firstTitle && (
                      <h2 className="article-title">{firstTitle}</h2>
                    )}
                  </div>
                )}

                {/* Date */}
                <p className="article-date">
                  Publié le : {new Date(article.createdAt).toLocaleDateString()}
                </p>

                {/* Contenu */}
                <div className="article-content">
                  {expanded[article._id] ? (
                    <div dangerouslySetInnerHTML={{ __html: cleanedContent }}></div>
                  ) : (
                    <p>{getExcerpt(cleanedContent, 300)}</p>
                  )}
                </div>

                {/* Bouton */}
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
