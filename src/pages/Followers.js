import React, { useState, useEffect, useRef } from 'react';
import io from 'socket.io-client';
import './Chat.css';

const Chat = () => {
  const [socket, setSocket] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [users, setUsers] = useState([]);
  const [onlineUsers, setOnlineUsers] = useState(new Set());
  const [typingUsers, setTypingUsers] = useState(new Set());
  const [isConnected, setIsConnected] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const [loading, setLoading] = useState(true);
  
  const messagesEndRef = useRef(null);
  const typingTimeoutRef = useRef(null);
  const messageInputRef = useRef(null);

  // Scroll automatique vers le bas
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Initialisation
  useEffect(() => {
    initializeChat();
    return () => {
      if (socket) {
        socket.disconnect();
      }
    };
  }, []);

  const initializeChat = async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        console.error('Token non trouvé');
        return;
      }

      // Récupérer le profil utilisateur
      const profileResponse = await fetch('http://localhost:5000/api/user/profile', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (profileResponse.ok) {
        const userData = await profileResponse.json();
        setCurrentUser(userData);
      }

      // Récupérer les utilisateurs
      const usersResponse = await fetch('http://localhost:5000/api/users/chat', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (usersResponse.ok) {
        const usersData = await usersResponse.json();
        setUsers(usersData);
        // Marquer les utilisateurs en ligne
        const onlineUserIds = new Set(usersData.filter(user => user.isOnline).map(user => user._id));
        setOnlineUsers(onlineUserIds);
      }

      // Récupérer les messages existants
      const messagesResponse = await fetch('http://localhost:5000/api/chat/messages', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (messagesResponse.ok) {
        const messagesData = await messagesResponse.json();
        setMessages(messagesData);
      }

      // Initialiser Socket.io
      const newSocket = io('http://localhost:5000');
      
      newSocket.on('connect', () => {
        console.log('Connecté au serveur Socket.io');
        setIsConnected(true);
        // Authentifier l'utilisateur
        newSocket.emit('authenticate', token);
      });

      newSocket.on('disconnect', () => {
        console.log('Déconnecté du serveur Socket.io');
        setIsConnected(false);
      });

      // Écouter les nouveaux messages
      newSocket.on('new-group-message', (message) => {
        setMessages(prev => [...prev, message]);
      });

      // Gestion des utilisateurs en ligne/hors ligne
      newSocket.on('user-online', (userData) => {
        setOnlineUsers(prev => new Set([...prev, userData.userId]));
      });

      newSocket.on('user-offline', (userData) => {
        setOnlineUsers(prev => {
          const newSet = new Set(prev);
          newSet.delete(userData.userId);
          return newSet;
        });
      });

      // Gestion de l'indicateur de frappe
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
      setLoading(false);

    } catch (error) {
      console.error('Erreur lors de l\'initialisation du chat:', error);
      setLoading(false);
    }
  };

  // Envoyer un message
  const sendMessage = (e) => {
    e.preventDefault();
    
    if (!newMessage.trim() || !socket || !isConnected) return;

    socket.emit('send-group-message', {
      content: newMessage.trim()
    });

    setNewMessage('');
    messageInputRef.current?.focus();
  };

  // Gestion de l'indicateur de frappe
  const handleTyping = () => {
    if (!socket || !isConnected) return;

    socket.emit('typing', { isTyping: true });

    // Arrêter l'indicateur de frappe après 2 secondes d'inactivité
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    typingTimeoutRef.current = setTimeout(() => {
      socket.emit('typing', { isTyping: false });
    }, 2000);
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
      <div className="chat-container">
        <div className="chat-loading">
          <div className="spinner"></div>
          <p>Chargement du chat...</p>
        </div>
      </div>
    );
  }

  const messageGroups = groupMessagesByDate(messages);

  return (
    <div className="chat-container">
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
      <div className="chat-messages">
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
                  <div className="message-text">
                    {message.content}
                  </div>
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
        
        <div ref={messagesEndRef} />
      </div>

      {/* Formulaire d'envoi de message */}
      <form onSubmit={sendMessage} className="chat-input-form">
        <div className="input-container">
          <input
            ref={messageInputRef}
            type="text"
            value={newMessage}
            onChange={(e) => {
              setNewMessage(e.target.value);
              handleTyping();
            }}
            placeholder="Tapez votre message..."
            disabled={!isConnected}
            maxLength={1000}
          />
          <button 
            type="submit" 
            disabled={!newMessage.trim() || !isConnected}
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

