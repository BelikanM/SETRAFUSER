import React from 'react';
import ReactDOM from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import './index.css';
import App from './App';
import 'bootstrap/dist/css/bootstrap.min.css';
import './index.css';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5 minutes avant de considérer les données comme stale
      cacheTime: 30 * 60 * 1000, // 30 minutes de conservation en cache
      refetchOnWindowFocus: true, // Refetch en arrière-plan quand la fenêtre est focus
      keepPreviousData: true, // Préserve les données précédentes pendant le refetch
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
