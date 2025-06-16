/**
 * Error handling utilities for pagination
 * Provides safe error handling and user-friendly error messages
 */

export interface PaginationError {
  code: string;
  message: string;
  userMessage: string;
  originalError?: Error;
}

export class PaginationErrorHandler {
  /**
   * Create a standardized pagination error
   */
  static createError(
    code: string,
    message: string,
    userMessage: string,
    originalError?: Error
  ): PaginationError {
    return {
      code,
      message,
      userMessage,
      originalError,
    };
  }

  /**
   * Handle API fetch errors
   */
  static handleApiError(error: unknown, context: string): PaginationError {
    console.error(`[API_ERROR] ${context}:`, error);

    if (error instanceof Error) {
      // Network errors
      if (error.message.includes('fetch')) {
        return this.createError(
          'NETWORK_ERROR',
          `Network error in ${context}: ${error.message}`,
          'Ошибка сети. Проверьте подключение к интернету.',
          error
        );
      }

      // GraphQL errors
      if (error.message.includes('GraphQL')) {
        return this.createError(
          'GRAPHQL_ERROR',
          `GraphQL error in ${context}: ${error.message}`,
          'Ошибка запроса к серверу. Попробуйте позже.',
          error
        );
      }

      // Generic API error
      return this.createError(
        'API_ERROR',
        `API error in ${context}: ${error.message}`,
        'Ошибка загрузки данных. Попробуйте обновить страницу.',
        error
      );
    }

    // Unknown error
    return this.createError(
      'UNKNOWN_ERROR',
      `Unknown error in ${context}: ${String(error)}`,
      'Произошла неизвестная ошибка. Попробуйте позже.',
    );
  }

  /**
   * Handle cache errors
   */
  static handleCacheError(error: unknown, operation: string): PaginationError {
    console.error(`[CACHE_ERROR] ${operation}:`, error);

    return this.createError(
      'CACHE_ERROR',
      `Cache error during ${operation}: ${String(error)}`,
      'Ошибка кеша. Данные будут загружены заново.',
      error instanceof Error ? error : undefined
    );
  }

  /**
   * Handle validation errors
   */
  static handleValidationError(errors: string[], context: string): PaginationError {
    const message = `Validation failed in ${context}: ${errors.join(', ')}`;
    console.error(`[VALIDATION_ERROR] ${message}`);

    return this.createError(
      'VALIDATION_ERROR',
      message,
      'Некорректные данные. Проверьте введенные параметры.',
    );
  }

  /**
   * Handle pagination navigation errors
   */
  static handleNavigationError(error: unknown, action: string): PaginationError {
    console.error(`[NAVIGATION_ERROR] ${action}:`, error);

    const userMessages: Record<string, string> = {
      'next_page': 'Не удалось перейти на следующую страницу.',
      'previous_page': 'Не удалось перейти на предыдущую страницу.',
      'first_page': 'Не удалось перейти на первую страницу.',
      'last_page': 'Не удалось перейти на последнюю страницу.',
    };

    return this.createError(
      'NAVIGATION_ERROR',
      `Navigation error during ${action}: ${String(error)}`,
      userMessages[action] || 'Ошибка навигации по страницам.',
      error instanceof Error ? error : undefined
    );
  }

  /**
   * Safe async operation wrapper
   */
  static async safeAsync<T>(
    operation: () => Promise<T>,
    context: string,
   
  ): Promise<{ success: true; data: T } | { success: false; error: PaginationError }> {
    try {
      const data = await operation();
      return { success: true, data };
    } catch (error) {
      const paginationError = this.handleApiError(error, context);
      return { success: false, error: paginationError };
    }
  }

  /**
   * Safe sync operation wrapper
   */
  static safeSync<T>(
    operation: () => T,
    context: string,
   
  ): { success: true; data: T } | { success: false; error: PaginationError } {
    try {
      const data = operation();
      return { success: true, data };
    } catch (error) {
      const paginationError = this.createError(
        'SYNC_ERROR',
        `Sync error in ${context}: ${String(error)}`,
        'Произошла ошибка обработки данных.',
        error instanceof Error ? error : undefined
      );
      return { success: false, error: paginationError };
    }
  }
}
