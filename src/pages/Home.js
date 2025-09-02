import React, { useState, useEffect, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import io from 'socket.io-client';
import axios from 'axios';
import { FiMessageSquare, FiShare } from 'react-icons/fi';
import { FaHeart, FaRegHeart, FaMusic } from 'react-icons/fa';
import { BiDislike } from 'react-icons/bi';

const Home = () => {
  const queryClient = useQueryClient();
  const [socket, setSocket] = useState(null);
  const [currentVideo, setCurrentVideo] = useState(null);
  const [mediaDimensions, setMediaDimensions] = useState({});
  const [commentInputs, setCommentInputs] = useState({});
  const videoRefs = useRef([]);
  const imageRefs = useRef([]);

  const token = localStorage.getItem('token');

  const { data: currentUser, isLoading: userLoading } = useQuery({
    queryKey: ['currentUser'],
    queryFn: async () => {
      if (!token) throw new Error('No token');
      const profileData = await axios.get('http://localhost:5000/api/user/profile', {
        headers: { Authorization: `Bearer ${token}` },
      });
      return profileData.data;
    },
    enabled: !!token,
    staleTime: Infinity,
  });

  const { data: mediaMessages = [], isLoading: mediaLoading } = useQuery({
    queryKey: ['mediaMessages'],
    queryFn: async () => {
      if (!token) throw new Error('No token');
      const response = await axios.get('http://localhost:5000/api/chat/media-messages', {
        headers: { Authorization: `Bearer ${token}` },
      });
      return response.data;
    },
    enabled: !!currentUser,
    staleTime: Infinity,
  });

  // Initialiser socket après chargement de l'utilisateur
  useEffect(() => {
    if (!currentUser) return;

    const newSocket = io('http://localhost:5000');
    newSocket.on('connect', () => newSocket.emit('authenticate', token));
    setSocket(newSocket);

    return () => {
      newSocket.disconnect();
    };
  }, [currentUser, token]);

  // Gestion socket temps réel
  useEffect(() => {
    if (!socket) return;

    socket.on('new-group-message', (msg) => {
      if (msg.content.startsWith('[IMAGE]') || msg.content.startsWith('[VIDEO]')) {
        queryClient.setQueryData(['mediaMessages'], (old) => [msg, ...old]);
      }
    });

    socket.on('message-liked', (updatedMsg) => {
      queryClient.setQueryData(['mediaMessages'], (old) =>
        old.map((m) => (m._id === updatedMsg._id ? updatedMsg : m))
      );
    });

    socket.on('message-disliked', (updatedMsg) => {
      queryClient.setQueryData(['mediaMessages'], (old) =>
        old.map((m) => (m._id === updatedMsg._id ? updatedMsg : m))
      );
    });

    socket.on('message-deleted', (id) => {
      queryClient.setQueryData(['mediaMessages'], (old) => old.filter((m) => m._id !== id));
    });

    socket.on('new-comment', (updatedMsg) => {
      queryClient.setQueryData(['mediaMessages'], (old) =>
        old.map((m) => (m._id === updatedMsg._id ? updatedMsg : m))
      );
    });

    return () => {
      socket.off('new-group-message');
      socket.off('message-liked');
      socket.off('message-disliked');
      socket.off('message-deleted');
      socket.off('new-comment');
    };
  }, [socket, queryClient]);

  // Détection du format des médias
  useEffect(() => {
    const detectMediaDimensions = () => {
      const newDimensions = {};

      // Détection pour les images
      imageRefs.current.forEach((img, index) => {
        if (img && img.naturalWidth) {
          const isLandscape = img.naturalWidth > img.naturalHeight;
          newDimensions[index] = {
            width: img.naturalWidth,
            height: img.naturalHeight,
            aspectRatio: isLandscape ? '16:9' : '9:16',
            orientation: isLandscape ? 'landscape' : 'portrait'
          };
        }
      });

      // Détection pour les vidéos
      videoRefs.current.forEach((video, index) => {
        if (video && video.videoWidth) {
          const isLandscape = video.videoWidth > video.videoHeight;
          newDimensions[index] = {
            width: video.videoWidth,
            height: video.videoHeight,
            aspectRatio: isLandscape ? '16:9' : '9:16',
            orientation: isLandscape ? 'landscape' : 'portrait'
          };
        }
      });

      setMediaDimensions(newDimensions);
    };

    // Utiliser un délai pour s'assurer que les médias sont chargés
    const timer = setTimeout(detectMediaDimensions, 500);
    return () => clearTimeout(timer);
  }, [mediaMessages]);

  // Like / Dislike
  const handleLike = (id) => socket?.emit('like-message', { messageId: id });
  const handleDislike = (id) => socket?.emit('dislike-message', { messageId: id });

  // Ajouter commentaire
  const handleAddComment = (msgId) => {
    const content = commentInputs[msgId];
    if (!content || !socket) return;
    socket.emit('add-comment', { messageId: msgId, content });
    setCommentInputs((prev) => ({ ...prev, [msgId]: '' }));
  };

  const handleCommentChange = (msgId, value) => {
    setCommentInputs((prev) => ({ ...prev, [msgId]: value }));
  };

  // Lecture vidéo auto
  const handleVideoPlay = (index) => {
    if (currentVideo !== null && videoRefs.current[currentVideo]) {
      videoRefs.current[currentVideo].pause();
    }
    setCurrentVideo(index);
  };

  // Gestion du chargement des médias
  const handleMediaLoad = (index, type) => {
    setMediaDimensions(prev => {
      const element = type === 'image' ? imageRefs.current[index] : videoRefs.current[index];
      if (!element) return prev;
      
      const width = element.naturalWidth || element.videoWidth;
      const height = element.naturalHeight || element.videoHeight;
      const isLandscape = width > height;
      return {
        ...prev,
        [index]: {
          width,
          height,
          aspectRatio: isLandscape ? '16:9' : '9:16',
          orientation: isLandscape ? 'landscape' : 'portrait'
        }
      };
    });
  };

  // Persistance du scroll
  useEffect(() => {
    const savedScroll = localStorage.getItem('scrollPosition');
    if (savedScroll) {
      window.scrollTo(0, parseInt(savedScroll));
    }

    const handleScroll = () => {
      localStorage.setItem('scrollPosition', window.scrollY.toString());
    };

    window.addEventListener('scroll', handleScroll);

    return () => {
      window.removeEventListener('scroll', handleScroll);
    };
  }, []);

  const loading = userLoading || mediaLoading;
  if (loading) return <div style={styles.loading}>Chargement...</div>;

  return (
    <div style={styles.container}>
      <div style={styles.feed}>
        {mediaMessages.map((msg, index) => {
          const isLiked = msg.likes.includes(currentUser?._id);
          const isDisliked = msg.dislikes.includes(currentUser?._id);
          const content = msg.content;
          const mediaUrl = content.replace(/^\[IMAGE\]|\[VIDEO\]/, '').split('\n')[0].trim();
          const type = content.startsWith('[IMAGE]') ? 'image' : 'video';
          const mediaInfo = mediaDimensions[index] || {};
          const isLandscape = mediaInfo.orientation === 'landscape';

          return (
            <div key={msg._id} style={styles.post}>
              <div style={{
                ...styles.postContent,
                aspectRatio: isLandscape ? '16/9' : '9/16'
              }}>
                {type === 'image' ? (
                  <img 
                    ref={(el) => (imageRefs.current[index] = el)}
                    src={`http://localhost:5000${mediaUrl}`} 
                    alt="media" 
                    style={{
                      ...styles.media,
                      objectFit: isLandscape ? 'cover' : 'contain',
                      backgroundColor: isLandscape ? '#000' : 'transparent'
                    }}
                    onLoad={() => handleMediaLoad(index, 'image')}
                  />
                ) : (
                  <video
                    ref={(el) => (videoRefs.current[index] = el)}
                    style={{
                      ...styles.media,
                      objectFit: isLandscape ? 'cover' : 'contain',
                      backgroundColor: isLandscape ? '#000' : 'transparent'
                    }}
                    src={`http://localhost:5000${mediaUrl}`}
                    controls
                    muted
                    loop
                    playsInline
                    onPlay={() => handleVideoPlay(index)}
                    onLoadedMetadata={() => handleMediaLoad(index, 'video')}
                  />
                )}
              </div>

              <div style={styles.commentsSection}>
                {msg.comments.map((comment, cIndex) => (
                  <div key={cIndex} style={styles.comment}>
                    <img
                      src={`http://localhost:5000/${comment.sender.profilePhoto}`}
                      alt={`${comment.sender.firstName} ${comment.sender.lastName}`}
                      style={styles.commentAvatar}
                    />
                    <div style={styles.commentContent}>
                      <span style={styles.commentAuthor}>{comment.sender.firstName} {comment.sender.lastName}: </span>
                      <span>{comment.content}</span>
                    </div>
                  </div>
                ))}
                <div style={styles.commentInput}>
                  <input
                    type="text"
                    value={commentInputs[msg._id] || ''}
                    onChange={(e) => handleCommentChange(msg._id, e.target.value)}
                    placeholder="Ajouter un commentaire..."
                    style={styles.input}
                  />
                  <button onClick={() => handleAddComment(msg._id)} style={styles.sendButton}>Envoyer</button>
                </div>
              </div>

              <div style={styles.postInfo}>
                <div style={styles.authorInfo}>
                  <img
                    src={`http://localhost:5000/${msg.sender.profilePhoto}`}
                    alt={msg.sender.firstName}
                    style={styles.authorAvatar}
                  />
                  <div style={styles.authorDetails}>
                    <span style={styles.authorName}>
                      @{msg.sender.firstName} {msg.sender.lastName}
                    </span>
                    <div style={styles.songInfo}>
                      <FaMusic size={12} />
                      <span style={styles.songName}>Son original - {msg.sender.firstName}</span>
                    </div>
                  </div>
                </div>

                <div style={styles.postActions}>
                  <div style={styles.actionButton} onClick={() => handleLike(msg._id)}>
                    {isLiked ? (
                      <FaHeart size={28} style={{ ...styles.icon, ...styles.liked }} />
                    ) : (
                      <FaRegHeart size={28} style={styles.icon} />
                    )}
                    <span style={styles.count}>{msg.likes.length}</span>
                  </div>

                  <div style={styles.actionButton} onClick={() => handleDislike(msg._id)}>
                    <BiDislike
                      size={28}
                      style={{ ...styles.icon, ...(isDisliked ? styles.disliked : {}) }}
                    />
                    <span style={styles.count}>{msg.dislikes.length}</span>
                  </div>

                  <div style={styles.actionButton}>
                    <FiMessageSquare size={28} style={styles.icon} />
                    <span style={styles.count}>{msg.comments?.length || 0}</span>
                  </div>

                  <div style={styles.actionButton}>
                    <FiShare size={28} style={styles.icon} />
                    <span style={styles.count}>Partager</span>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

// Styles modernes type TikTok
const styles = {
  container: {
    backgroundColor: '#000',
    color: '#fff',
    minHeight: '100vh',
    padding: '0',
    margin: '0',
    overflow: 'hidden',
    position: 'relative',
  },
  feed: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    width: '100%',
    maxWidth: '500px',
    margin: '0 auto',
  },
  post: {
    position: 'relative',
    width: '100%',
    marginBottom: '20px',
    borderBottom: '1px solid #2f2f2f',
    paddingBottom: '20px',
  },
  postContent: {
    position: 'relative',
    width: '100%',
    borderRadius: '10px',
    overflow: 'hidden',
    backgroundColor: '#121212',
    marginBottom: '15px',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
  },
  media: {
    width: '100%',
    height: '100%',
    maxHeight: '85vh',
    borderRadius: '10px',
  },
  commentsSection: {
    padding: '10px 15px',
    backgroundColor: '#121212',
    borderRadius: '10px',
    marginBottom: '15px',
  },
  comment: {
    display: 'flex',
    alignItems: 'center',
    marginBottom: '8px',
    fontSize: '14px',
  },
  commentAvatar: {
    width: '24px',
    height: '24px',
    borderRadius: '50%',
    marginRight: '8px',
    objectFit: 'cover',
  },
  commentContent: {
    display: 'flex',
    flexDirection: 'column',
  },
  commentAuthor: {
    fontWeight: 'bold',
    marginRight: '5px',
  },
  commentInput: {
    display: 'flex',
    marginTop: '10px',
  },
  input: {
    flex: 1,
    padding: '8px',
    borderRadius: '20px',
    border: '1px solid #2f2f2f',
    backgroundColor: '#1f1f1f',
    color: '#fff',
  },
  sendButton: {
    marginLeft: '10px',
    padding: '8px 15px',
    backgroundColor: '#ff0050',
    border: 'none',
    borderRadius: '20px',
    color: '#fff',
    cursor: 'pointer',
  },
  postInfo: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    padding: '0 15px',
  },
  authorInfo: {
    display: 'flex',
    alignItems: 'center',
    flex: 1,
  },
  authorAvatar: {
    width: '40px',
    height: '40px',
    borderRadius: '50%',
    marginRight: '10px',
    objectFit: 'cover',
    border: '2px solid #ff0050',
  },
  authorDetails: {
    display: 'flex',
    flexDirection: 'column',
  },
  authorName: {
    fontWeight: '600',
    fontSize: '16px',
    marginBottom: '4px',
  },
  songInfo: {
    display: 'flex',
    alignItems: 'center',
    fontSize: '12px',
    color: 'rgba(255, 255, 255, 0.8)',
  },
  songName: {
    marginLeft: '5px',
  },
  postActions: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    marginLeft: '15px',
  },
  actionButton: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    margin: '10px 0',
    cursor: 'pointer',
  },
  icon: {
    marginBottom: '5px',
    transition: 'all 0.2s ease',
  },
  liked: {
    color: '#ff0050',
  },
  disliked: {
    color: '#5c5c5c',
  },
  count: {
    fontSize: '12px',
    color: 'rgba(255, 255, 255, 0.8)',
  },
  loading: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    height: '100vh',
    color: '#fff',
    fontSize: '18px',
    backgroundColor: '#000',
  },
};

export default Home;
