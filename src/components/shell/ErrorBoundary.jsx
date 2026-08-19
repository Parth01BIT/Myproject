import { Component } from 'react';

/**
 * ErrorBoundary — catches unhandled JS errors in any child component tree.
 *
 * Without this, a single thrown error in (e.g.) Today.jsx or Tracker.jsx
 * would crash the entire app to a blank white screen. With this wrapper,
 * the broken tab shows a friendly message while the rest of the chrome
 * (tab bar, address bar) stays intact.
 *
 * Usage: wrap each tab pane (or the whole <BrowserShell> children) in
 * <ErrorBoundary key={route.tab}> so switching tabs resets the boundary.
 */
export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
    this.handleReset = this.handleReset.bind(this);
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    console.error('[PARTH] Unhandled render error:', error, info?.componentStack);
  }

  handleReset() {
    this.setState({ hasError: false, error: null });
  }

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <div className="errorboundary">
        <div className="errorboundary__icon" aria-hidden="true">⚠</div>
        <h2 className="errorboundary__title">Something went wrong</h2>
        <p className="errorboundary__detail">
          {this.state.error?.message || 'An unexpected error occurred in this tab.'}
        </p>
        <div className="errorboundary__actions">
          <button className="errorboundary__btn errorboundary__btn--primary" onClick={this.handleReset}>
            Try again
          </button>
          <button className="errorboundary__btn" onClick={() => window.location.reload()}>
            Reload page
          </button>
        </div>
      </div>
    );
  }
}
