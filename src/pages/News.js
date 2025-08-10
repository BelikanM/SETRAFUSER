import React, { useContext, useState } from 'react';
import { UserContext } from '../context/UserContext';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import 'react-quill/dist/quill.snow.css';
import './News.css';
import { FaEye } from 'react-icons/fa';

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

// Supprime l'image du contenu
const cleanContent = (html) => {
  return html.replace(/<img[^>]*>/i, ''); // enlève première image
};

// Tronque le texte
const getExcerpt = (html, length = 300) => {
  const text = html.replace(/<[^>]+>/g, '');
  return text.length > length ? text.slice(0, length) + '...' : text;
};

const News = () => {
  const { user } = useContext(UserContext);
  const [expanded, setExpanded] = useState({});
  const [search, setSearch] = useState(""); // 🔍 Barre de recherche
  const [viewersModal, setViewersModal] = useState({ show: false, viewers: [] });

  const queryClient = useQueryClient();

  const { data: articles = [], isLoading, isError, error } = useQuery({
    queryKey: ['news'],
    queryFn: fetchArticles,
    refetchInterval: 10000,
    refetchOnWindowFocus: true,
  });

  const { mutate: incrementView } = useMutation({
    mutationFn: async (id) => {
      const token = localStorage.getItem('token');
      await axios.post(`http://localhost:5000/api/forms/${id}/view`, {}, {
        headers: { Authorization: `Bearer ${token}` },
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['news']);
    },
  });

  const toggleExpand = (id) => {
    setExpanded((prev) => {
      const newExpanded = { ...prev, [id]: !prev[id] };
      if (!prev[id]) {
        incrementView(id);
      }
      return newExpanded;
    });
  };

  const handleShowViewers = async (id) => {
    const token = localStorage.getItem('token');
    try {
      const res = await axios.get(`http://localhost:5000/api/forms/${id}/viewers`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setViewersModal({ show: true, viewers: res.data });
    } catch (err) {
      console.error('Erreur lors de la récupération des viewers');
    }
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

  // 🔍 Filtrer les articles selon la recherche
  const filteredArticles = articles.filter((article) => {
    const title = article.name || "";
    const textContent = article.content.replace(/<[^>]+>/g, "");
    return (
      title.toLowerCase().includes(search.toLowerCase()) ||
      textContent.toLowerCase().includes(search.toLowerCase())
    );
  });

  return (
    <div className="news-container">
      <h1>Flux d'actualités</h1>
      <p>
        Bienvenue, {user.firstName} {user.lastName} ({user.role}).  
      
      </p>

      {/* 🔍 Barre de recherche */}
      <input
        type="text"
        placeholder="Rechercher un article..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="search-bar"
      />

      <div className="articles-feed" style={{ paddingBottom: '80px' }}>
        {filteredArticles.length === 0 ? (
          <p>Aucun article trouvé.</p>
        ) : (
          filteredArticles.map((article) => {
            const isLong = article.content.replace(/<[^>]+>/g, '').length > 300;
            const firstImage = extractFirstImage(article.content);
            const cleanedContent = cleanContent(article.content);

            return (
              <div key={article._id} className="article-card">
                {firstImage && (
                  <div className="article-image-wrapper">
                    {article.name && <h2 className="article-title">{article.name}</h2>}
                    <img src={firstImage} alt="Vignette" className="article-image" />
                  </div>
                )}
                <p className="article-date">
                  Publié le : {new Date(article.createdAt).toLocaleDateString()}
                </p>
                <button onClick={() => handleShowViewers(article._id)} className="views-button"><FaEye /> {article.views}</button>
                <div className="article-content">
                  {expanded[article._id] ? (
                    <div dangerouslySetInnerHTML={{ __html: cleanedContent }}></div>
                  ) : (
                    <p>{getExcerpt(cleanedContent, 300)}</p>
                  )}
                </div>
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
      {viewersModal.show && (
        <div className="viewers-modal">
          <h4>Vus par :</h4>
          <ul className="viewers-list scrollable">
            {viewersModal.viewers.map((viewer) => (
              <li key={viewer._id}>
                {viewer.firstName} {viewer.lastName}
                {viewer.profilePhoto && <img src={`http://localhost:5000/${viewer.profilePhoto}`} alt="Profile" className="small-avatar" />}
              </li>
            ))}
          </ul>
          <button onClick={() => setViewersModal({ show: false, viewers: [] })} className="close-button">Fermer</button>
        </div>
      )}
    </div>
  );
};

export default News;
