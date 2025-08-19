import React, { useState, useEffect, useRef, useCallback } from 'react';
import io from 'socket.io-client';
import $ from 'jquery';
import './Chat.css';

// Cache persistant pour éviter les rechargements
const ChatCache = {
  messages: [],
  users: [],
  onlineUsers: new Set(),
  currentUser: null,
  isInitialized: false
};

const Chat = () => {
  const [socket, setSocket] = useState(null);
  const [messages, setMessages] = useState(ChatCache.messages);
  const [newMessage, setNewMessage] = useState('');
  const [users, setUsers] = useState(ChatCache.users);
  const [onlineUsers, setOnlineUsers] = useState(ChatCache.onlineUsers);
  const [typingUsers, setTypingUsers] = useState(new Set());
  const [isConnected, setIsConnected] = useState(false);
  const [currentUser, setCurrentUser] = useState(ChatCache.currentUser);
  const [loading, setLoading] = useState(!ChatCache.isInitialized);
  const [showMediaUpload, setShowMediaUpload] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const [editingMessage, setEditingMessage] = useState(null);
  const [editText, setEditText] = useState('');
  const [showContextMenu, setShowContextMenu] = useState(null);
  const [recordingAudio, setRecordingAudio] = useState(false);
  const [mediaRecorder, setMediaRecorder] = useState(null);
  
  const messagesEndRef = useRef(null);
  const typingTimeoutRef = useRef(null);
  const messageInputRef = useRef(null);
  const fileInputRef = useRef(null);
  const chatContainerRef = useRef(null);
  const contextMenuRef = useRef(null);
  const audioChunksRef = useRef([]);

  // Set pour éviter les doublons
  const messageIdsRef = useRef(new Set());

  // Scroll automatique avec jQuery
  const scrollToBottom = useCallback(() => {
    if (messagesEndRef.current) {
      $(messagesEndRef.current).animate({
        scrollTop: messagesEndRef.current.scrollHeight
      }, 300);
    }
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  // Fermer le menu contextuel en cliquant ailleurs
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (contextMenuRef.current && !contextMenuRef.current.contains(event.target)) {
        setShowContextMenu(null);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Persistance avec jQuery - sauvegarde des données
  const saveToCache = useCallback(() => {
    ChatCache.messages = messages;
    ChatCache.users = users;
    ChatCache.onlineUsers = onlineUsers;
    ChatCache.currentUser = currentUser;
    ChatCache.isInitialized = true;
  }, [messages, users, onlineUsers, currentUser]);

  useEffect(() => {
    saveToCache();
  }, [saveToCache]);

  // Fonction pour éviter les doublons de messages
  const addMessageIfNew = useCallback((message) => {
    if (!messageIdsRef.current.has(message._id)) {
      messageIdsRef.current.add(message._id);
      setMessages(prev => {
        const updated = [...prev, message];
        ChatCache.messages = updated;
        return updated;
      });
    }
  }, []);

  // Initialisation avec jQuery persistant
  useEffect(() => {
    const initializeChat = async () => {
      try {
        const token = localStorage.getItem('token');
        if (!token) {
          console.error('Token non trouvé');
          return;
        }

        // Si déjà initialisé, utiliser le cache
        if (ChatCache.isInitialized && !loading) {
          initializeSocket(token);
          return;
        }

        // Utiliser jQuery pour les requêtes AJAX
        const profileData = await $.ajax({
          url: 'http://localhost:5000/api/user/profile',
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });

        setCurrentUser(profileData);
        ChatCache.currentUser = profileData;

        const usersData = await $.ajax({
          url: 'http://localhost:5000/api/users/chat',
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });

        setUsers(usersData);
        ChatCache.users = usersData;

        const onlineUserIds = new Set(usersData.filter(user => user.isOnline).map(user => user._id));
        setOnlineUsers(onlineUserIds);
        ChatCache.onlineUsers = onlineUserIds;

        const messagesData = await $.ajax({
          url: 'http://localhost:5000/api/chat/messages',
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });

        // Initialiser les IDs des messages pour éviter les doublons
        messageIdsRef.current = new Set(messagesData.map(msg => msg._id));
        setMessages(messagesData);
        ChatCache.messages = messagesData;
        ChatCache.isInitialized = true;

        initializeSocket(token);
        setLoading(false);

      } catch (error) {
        console.error('Erreur lors de l\'initialisation du chat:', error);
        setLoading(false);
      }
    };

    const initializeSocket = (token) => {
      const newSocket = io('http://localhost:5000');
      
      newSocket.on('connect', () => {
        console.log('Connecté au serveur Socket.io');
        setIsConnected(true);
        newSocket.emit('authenticate', token);
      });

      newSocket.on('disconnect', () => {
        console.log('Déconnecté du serveur Socket.io');
        setIsConnected(false);
      });

      newSocket.on('new-group-message', (message) => {
        addMessageIfNew(message);
      });

      newSocket.on('message-updated', (updatedMessage) => {
        setMessages(prev => {
          const updated = prev.map(msg => 
            msg._id === updatedMessage._id ? updatedMessage : msg
          );
          ChatCache.messages = updated;
          return updated;
        });
      });

      newSocket.on('message-deleted', (messageId) => {
        setMessages(prev => {
          const updated = prev.filter(msg => msg._id !== messageId);
          ChatCache.messages = updated;
          messageIdsRef.current.delete(messageId);
          return updated;
        });
      });

      newSocket.on('user-online', (userData) => {
        setOnlineUsers(prev => {
          const updated = new Set([...prev, userData.userId]);
          ChatCache.onlineUsers = updated;
          return updated;
        });
      });

      newSocket.on('user-offline', (userData) => {
        setOnlineUsers(prev => {
          const newSet = new Set(prev);
          newSet.delete(userData.userId);
          ChatCache.onlineUsers = newSet;
          return newSet;
        });
      });

      newSocket.on('user-typing', (data) => {
        if (data.isTyping) {
          setTypingUsers(prev => new Set([...prev, `${data.firstName} ${data.lastName}`]));
        } else {
          setTypingUsers(prev => {
            const newSet = new Set(prev);
            newSet.delete(`${data.firstName} ${data.lastName}`);
            return newSet;
          });
        }
      });

      setSocket(newSocket);
    };

    initializeChat();

    return () => {
      if (socket) {
        socket.disconnect();
      }
    };
  }, [addMessageIfNew]);

  // Enregistrement audio
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      
      audioChunksRef.current = [];
      
      recorder.ondataavailable = (event) => {
        audioChunksRef.current.push(event.data);
      };
      
      recorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        const audioFile = new File([audioBlob], 'audio.webm', { type: 'audio/webm' });
        const audioUrl = await handleFileUpload(audioFile);
        if (audioUrl) {
          await sendMessage(null, audioUrl);
        }
        stream.getTracks().forEach(track => track.stop());
      };
      
      recorder.start();
      setMediaRecorder(recorder);
      setRecordingAudio(true);
    } catch (error) {
      console.error('Erreur enregistrement audio:', error);
    }
  };

  const stopRecording = () => {
    if (mediaRecorder && recordingAudio) {
      mediaRecorder.stop();
      setRecordingAudio(false);
      setMediaRecorder(null);
    }
  };

  // Upload de média avec jQuery et progress bar
  const handleFileUpload = async (file) => {
    if (!file) return null;

    const token = localStorage.getItem('token');
    const formData = new FormData();
    formData.append('image', file);

    setIsUploading(true);
    setUploadProgress(0);

    try {
      const response = await $.ajax({
        url: 'http://localhost:5000/api/upload-media',
        method: 'POST',
        data: formData,
        processData: false,
        contentType: false,
        headers: {
          'Authorization': `Bearer ${token}`
        },
        xhr: function() {
          const xhr = new window.XMLHttpRequest();
          xhr.upload.addEventListener('progress', function(e) {
            if (e.lengthComputable) {
              const percentComplete = (e.loaded / e.total) * 100;
              setUploadProgress(percentComplete);
            }
          }, false);
          return xhr;
        }
      });

      setIsUploading(false);
      setUploadProgress(0);
      return response.url;
    } catch (error) {
      console.error('Erreur upload:', error);
      setIsUploading(false);
      setUploadProgress(0);
      return null;
    }
  };

  // Envoyer un message avec média
  const sendMessage = async (e, mediaUrl = null) => {
    e?.preventDefault();
    
    if ((!newMessage.trim() && !mediaUrl) || !socket || !isConnected) return;

    let content = newMessage.trim();
    if (mediaUrl) {
      const isVideo = mediaUrl.includes('.mp4') || mediaUrl.includes('.webm') || mediaUrl.includes('.mov');
      const isAudio = mediaUrl.includes('.webm') && !isVideo;
      
      if (isAudio) {
        content = `[AUDIO]${mediaUrl}`;
      } else if (isVideo) {
        content = `[VIDEO]${mediaUrl}`;
      } else {
        content = `[IMAGE]${mediaUrl}`;
      }
      
      if (newMessage.trim()) {
        content += `\n${newMessage.trim()}`;
      }
    }

    socket.emit('send-group-message', { content });
    setNewMessage('');
    setShowMediaUpload(false);
    messageInputRef.current?.focus();
  };

  // Modifier un message
  const editMessage = (messageId) => {
    if (!socket || !isConnected) return;
    
    socket.emit('edit-message', {
      messageId,
      newContent: editText
    });
    
    setEditingMessage(null);
    setEditText('');
    setShowContextMenu(null);
  };

  // Supprimer un message
  const deleteMessage = (messageId) => {
    if (!socket || !isConnected) return;
    
    socket.emit('delete-message', { messageId });
    setShowContextMenu(null);
  };

  // Télécharger un média
  const downloadMedia = (mediaUrl, fileName) => {
    const link = document.createElement('a');
    link.href = `http://localhost:5000${mediaUrl}`;
    link.download = fileName || 'media';
    link.target = '_blank';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Gestion des fichiers
  const handleFileSelect = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const maxSize = 50 * 1024 * 1024; // 50MB
    if (file.size > maxSize) {
      alert('Le fichier est trop volumineux (max 50MB)');
      return;
    }

    const allowedTypes = [
      'image/jpeg', 'image/jpg', 'image/png', 'image/gif',
      'video/mp4', 'video/webm', 'video/mov',
      'audio/mp3', 'audio/wav', 'audio/webm', 'audio/ogg'
    ];
    
    if (!allowedTypes.includes(file.type)) {
      alert('Type de fichier non supporté');
      return;
    }

    const mediaUrl = await handleFileUpload(file);
    if (mediaUrl) {
      await sendMessage(null, mediaUrl);
    }
  };

  // Gestion de l'indicateur de frappe
  const handleTyping = () => {
    if (!socket || !isConnected) return;

    socket.emit('typing', { isTyping: true });

    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    typingTimeoutRef.current = setTimeout(() => {
      socket.emit('typing', { isTyping: false });
    }, 2000);
  };

  // Rendu des médias dans les messages
  const renderMessageContent = (message) => {
    const content = message.content;
    const isOwn = message.sender._id === currentUser?._id;
    
    if (content.startsWith('[IMAGE]')) {
      const parts = content.split('\n');
      const imageUrl = parts[0].replace('[IMAGE]', '');
      const text = parts.slice(1).join('\n');
      
      return (
        <div className="message-media">
          <div className="media-container">
            <img 
              src={`http://localhost:5000${imageUrl}`} 
              alt="Image partagée"
              className="message-image"
            />
            <div className="media-controls">
              <button 
                onClick={() => downloadMedia(imageUrl, 'image.jpg')}
                className="media-control-btn download"
                title="Télécharger"
              >
                ⬇
              </button>
              {isOwn && (
                <>
                  <button 
                    onClick={() => setShowContextMenu(message._id)}
                    className="media-control-btn menu"
                    title="Plus d'options"
                  >
                    ⋯
                  </button>
                </>
              )}
            </div>
          </div>
          {text && <div className="message-text">{text}</div>}
        </div>
      );
    }
    
    if (content.startsWith('[VIDEO]')) {
      const parts = content.split('\n');
      const videoUrl = parts[0].replace('[VIDEO]', '');
      const text = parts.slice(1).join('\n');
      
      return (
        <div className="message-media">
          <div className="media-container">
            <video 
              src={`http://localhost:5000${videoUrl}`} 
              className="message-video"
              controls
              preload="metadata"
            />
            <div className="media-controls">
              <button 
                onClick={() => downloadMedia(videoUrl, 'video.mp4')}
                className="media-control-btn download"
                title="Télécharger"
              >
                ⬇
              </button>
              {isOwn && (
                <button 
                  onClick={() => setShowContextMenu(message._id)}
                  className="media-control-btn menu"
                  title="Plus d'options"
                >
                  ⋯
                </button>
              )}
            </div>
          </div>
          {text && <div className="message-text">{text}</div>}
        </div>
      );
    }
    
    if (content.startsWith('[AUDIO]')) {
      const parts = content.split('\n');
      const audioUrl = parts[0].replace('[AUDIO]', '');
      const text = parts.slice(1).join('\n');
      
      return (
        <div className="message-media">
          <div className="media-container audio-container">
            <audio 
              src={`http://localhost:5000${audioUrl}`} 
              className="message-audio"
              controls
            />
            <div className="media-controls">
              <button 
                onClick={() => downloadMedia(audioUrl, 'audio.webm')}
                className="media-control-btn download"
                title="Télécharger"
              >
                ⬇
              </button>
              {isOwn && (
                <button 
                  onClick={() => setShowContextMenu(message._id)}
                  className="media-control-btn menu"
                  title="Plus d'options"
                >
                  ⋯
                </button>
              )}
            </div>
          </div>
          {text && <div className="message-text">{text}</div>}
        </div>
      );
    }
    
    return (
      <div 
        className="message-text-container"
        onContextMenu={(e) => {
          if (isOwn) {
            e.preventDefault();
            setShowContextMenu(message._id);
          }
        }}
      >
        <div className="message-text">{content}</div>
        {isOwn && (
          <button 
            onClick={() => setShowContextMenu(message._id)}
            className="text-menu-btn"
            title="Options"
          >
            ⋯
          </button>
        )}
      </div>
    );
  };

  // Menu contextuel
  const renderContextMenu = (messageId) => {
    const message = messages.find(msg => msg._id === messageId);
    if (!message || message.sender._id !== currentUser?._id) return null;

    return (
      <div className="context-menu" ref={contextMenuRef}>
        <button 
          onClick={() => {
            setEditingMessage(messageId);
            setEditText(message.content);
            setShowContextMenu(null);
          }}
          className="context-menu-item"
        >
          ✏ Modifier
        </button>
        <button 
          onClick={() => deleteMessage(messageId)}
          className="context-menu-item delete"
        >
          🗑 Supprimer
        </button>
      </div>
    );
  };

  // Formater l'heure
  const formatTime = (timestamp) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('fr-FR', { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  };

  // Formater la date
  const formatDate = (timestamp) => {
    const date = new Date(timestamp);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (date.toDateString() === today.toDateString()) {
      return "Aujourd'hui";
    } else if (date.toDateString() === yesterday.toDateString()) {
      return "Hier";
    } else {
      return date.toLocaleDateString('fr-FR', { 
        day: '2-digit', 
        month: '2-digit', 
        year: 'numeric' 
      });
    }
  };

  // Grouper les messages par date
  const groupMessagesByDate = (messages) => {
    const groups = {};
    messages.forEach(message => {
      const date = new Date(message.timestamp).toDateString();
      if (!groups[date]) {
        groups[date] = [];
      }
      groups[date].push(message);
    });
    return groups;
  };

  if (loading) {
    return (
      <div className="chat-fullscreen">
        <div className="chat-loading">
          <div className="spinner"></div>
          <p>Chargement du chat...</p>
        </div>
      </div>
    );
  }

  const messageGroups = groupMessagesByDate(messages);

  return (
    <div className="chat-fullscreen" ref={chatContainerRef}>
      {/* En-tête du chat */}
      <div className="chat-header">
        <div className="chat-title">
          <h2>💬 Chat Groupe</h2>
          <div className="connection-status">
            <span className={`status-indicator ${isConnected ? 'connected' : 'disconnected'}`}></span>
            {isConnected ? 'Connecté' : 'Déconnecté'}
          </div>
        </div>
        <div className="online-users-count">
          👥 {onlineUsers.size} en ligne
        </div>
      </div>

      {/* Liste des utilisateurs en ligne */}
      <div className="online-users-bar">
        <div className="online-users-list">
          {users.filter(user => onlineUsers.has(user._id)).map(user => (
            <div key={user._id} className="online-user">
              <div className="user-avatar">
                {user.profilePhoto ? (
                  <img 
                    src={`http://localhost:5000/${user.profilePhoto}`} 
                    alt={`${user.firstName} ${user.lastName}`}
                  />
                ) : (
                  <div className="avatar-placeholder">
                    {user.firstName?.[0]}{user.lastName?.[0]}
                  </div>
                )}
                <div className="online-indicator"></div>
              </div>
              <span className="user-name">
                {user.firstName} {user.lastName}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Zone des messages */}
      <div className="chat-messages" ref={messagesEndRef}>
        {Object.entries(messageGroups).map(([date, dateMessages]) => (
          <div key={date}>
            <div className="date-separator">
              <span>{formatDate(dateMessages[0].timestamp)}</span>
            </div>
            {dateMessages.map((message) => (
              <div 
                key={message._id} 
                className={`message ${message.sender._id === currentUser?._id ? 'own-message' : 'other-message'}`}
              >
                <div className="message-avatar">
                  {message.sender.profilePhoto ? (
                    <img 
                      src={`http://localhost:5000/${message.sender.profilePhoto}`} 
                      alt={`${message.sender.firstName} ${message.sender.lastName}`}
                    />
                  ) : (
                    <div className="avatar-placeholder">
                      {message.sender.firstName?.[0]}{message.sender.lastName?.[0]}
                    </div>
                  )}
                </div>
                <div className="message-content">
                  <div className="message-header">
                    <span className="sender-name">
                      {message.sender.firstName} {message.sender.lastName}
                    </span>
                    <span className="message-time">
                      {formatTime(message.timestamp)}
                    </span>
                  </div>
                  
                  {editingMessage === message._id ? (
                    <div className="edit-message-form">
                      <input
                        type="text"
                        value={editText}
                        onChange={(e) => setEditText(e.target.value)}
                        className="edit-input"
                        onKeyPress={(e) => {
                          if (e.key === 'Enter') {
                            editMessage(message._id);
                          }
                        }}
                      />
                      <div className="edit-buttons">
                        <button 
                          onClick={() => editMessage(message._id)}
                          className="edit-save"
                        >
                          ✓
                        </button>
                        <button 
                          onClick={() => {
                            setEditingMessage(null);
                            setEditText('');
                          }}
                          className="edit-cancel"
                        >
                          ✗
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="message-body">
                      {renderMessageContent(message)}
                      {showContextMenu === message._id && renderContextMenu(message._id)}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        ))}
        
        {/* Indicateur de frappe */}
        {typingUsers.size > 0 && (
          <div className="typing-indicator">
            <div className="typing-dots">
              <span></span>
              <span></span>
              <span></span>
            </div>
            <span className="typing-text">
              {Array.from(typingUsers).join(', ')} {typingUsers.size === 1 ? 'écrit' : 'écrivent'}...
            </span>
          </div>
        )}
      </div>

      {/* Progress bar d'upload */}
      {isUploading && (
        <div className="upload-progress">
          <div className="progress-bar">
            <div 
              className="progress-fill" 
              style={{ width: `${uploadProgress}%` }}
            ></div>
          </div>
          <span className="progress-text">Upload en cours... {Math.round(uploadProgress)}%</span>
        </div>
      )}

      {/* Menu d'upload de médias */}
      {showMediaUpload && (
        <div className="media-upload-menu">
          <button 
            onClick={() => fileInputRef.current?.click()}
            className="media-option"
          >
            📷 Photo/Vidéo
          </button>
          <button 
            onClick={recordingAudio ? stopRecording : startRecording}
            className={`media-option ${recordingAudio ? 'recording' : ''}`}
          >
            {recordingAudio ? '⏹ Arrêter' : '🎤 Audio'}
          </button>
          <button 
            onClick={() => setShowMediaUpload(false)}
            className="media-cancel"
          >
            ❌ Annuler
          </button>
        </div>
      )}

      {/* Input file caché */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*,video/*,audio/*"
        onChange={handleFileSelect}
        style={{ display: 'none' }}
      />

      {/* Formulaire d'envoi de message */}
      <form onSubmit={sendMessage} className="chat-input-form">
        <div className="input-container">
          <button
            type="button"
            onClick={() => setShowMediaUpload(!showMediaUpload)}
            className="media-button"
            disabled={!isConnected || isUploading}
          >
            📎
          </button>
          <input
            ref={messageInputRef}
            type="text"
            value={newMessage}
            onChange={(e) => {
              setNewMessage(e.target.value);
              handleTyping();
            }}
            placeholder="Tapez votre message..."
            disabled={!isConnected || isUploading}
            maxLength={1000}
          />
          <button 
            type="submit" 
            disabled={!newMessage.trim() || !isConnected || isUploading}
            className="send-button"
          >
            📤
          </button>
        </div>
      </form>
    </div>
  );
};

export default Chat;

