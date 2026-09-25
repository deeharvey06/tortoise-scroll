import {
  render as renderComponent,
  renderHook as renderReactHook,
} from '@testing-library/react';
import QueryProvider from '@/providers/QueryProvider';

export * from '@testing-library/react';

function withQueries(Wrapper) {
  return function TestProviders({ children }) {
    return (
      <QueryProvider>
        {Wrapper ? <Wrapper>{children}</Wrapper> : children}
      </QueryProvider>
    );
  };
}

export function render(ui, options = {}) {
  return renderComponent(ui, {
    ...options,
    wrapper: withQueries(options.wrapper),
  });
}

export function renderHook(hook, options = {}) {
  return renderReactHook(hook, {
    ...options,
    wrapper: withQueries(options.wrapper),
  });
}
