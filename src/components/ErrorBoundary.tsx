import { Component, type ReactNode } from 'react';

interface Props { children: ReactNode }
interface State { error: Error | null }

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  render() {
    if (this.state.error) {
      return (
        <div style={{ padding: '16px', color: '#E0E0E0', fontFamily: 'monospace', fontSize: '14px' }}>
          render error: {this.state.error.message}
        </div>
      );
    }
    return this.props.children;
  }
}
