import { useEffect, useRef, useCallback } from 'react';

/**
 * Returns a debounced version of `fn` that fires after `delay` of inactivity.
 * The latest call wins. The timer is automatically cleaned up on unmount.
 */
export function useDebounced(fn, delay) {
  const fnRef = useRef(fn);
  fnRef.current = fn;
  const timer = useRef(null);

  const debounced = useCallback((...args) => {
    clearTimeout(timer.current);
    timer.current = setTimeout(() => fnRef.current(...args), delay);
  }, []);
  useEffect(() => () => clearTimeout(timer.current), []);
  return debounced;
}
