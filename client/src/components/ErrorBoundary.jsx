import { Component } from 'react';
import { useLocation } from 'react-router-dom';
import { routes } from '@/config/routes';
import '@/components/ErrorBoundary.css';

// Plain HTML also works when the router or theme provider itself fails.
export function ErrorFallback({ onRetry }) {
  return (
    <section role='alert' className='error-boundary'>
      <h1>This view couldn’t be displayed</h1>
      <p>Try again, reload the page, or return to the dashboard.</p>
      <div className='error-boundary-actions'>
        {onRetry && <button onClick={onRetry}>Try again</button>}
        <button onClick={() => window.location.reload()}>Reload page</button>
        <a href={routes.dashboard}>Go to dashboard</a>
      </div>
    </section>
  );
}

export default class ErrorBoundary extends Component {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error, info) {
    // Keep technical details out of the recovery screen.
    console.error('A view failed to render:', error, info.componentStack);
  }

  reset = () => this.setState({ hasError: false });

  render() {
    return this.state.hasError ? (
      <ErrorFallback onRetry={this.reset} />
    ) : (
      this.props.children
    );
  }
}

export function PageErrorBoundary({ children }) {
  const location = useLocation();
  return (
    <ErrorBoundary key={location.pathname + location.search}>
      {children}
    </ErrorBoundary>
  );
}
