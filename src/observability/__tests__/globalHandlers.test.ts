import { installGlobalErrorHandlers } from '../globalHandlers';

type Handler = (error: Error, isFatal?: boolean) => void;
type RejectionListener = (event: { reason?: unknown }) => void;

describe('global error handlers', () => {
  it('forwards JavaScript errors and rejected promises to the app shell', () => {
    const target = globalThis as unknown as {
      ErrorUtils?: {
        getGlobalHandler: () => Handler;
        setGlobalHandler: (handler: Handler) => void;
      };
      addEventListener?: (type: string, listener: RejectionListener) => void;
      removeEventListener?: (type: string, listener: RejectionListener) => void;
    };
    const originalErrorUtils = target.ErrorUtils;
    const originalAddEventListener = target.addEventListener;
    const originalRemoveEventListener = target.removeEventListener;
    const previousHandler = jest.fn();
    let currentHandler: Handler = previousHandler;
    let rejectionListener: RejectionListener | undefined;

    target.ErrorUtils = {
      getGlobalHandler: () => currentHandler,
      setGlobalHandler: (handler) => {
        currentHandler = handler;
      },
    };
    target.addEventListener = (_type: string, listener: RejectionListener) => {
      rejectionListener = listener;
    };
    target.removeEventListener = jest.fn();

    const onRuntimeError = jest.fn(() => true);
    const uninstall = installGlobalErrorHandlers(onRuntimeError);
    const fatal = new Error('fatal');
    currentHandler(fatal, true);
    rejectionListener?.({ reason: 'async failure' });

    expect(onRuntimeError).toHaveBeenNthCalledWith(1, fatal, {
      source: 'javascript',
      isFatal: true,
    });
    expect(onRuntimeError).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ message: 'async failure' }),
      { source: 'promise', isFatal: false }
    );

    uninstall();
    expect(currentHandler).toBe(previousHandler);
    target.ErrorUtils = originalErrorUtils;
    target.addEventListener = originalAddEventListener;
    target.removeEventListener = originalRemoveEventListener;
  });
});
