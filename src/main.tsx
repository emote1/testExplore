import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.tsx';
import './index.css'; // Ваши глобальные стили
import { ApolloProvider } from '@apollo/client'; // <--- 1. Импорт ApolloProvider
import { apolloClient } from './lib/apolloClient.ts'; // <--- 2. Импорт вашего клиента

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ApolloProvider client={apolloClient}> {/* <--- 3. Обертывание App */}
      <App />
    </ApolloProvider>
  </React.StrictMode>,
);