import { ApolloClient, InMemoryCache, HttpLink, split } from '@apollo/client';
import { getMainDefinition } from '@apollo/client/utilities';
import { GraphQLWsLink } from '@apollo/client/link/subscriptions'; // Corrected import
import { createClient } from 'graphql-ws';

const GRAPHQL_ENDPOINT = 'https://squid.subsquid.io/reef-explorer/graphql';
const WEBSOCKET_ENDPOINT = 'wss://squid.subsquid.io/reef-explorer/graphql'; // Usually wss for secure websockets

// HTTP Link для queries и mutations
const httpLink = new HttpLink({
  uri: GRAPHQL_ENDPOINT,
});

// WebSocket Link для subscriptions
const wsLink = new GraphQLWsLink(createClient({ // Corrected usage
  url: WEBSOCKET_ENDPOINT,
  connectionParams: () => {
    // Здесь можно передавать параметры аутентификации, если они нужны для WebSocket
    // Например:
    // return {
    //   headers: {
    //     Authorization: `Bearer ${localStorage.getItem('token')}`,
    //   },
    // };
    return {}; // Пока оставляем пустым, если аутентификация не требуется
  },
}));

// Функция split используется для направления трафика на соответствующий линк
// в зависимости от типа операции (query/mutation vs subscription)
const splitLink = split(
  ({ query }) => {
    const definition = getMainDefinition(query);
    return (
      definition.kind === 'OperationDefinition' &&
      definition.operation === 'subscription'
    );
  },
  wsLink, // Если это subscription, используем wsLink
  httpLink, // Иначе (query/mutation), используем httpLink
);

export const apolloClient = new ApolloClient({
  link: splitLink,
  cache: new InMemoryCache(),
  connectToDevTools: import.meta.env.DEV, // Включаем DevTools только в режиме разработки
});
