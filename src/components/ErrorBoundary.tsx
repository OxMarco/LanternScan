import { Component, Fragment, type ErrorInfo, type ReactNode } from 'react';

import { errorReporter } from '@/observability/observability';

import SoftErrorScreen from './SoftErrorScreen';

type Props = {
  children: ReactNode;
  context?: string;
};

type State = { error: Error | null; recoveryKey: number };

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null, recoveryKey: 0 };

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    const context = this.props.context ?? 'ErrorBoundary';
    errorReporter.captureException(error, {
      context,
      extra: { component_stack: errorInfo.componentStack ?? '' },
    });
    if (__DEV__) console.error(`[${context}]`, error, errorInfo.componentStack);
  }

  private reset = () =>
    this.setState((state) => ({ error: null, recoveryKey: state.recoveryKey + 1 }));

  render() {
    if (!this.state.error) {
      return <Fragment key={this.state.recoveryKey}>{this.props.children}</Fragment>;
    }

    return <SoftErrorScreen onRetry={this.reset} />;
  }
}
