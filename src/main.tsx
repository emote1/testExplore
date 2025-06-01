import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { ApolloClient, InMemoryCache, ApolloProvider } from '@apollo/client';

// 1. Создаем экземпляр ApolloClient
const client = new ApolloClient({
  uri: 'https://squid.subsquid.io/reef-explorer/graphql', // URL вашего GraphQL API
  cache: new InMemoryCache(),
});

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    {/* 2. Оборачиваем App в ApolloProvider */}
    <ApolloProvider client={client}>
      <App />
    </ApolloProvider>
  </React.StrictMode>
);
