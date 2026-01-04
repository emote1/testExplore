import './setup/polyfills';
import './setup/quiet-console';
import { StrictMode } from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.tsx';
import './index.css'; // Ваши глобальные стили
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,       // 5 мин: NFT данные меняются редко
      gcTime: 30 * 60 * 1000,         // 30 мин: держим кэш дольше
      refetchOnWindowFocus: false,
      refetchOnReconnect: 'always',   // Обновлять при восстановлении сети
      retry: (failureCount, error) => {
        // Не повторяем 404 ошибки
        if (error && typeof error === 'object' && 'message' in error) {
          const msg = String(error.message).toLowerCase();
          if (msg.includes('404') || msg.includes('not found')) return false;
        }
        return failureCount < 2;
      },
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
    },
  },
});

ReactDOM.createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
      <ReactQueryDevtools initialIsOpen={true} buttonPosition="bottom-right" />
    </QueryClientProvider>
  </StrictMode>,
);