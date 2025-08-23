import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import { io } from 'socket.io-client';
import { UserContext } from './UserContext';

// Configuration Socket.io optimisée
const SOCKET_URL = process.env.REACT_APP_SOCKET_URL || 'http://localhost:5000';

const SOCKET_OPTIONS = {
  transports: ['websocket', 'polling'],
  upgrade: true,
  rememberUpgrade: true,
  timeout: 20000,
  forceNew: false,
  reconnection: true,
  reconnectionDelay: 1000,
  reconnectionDelayMax: 5000,
  maxReconnectionAttempts: 5,
  randomizationFactor: 0.5,
  autoConnect: false,
  withCredentials: true
};

// Création du contexte
export const SocketContext = createContext({
  socket: null,
  isConnected: false,
  connectionStatus: 'disconnected',
  onlineUsers: new Set(),
  lastActivity: null,
  connect: () => {},
  disconnect: () => {},
  emit: () => {},
  on: () => {},
  off: () => {},
  reconnect: () => {}
});

// Provider principal
export const SocketProvider = ({ children }) => {
  const { user, token } = useContext(UserContext);
  
  // États du socket
  const [socket, setSocket] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState('disconnected');
  const [onlineUsers, setOnlineUsers] = useState(new Set());
  const [lastActivity, setLastActivity] = useState(null);
  
  // Refs pour éviter les re-renders
  const socketRef = useRef(null);
  const reconnectTimeoutRef = useRef(null);
  const heartbeatIntervalRef = useRef(null);
  const connectionAttemptsRef = useRef(0);
  const isConnectingRef = useRef(false);
  const isUnmountedRef = useRef(false);

  // Fonction de connexion optimisée
  const connect = useCallback(() => {
    if (!user || !token || isConnectingRef.current || socketRef.current?.connected || isUnmountedRef.current) {
      return;
    }

    console.log('🔌 Initialisation connexion Socket.io...', { userId: user._id });
    isConnectingRef.current = true;
    setConnectionStatus('connecting');

    try {
      // Création de la nouvelle instance socket
      const newSocket = io(SOCKET_URL, {
        ...SOCKET_OPTIONS,
        auth: {
          token,
          userId: user._id,
          userRole: user.role,
          userName: `${user.firstName} ${user.lastName}`,
          userEmail: user.email
        },
        query: {
          userId: user._id,
          role: user.role
        }
      });

      // Événements de connexion avec protection contre les fuites mémoire
      newSocket.on('connect', () => {
        if (isUnmountedRef.current) return;
        
        console.log('✅ Socket connecté:', newSocket.id);
        setIsConnected(true);
        setConnectionStatus('connected');
        setLastActivity(new Date());
        connectionAttemptsRef.current = 0;
        isConnectingRef.current = false;

        // Rejoindre les salles appropriées
        newSocket.emit('join-user-room', { 
          userId: user._id, 
          role: user.role,
          userInfo: {
            firstName: user.firstName,
            lastName: user.lastName,
            email: user.email
          }
        });

        // Démarrer le heartbeat
        startHeartbeat(newSocket);
      });

      newSocket.on('disconnect', (reason) => {
        if (isUnmountedRef.current) return;
        
        console.log('🔌 Socket déconnecté:', reason);
        setIsConnected(false);
        setConnectionStatus('disconnected');
        isConnectingRef.current = false;
        stopHeartbeat();

        // Reconnexion automatique selon la raison
        if (reason === 'io server disconnect') {
          console.log('❌ Connexion fermée par le serveur');
        } else if (reason === 'transport close' || reason === 'transport error') {
          scheduleReconnect();
        }
      });

      newSocket.on('connect_error', (error) => {
        if (isUnmountedRef.current) return;
        
        console.error('❌ Erreur connexion Socket:', error);
        setConnectionStatus('error');
        isConnectingRef.current = false;
        connectionAttemptsRef.current++;

        if (connectionAttemptsRef.current < SOCKET_OPTIONS.maxReconnectionAttempts) {
          scheduleReconnect();
        } else {
          console.error('❌ Nombre maximum de tentatives de reconnexion atteint');
          setConnectionStatus('failed');
        }
      });

      // Événements utilisateurs en ligne avec protection
      newSocket.on('users-online-update', (users) => {
        if (isUnmountedRef.current) return;
        
        console.log('👥 Mise à jour utilisateurs en ligne:', users.length);
        setOnlineUsers(new Set(users.map(u => u.userId || u._id)));
      });

      newSocket.on('user-connected', (userData) => {
        if (isUnmountedRef.current) return;
        
        console.log('👤 Utilisateur connecté:', userData);
        setOnlineUsers(prev => new Set([...prev, userData.userId]));
      });

      newSocket.on('user-disconnected', (userData) => {
        if (isUnmountedRef.current) return;
        
        console.log('👤 Utilisateur déconnecté:', userData);
        setOnlineUsers(prev => {
          const newSet = new Set(prev);
          newSet.delete(userData.userId);
          return newSet;
        });
      });

      // Événements GPS et localisation avec protection
      newSocket.on('location-update', (locationData) => {
        if (isUnmountedRef.current) return;
        
        console.log('📍 Mise à jour position:', locationData);
        setLastActivity(new Date());
      });

      // Événements labels de carte avec protection
      newSocket.on('new-map-label', (labelData) => {
        if (isUnmountedRef.current) return;
        
        console.log('🏷️ Nouveau label ajouté:', labelData);
      });

      newSocket.on('update-map-label', (labelData) => {
        if (isUnmountedRef.current) return;
        
        console.log('🏷️ Label mis à jour:', labelData);
      });

      newSocket.on('delete-map-label', (data) => {
        if (isUnmountedRef.current) return;
        
        console.log('🏷️ Label supprimé:', data);
      });

      // Événements de notification avec protection
      newSocket.on('notification', (notificationData) => {
        if (isUnmountedRef.current) return;
        
        console.log('🔔 Notification reçue:', notificationData);
      });

      // Événements d'erreur avec protection
      newSocket.on('error', (error) => {
        if (isUnmountedRef.current) return;
        
        console.error('❌ Erreur Socket:', error);
      });

      // Événement heartbeat avec protection
      newSocket.on('pong', () => {
        if (isUnmountedRef.current) return;
        
        setLastActivity(new Date());
      });

      // Sauvegarder la référence
      socketRef.current = newSocket;
      setSocket(newSocket);

      // Connexion manuelle si autoConnect est false
      newSocket.connect();

    } catch (error) {
      console.error('❌ Erreur lors de la création du socket:', error);
      setConnectionStatus('error');
      isConnectingRef.current = false;
    }
  }, [user, token]);

  // Fonction de déconnexion optimisée
  const disconnect = useCallback(() => {
    console.log('🔌 Déconnexion Socket...');
    
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }

    stopHeartbeat();

    if (socketRef.current) {
      socketRef.current.removeAllListeners();
      socketRef.current.disconnect();
      socketRef.current = null;
    }

    setSocket(null);
    setIsConnected(false);
    setConnectionStatus('disconnected');
    setOnlineUsers(new Set());
    isConnectingRef.current = false;
    connectionAttemptsRef.current = 0;
  }, []);

  // Fonction de reconnexion optimisée
  const reconnect = useCallback(() => {
    console.log('🔄 Reconnexion Socket...');
    disconnect();
    setTimeout(() => {
      if (!isUnmountedRef.current) {
        connect();
      }
    }, 1000);
  }, [disconnect, connect]);

  // Planifier une reconnexion avec protection
  const scheduleReconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
    }

    const delay = Math.min(
      SOCKET_OPTIONS.reconnectionDelay * Math.pow(2, connectionAttemptsRef.current),
      SOCKET_OPTIONS.reconnectionDelayMax
    );

    console.log(`🔄 Reconnexion programmée dans ${delay}ms...`);
    setConnectionStatus('reconnecting');

    reconnectTimeoutRef.current = setTimeout(() => {
      if (!isUnmountedRef.current && connectionAttemptsRef.current < SOCKET_OPTIONS.maxReconnectionAttempts) {
        connect();
      }
    }, delay);
  }, [connect]);

  // Heartbeat pour maintenir la connexion avec protection
  const startHeartbeat = useCallback((socket) => {
    stopHeartbeat();
    
    heartbeatIntervalRef.current = setInterval(() => {
      if (!isUnmountedRef.current && socket && socket.connected) {
        socket.emit('ping');
      }
    }, 30000);
  }, []);

  const stopHeartbeat = useCallback(() => {
    if (heartbeatIntervalRef.current) {
      clearInterval(heartbeatIntervalRef.current);
      heartbeatIntervalRef.current = null;
    }
  }, []);

  // Fonctions helper pour émettre et écouter avec protection
  const emit = useCallback((event, data) => {
    if (socketRef.current && socketRef.current.connected && !isUnmountedRef.current) {
      socketRef.current.emit(event, data);
      setLastActivity(new Date());
    } else {
      console.warn('⚠️ Tentative d\'émission sur socket déconnecté:', event);
    }
  }, []);

  const on = useCallback((event, callback) => {
    if (socketRef.current && !isUnmountedRef.current) {
      const protectedCallback = (...args) => {
        if (!isUnmountedRef.current) {
          callback(...args);
        }
      };
      socketRef.current.on(event, protectedCallback);
      return () => {
        if (socketRef.current) {
          socketRef.current.off(event, protectedCallback);
        }
      };
    }
  }, []);

  const off = useCallback((event, callback) => {
    if (socketRef.current) {
      if (callback) {
        socketRef.current.off(event, callback);
      } else {
        socketRef.current.off(event);
      }
    }
  }, []);

  // Effet pour gérer la connexion/déconnexion avec protection
  useEffect(() => {
    isUnmountedRef.current = false;
    
    if (user && token) {
      connect();
    } else {
      disconnect();
    }

    return () => {
      isUnmountedRef.current = true;
      disconnect();
    };
  }, [user, token, connect, disconnect]);

  // Cleanup au démontage avec protection complète
  useEffect(() => {
    return () => {
      isUnmountedRef.current = true;
      
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      stopHeartbeat();
      disconnect();
    };
  }, [disconnect, stopHeartbeat]);

  // Gestion de la visibilité de la page avec protection
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (isUnmountedRef.current) return;
      
      if (document.hidden) {
        console.log('📱 Page masquée - maintien connexion Socket');
      } else {
        console.log('📱 Page visible - vérification connexion Socket');
        if (!isConnected && user && token) {
          setTimeout(() => {
            if (!isUnmountedRef.current) {
              connect();
            }
          }, 500);
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [isConnected, user, token, connect]);

  // Gestion des événements réseau avec protection
  useEffect(() => {
    const handleOnline = () => {
      if (isUnmountedRef.current) return;
      
      console.log('🌐 Connexion réseau rétablie');
      if (!isConnected && user && token) {
        setTimeout(() => {
          if (!isUnmountedRef.current) {
            connect();
          }
        }, 1000);
      }
    };

    const handleOffline = () => {
      if (isUnmountedRef.current) return;
      
      console.log('🌐 Connexion réseau perdue');
      setConnectionStatus('offline');
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [isConnected, user, token, connect]);

  // Valeur du contexte
  const contextValue = {
    socket: socketRef.current,
    isConnected,
    connectionStatus,
    onlineUsers,
    lastActivity,
    connect,
    disconnect,
    reconnect,
    emit,
    on,
    off
  };

  return (
    <SocketContext.Provider value={contextValue}>
      {children}
    </SocketContext.Provider>
  );
};

// Hook personnalisé pour utiliser le contexte
export const useSocket = () => {
  const context = useContext(SocketContext);
  
  if (!context) {
    throw new Error('useSocket doit être utilisé dans un SocketProvider');
  }
  
  return context;
};

// Hook pour les événements socket avec cleanup automatique amélioré
export const useSocketEvent = (event, callback, dependencies = []) => {
  const { socket, on, off } = useSocket();
  const callbackRef = useRef(callback);
  const cleanupRef = useRef(null);

  // Mettre à jour la référence du callback
  useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);

  useEffect(() => {
    if (socket && callbackRef.current) {
      const protectedCallback = (...args) => {
        if (callbackRef.current) {
          callbackRef.current(...args);
        }
      };
      
      cleanupRef.current = on(event, protectedCallback);
      
      return () => {
        if (cleanupRef.current) {
          cleanupRef.current();
        }
      };
    }
  }, [socket, event, on, ...dependencies]);

  // Cleanup au démontage
  useEffect(() => {
    return () => {
      if (cleanupRef.current) {
        cleanupRef.current();
      }
    };
  }, []);
};

// Hook pour émettre des événements avec debounce amélioré
export const useSocketEmit = (delay = 300) => {
  const { emit, isConnected } = useSocket();
  const timeoutRef = useRef(null);
  const queueRef = useRef([]);

  const debouncedEmit = useCallback((event, data) => {
    if (!isConnected) {
      console.warn('⚠️ Socket déconnecté, émission ignorée:', event);
      return;
    }

    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    // Ajouter à la queue
    queueRef.current.push({ event, data });

    timeoutRef.current = setTimeout(() => {
      // Traiter la queue
      const queue = [...queueRef.current];
      queueRef.current = [];
      
      queue.forEach(({ event, data }) => {
        emit(event, data);
      });
    }, delay);
  }, [emit, delay, isConnected]);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      queueRef.current = [];
    };
  }, []);

  return debouncedEmit;
};

