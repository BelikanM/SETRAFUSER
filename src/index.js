import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';
import 'bootstrap/dist/css/bootstrap.min.css';

// React Query + persistance
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { persistQueryClient } from '@tanstack/react-query-persist-client';
import { createSyncStoragePersister } from '@tanstack/query-sync-storage-persister';

// Création du client React Query
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,  // 5 min sans refetch
      cacheTime: 24 * 60 * 60 * 1000, // 24h en cache
      refetchOnWindowFocus: true, // refetch silencieux au retour
      keepPreviousData: true, // garde les anciennes données pendant le nouveau fetch
    },
  },
});

// Persistance dans localStorage
const localStoragePersister = createSyncStoragePersister({
  storage: window.localStorage,
});

// Active la persistance
persistQueryClient({
  queryClient,
  persister: localStoragePersister,
  maxAge: 24 * 60 * 60 * 1000, // 24h avant suppression
});

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </React.StrictMode>
);
