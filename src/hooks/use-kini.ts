import { useEffect, useState } from 'react';

/** Waktu sekarang (epoch ms) yang diperbarui setiap `intervalMs`. */
export function useKini(intervalMs = 1000): number {
  const [kini, setKini] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setKini(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return kini;
}
