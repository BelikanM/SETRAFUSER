import React from 'react';
import ReactDOM from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import './index.css';
import App from './App';
import 'bootstrap/dist/css/bootstrap.min.css';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5 min : pas de re-fetch tant que c'est frais
      cacheTime: 30 * 60 * 1000, // 30 min avant suppression du cache
      refetchOnWindowFocus: true, // Refetch silencieux quand on revient sur l'onglet
      keepPreviousData: true, // Garde les anciennes données pendant un nouveau fetch
    },
  },
});

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </React.StrictMode>
);
