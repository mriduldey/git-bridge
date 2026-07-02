/**
 * A Promise with externally controlled resolution functions.
 */
export interface Deferred<T> {
  /**
   * The Promise controlled by this deferred value.
   */
  readonly promise: Promise<T>;

  /**
   * Resolves the Promise.
   */
  readonly resolve: (value: T | PromiseLike<T>) => void;

  /**
   * Rejects the Promise.
   */
  readonly reject: (reason?: unknown) => void;
}

/**
 * Creates a Promise with externally exposed resolve and reject callbacks.
 */
export function deferred<T>(): Deferred<T> {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;

  const promise = new Promise<T>((promiseResolve, promiseReject) => {
    resolve = promiseResolve;
    reject = promiseReject;
  });

  return { promise, resolve, reject };
}

/**
 * Races a Promise-like operation against an AbortSignal.
 */
export function raceAbort<T>(operation: PromiseLike<T>, signal?: AbortSignal): Promise<T> {
  if (signal === undefined) {
    return Promise.resolve(operation);
  }

  if (signal.aborted) {
    return Promise.reject(createAbortError(signal));
  }

  return new Promise<T>((resolve, reject) => {
    const onAbort = (): void => {
      reject(createAbortError(signal));
    };

    signal.addEventListener("abort", onAbort, { once: true });

    Promise.resolve(operation).then(
      (value) => {
        signal.removeEventListener("abort", onAbort);
        resolve(value);
      },
      (error: unknown) => {
        signal.removeEventListener("abort", onAbort);
        reject(error);
      }
    );
  });
}

/**
 * Resolves after the requested delay unless aborted.
 */
export function sleep(milliseconds: number, signal?: AbortSignal): Promise<void> {
  if (signal === undefined) {
    return new Promise<void>((resolve) => {
      setTimeout(resolve, milliseconds);
    });
  }

  if (signal.aborted) {
    return Promise.reject(createAbortError(signal));
  }

  return new Promise<void>((resolve, reject) => {
    const timeout = setTimeout(() => {
      signal.removeEventListener("abort", onAbort);
      resolve();
    }, milliseconds);

    const onAbort = (): void => {
      clearTimeout(timeout);
      reject(createAbortError(signal));
    };

    signal.addEventListener("abort", onAbort, { once: true });
  });
}

function createAbortError(signal: AbortSignal): Error {
  return signal.reason instanceof Error ? signal.reason : new Error("Operation aborted");
}
