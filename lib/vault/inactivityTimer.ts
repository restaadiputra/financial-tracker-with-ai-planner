export interface InactivityTimer {
  reset: () => void;
  clear: () => void;
}

export function createInactivityTimer(timeoutMs: number, onTimeout: () => void): InactivityTimer {
  let handle: ReturnType<typeof setTimeout> | null = null;

  return {
    reset() {
      if (handle) clearTimeout(handle);
      handle = setTimeout(onTimeout, timeoutMs);
    },
    clear() {
      if (handle) clearTimeout(handle);
      handle = null;
    },
  };
}