// Hook pour surveiller le statut de connexion
export const useConnectionStatus = () => {
  const { connectionStatus, isConnected, lastActivity } = useSocket();
  
  return {
    status: connectionStatus,
    isConnected,
    lastActivity,
    isOnline: connectionStatus === 'connected',
    isConnecting: connectionStatus === 'connecting',
    isReconnecting: connectionStatus === 'reconnecting',
    isOffline: connectionStatus === 'offline',
    hasError: connectionStatus === 'error' || connectionStatus === 'failed'
  };
};

// Composant indicateur de statut de connexion optimisé
export const SocketStatusIndicator = ({ style = {} }) => {
  const { status, isConnected } = useConnectionStatus();

  const getStatusInfo = () => {
    switch (status) {
      case 'connected':
        return { color: '#10b981', icon: '🟢', text: 'Connecté' };
      case 'connecting':
        return { color: '#f59e0b', icon: '🟡', text: 'Connexion...' };
      case 'reconnecting':
        return { color: '#f59e0b', icon: '🔄', text: 'Reconnexion...' };
      case 'offline':
        return { color: '#6b7280', icon: '⚫', text: 'Hors ligne' };
      case 'error':
        return { color: '#ef4444', icon: '🔴', text: 'Erreur' };
      case 'failed':
        return { color: '#dc2626', icon: '❌', text: 'Échec' };
      default:
        return { color: '#6b7280', icon: '⚫', text: 'Déconnecté' };
    }
  };

  const statusInfo = getStatusInfo();

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: '6px',
      padding: '4px 8px',
      borderRadius: '12px',
      fontSize: '12px',
      fontWeight: '500',
      color: statusInfo.color,
      backgroundColor: `${statusInfo.color}15`,
      border: `1px solid ${statusInfo.color}30`,
      transition: 'all 0.3s ease',
      ...style
    }}>
      <span>{statusInfo.icon}</span>
      <span>{statusInfo.text}</span>
    </div>
  );
};

export default SocketProvider;

