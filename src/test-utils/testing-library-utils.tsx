import React, { ReactElement } from 'react';
import { render, renderHook, RenderOptions, RenderHookOptions } from '@testing-library/react';
import { MockedProvider, MockedResponse } from '@apollo/client/testing';
import { cache } from '../apollo-client';


const createCustomWrapper = (mocks: readonly MockedResponse<Record<string, any>>[] = []) => {
  const CustomWrapper = ({ children }: { children: React.ReactNode }) => (
    <MockedProvider mocks={mocks} cache={cache} addTypename>
      {children}
    </MockedProvider>
  );
  return CustomWrapper;
};

// Custom render for components
const customRender = (
  ui: ReactElement,
  options?: Omit<RenderOptions, 'wrapper'> & { mocks?: readonly MockedResponse<Record<string, any>>[] }
) => {
  const { mocks, ...renderOptions } = options || {};
  return render(ui, { wrapper: createCustomWrapper(mocks), ...renderOptions });
};

// Custom renderHook for hooks
function renderHookWithProviders<TProps, TResult>(
  callback: (props: TProps) => TResult,
  options?: RenderHookOptions<TProps> & { mocks?: readonly MockedResponse<Record<string, any>>[] }
) {
  const { mocks, ...hookOptions } = options || {};
  return renderHook(callback, {
    wrapper: createCustomWrapper(mocks),
    ...hookOptions,
  });
}

export * from '@testing-library/react';
export { customRender as render, renderHookWithProviders };
