// src/mocks/handlers.ts
import { graphql, HttpResponse } from 'msw';

export const handlers = [
  // Пример обработчика для GraphQL запроса
  // Вам нужно будет адаптировать это под ваши конкретные запросы и данные
  graphql.query('GetTransfers', ({ query, variables }) => {
    console.log('[MSW] Intercepted GraphQL query:', query);
    console.log('[MSW] Intercepted GraphQL variables:', variables);

    // Пример ответа для начальной загрузки
    if (variables.nativeAddressVariable === 'VALID_ADDRESS_INITIAL_LOAD') {
      return HttpResponse.json({
        data: {
          transfersConnection: {
            edges: [
              { node: { id: 'tx1', from: { id: 'VALID_ADDRESS_INITIAL_LOAD' }, to: { id: 'SOME_OTHER_ADDRESS' }, amount: '1000', success: true, timestamp: '2023-01-01T12:00:00.000Z', type: 'TRANSFER', token: { name: 'REEF', symbol: 'REEF', decimals: 18 } } },
              { node: { id: 'tx2', from: { id: 'SOME_OTHER_ADDRESS' }, to: { id: 'VALID_ADDRESS_INITIAL_LOAD' }, amount: '500', success: true, timestamp: '2023-01-01T11:00:00.000Z', type: 'TRANSFER', token: { name: 'REEF', symbol: 'REEF', decimals: 18 } } },
              // ... еще 10 транзакций, чтобы было 12
            ],
            pageInfo: {
              hasNextPage: true,
              hasPreviousPage: false,
              startCursor: 'START_CURSOR_1',
              endCursor: 'END_CURSOR_1',
            },
            totalCount: 100, // Примерное общее количество
          },
        },
      });
    }

    // Пример ответа для случая, когда транзакций нет
    if (variables.nativeAddressVariable === 'ADDRESS_NO_TRANSACTIONS') {
      return HttpResponse.json({
        data: {
          transfersConnection: {
            edges: [],
            pageInfo: {
              hasNextPage: false,
              hasPreviousPage: false,
              startCursor: null,
              endCursor: null,
            },
            totalCount: 0,
          },
        },
      });
    }
    
    // Пример ответа для следующей страницы
    if (variables.nativeAddressVariable === 'VALID_ADDRESS_NEXT_PAGE' && variables.after === 'END_CURSOR_1') {
      return HttpResponse.json({
        data: {
          transfersConnection: {
            edges: [
              { node: { id: 'tx13', from: { id: 'VALID_ADDRESS_NEXT_PAGE' }, to: { id: 'SOME_OTHER_ADDRESS' }, amount: '200', success: true, timestamp: '2023-01-02T12:00:00.000Z', type: 'TRANSFER', token: { name: 'REEF', symbol: 'REEF', decimals: 18 } } },
              // ... еще транзакции для второй страницы
            ],
            pageInfo: {
              hasNextPage: true, // или false, если это последняя
              hasPreviousPage: true,
              startCursor: 'START_CURSOR_2',
              endCursor: 'END_CURSOR_2',
            },
            totalCount: 100, 
          },
        },
      });
    }

    // Ответ по умолчанию или для непредусмотренных случаев
    return HttpResponse.json({
      errors: [{ message: 'Mocked response: Unhandled query variables' }],
    });
  }),
  graphql.query('GetAccountByEvm', ({ variables }) => {
    const { evmAddress } = variables;
    // In our tests, mockValidAddress is a native address.
    // The hook's logic might call GetAccountByEvm if isEvmAddress returns true
    // or if getNativeAddress attempts to resolve it as EVM.
    // For simplicity, if it's mockValidAddress (which we use as input in tests),
    // or other test-specific valid addresses, return it as if it's the native id.
    if (
      evmAddress === '5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY' ||
      evmAddress === 'VALID_ADDRESS_INITIAL_LOAD' ||
      evmAddress === 'VALID_ADDRESS_NEXT_PAGE'
    ) {
      return HttpResponse.json({
        data: {
          accounts: [{ id: evmAddress as string }],
        },
      });
    }
    // For other EVM addresses (e.g., if we were to test actual EVM resolution)
    // one might return a found native address or an empty array if not found.
    // For now, for all others, return an empty array to simulate 'not found'.
    return HttpResponse.json({
      data: {
        accounts: [],
      },
    });
  }),
  // Добавьте другие обработчики для других операций GraphQL, если они есть
];
