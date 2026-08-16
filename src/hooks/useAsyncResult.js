import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * useAsyncResult — shared async promise+state hook (V2.4).
 *
 * Used by every Stage-B read site to migrate DataStore.x.get() from sync →
 * async without bespoke loading state per component:
 *
 *   const { data, loading, error, reload } = useAsyncResult(
 *     `journal:${dateKey}`,
 *     () => DataStore.journal.get(dateKey)
 *   );
 *
 * Features:
 *  - key: changes to `key` re-run the fetcher (any dep value works; pass a
 *    tuple-stringified key for multi-dep inputs).
 *  - reload(): re-run the current fetcher on demand (e.g. after a write).
 *  - skips in-flight fetches if the key changes mid-flight.
 *  - keeps the previous `data` visible while reloading, so the UI never
 *    flashes empty between edits.
 *  - accepts an optional `deps` array — when supplied, re-runs whenever any
 *    dep changes (in addition to on key change). Most call sites can rely on
 *    the `key` alone; `deps` is for numeric "bump" counters used by
 *    `useStaleTabs`.
 */
export function useAsyncResult(key, fetcher, deps = []) {
  const [state, setState] = useState({ data: undefined, loading: true, error: null });
  const reqIdRef = useRef(0);

  const run = useCallback(() => {
    const reqId = ++reqIdRef.current;
    setState((s) => ({ ...s, loading: true, error: null }));
    Promise.resolve()
      .then(() => fetcher())
      .then(
        (data) => {
          if (reqIdRef.current === reqId) setState({ data, loading: false, error: null });
        },
        (error) => {
          if (reqIdRef.current === reqId) setState({ data: undefined, loading: false, error });
        }
      );
  }, deps); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    run();
  }, [key, run]); // re-run when key or fetcher identity changes

  return { ...state, reload: run };
}

export default useAsyncResult;
