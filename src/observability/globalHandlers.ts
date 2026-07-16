import { errorReporter } from './observability';

type GlobalErrorHandler = (error: Error, isFatal?: boolean) => void;
type ErrorUtilsApi = {
  getGlobalHandler: () => GlobalErrorHandler;
  setGlobalHandler: (handler: GlobalErrorHandler) => void;
};

type RejectionEvent = { reason?: unknown; preventDefault?: () => void };
type GlobalEventTarget = {
  ErrorUtils?: ErrorUtilsApi;
  addEventListener?: (type: string, listener: (event: RejectionEvent) => void) => void;
  removeEventListener?: (type: string, listener: (event: RejectionEvent) => void) => void;
};

type RuntimeErrorInfo = {
  source: 'javascript' | 'promise';
  isFatal: boolean;
};

export type RuntimeErrorListener = (error: Error, info: RuntimeErrorInfo) => boolean | void;

export function installGlobalErrorHandlers(onRuntimeError?: RuntimeErrorListener): () => void {
  const target = globalThis as unknown as GlobalEventTarget;
  const errorUtils = target.ErrorUtils;
  const previousHandler = errorUtils?.getGlobalHandler();

  const globalHandler: GlobalErrorHandler = (error, isFatal) => {
    errorReporter.captureException(error, {
      context: 'global-error-handler',
      tags: { fatal: String(isFatal === true) },
    });
    const handled = notifyRuntimeError(onRuntimeError, error, {
      source: 'javascript',
      isFatal: isFatal === true,
    });
    // Keep the developer red box and any host diagnostics. In release builds,
    // a mounted app shell can recover into the soft error screen instead of
    // handing a fatal JS exception back to the native crash handler.
    if (__DEV__ || handled !== true) previousHandler?.(error, isFatal);
  };

  if (errorUtils) errorUtils.setGlobalHandler(globalHandler);

  const rejectionHandler = (event: RejectionEvent) => {
    errorReporter.captureException(event.reason, { context: 'unhandled-promise-rejection' });
    const handled = notifyRuntimeError(onRuntimeError, errorFromUnknown(event.reason), {
      source: 'promise',
      isFatal: false,
    });
    if (handled) event.preventDefault?.();
  };
  target.addEventListener?.('unhandledrejection', rejectionHandler);

  return () => {
    if (errorUtils?.getGlobalHandler() === globalHandler && previousHandler) {
      errorUtils.setGlobalHandler(previousHandler);
    }
    target.removeEventListener?.('unhandledrejection', rejectionHandler);
  };
}

function notifyRuntimeError(
  listener: RuntimeErrorListener | undefined,
  error: Error,
  info: RuntimeErrorInfo
): boolean {
  if (!listener) return false;
  try {
    return listener(error, info) === true;
  } catch (listenerError) {
    errorReporter.captureException(listenerError, { context: 'runtime-error-listener' });
    return false;
  }
}

function errorFromUnknown(value: unknown): Error {
  if (value instanceof Error) return value;
  if (typeof value === 'string' && value) return new Error(value);
  return new Error('An unexpected asynchronous error occurred.');
}
