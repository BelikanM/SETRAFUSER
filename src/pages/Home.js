import React, { useState, useEffect, useRef } from 'react';
import io from 'socket.io-client';
import axios from 'axios';
import { FiMessageSquare, FiShare } from 'react-icons/fi';
import { FaHeart, FaRegHeart, FaMusic } from 'react-icons/fa';
import { BiDislike } from 'react-icons/bi';

const Home = () => {
  const [mediaMessages, setMediaMessages] = useState([]);
  const [currentUser, setCurrentUser] = useState(null);
  const [socket, setSocket] = useState(null);
  const [loading, setLoading] = useState(true);
  const [currentVideo, setCurrentVideo] = useState(null);
  const videoRefs = useRef([]);

  // Charger l’utilisateur et initialiser socket
  useEffect(() => {
    const initialize = async () => {
      const token = localStorage.getItem('token');
      if (!token) {
        setLoading(false);
        return;
      }
      try {
        const profileData = await axios.get('http://localhost:5000/api/user/profile', {
          headers: { Authorization: `Bearer ${token}` },
        });
        setCurrentUser(profileData.data);

        const response = await axios.get('http://localhost:5000/api/chat/media-messages', {
          headers: { Authorization: `Bearer ${token}` },
        });
        setMediaMessages(response.data);

        const newSocket = io('http://localhost:5000');
        newSocket.on('connect', () => newSocket.emit('authenticate', token));
        setSocket(newSocket);

        setLoading(false);
      } catch (err) {
        console.error(err);
        setLoading(false);
      }
    };
    initialize();
  }, []);

  // Gestion socket temps réel
  useEffect(() => {
    if (!socket) return;

    socket.on('new-group-message', (msg) => {
      if (msg.content.startsWith('[IMAGE]') || msg.content.startsWith('[VIDEO]')) {
        setMediaMessages((prev) => [msg, ...prev]);
      }
    });

    socket.on('message-liked', (updatedMsg) => {
      setMediaMessages((prev) => prev.map((m) => (m._id === updatedMsg._id ? updatedMsg : m)));
    });

    socket.on('message-disliked', (updatedMsg) => {
      setMediaMessages((prev) => prev.map((m) => (m._id === updatedMsg._id ? updatedMsg : m)));
    });

    socket.on('message-deleted', (id) => {
      setMediaMessages((prev) => prev.filter((m) => m._id !== id));
    });
  }, [socket]);

  // Like / Dislike
  const handleLike = (id) => socket?.emit('like-message', { messageId: id });
  const handleDislike = (id) => socket?.emit('dislike-message', { messageId: id });

  // Lecture vidéo auto
  const handleVideoPlay = (index) => {
    if (currentVideo !== null && videoRefs.current[currentVideo]) {
      videoRefs.current[currentVideo].pause();
    }
    setCurrentVideo(index);
  };

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

          return (
            <div key={msg._id} style={styles.post}>
              <div style={styles.postContent}>
                {type === 'image' ? (
                  <img src={`http://localhost:5000${mediaUrl}`} alt="media" style={styles.media} />
                ) : (
                  <video
                    ref={(el) => (videoRefs.current[index] = el)}
                    style={styles.media}
                    src={`http://localhost:5000${mediaUrl}`}
                    controls
                    muted
                    loop
                    playsInline
                    onPlay={() => handleVideoPlay(index)}
                  />
                )}
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
  },
  media: {
    width: '100%',
    height: 'auto',
    maxHeight: '85vh',
    objectFit: 'cover',
    borderRadius: '10px',
    backgroundColor: '#000',
    aspectRatio: '9/16',
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
