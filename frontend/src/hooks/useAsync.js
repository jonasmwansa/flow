import { useCallback, useEffect, useState } from "react";

import { ApiError } from "../lib/api";

// Run an async loader and track loading / error / data states for the UI.
// `loader` is the function that fetches data; `deps` re-runs it when they change.
export function useAsync(loader, deps) {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);

  const run = useCallback(() => {
    setLoading(true);
    setError(null);
    loader()
      .then(setData)
      .catch((e) => setError(e instanceof ApiError ? e.message : "Something went wrong."))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  useEffect(() => run(), [run]);

  return { data, error, loading, reload: run, setData };
}
