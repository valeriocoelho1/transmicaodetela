import { useCallback, useState } from 'react';
import { loadDisplayName, saveDisplayName } from '../lib/display-name';

export function useDisplayName() {
  const [name, setName] = useState(loadDisplayName);
  const rename = useCallback((next: string) => {
    saveDisplayName(next);
    setName(next);
  }, []);
  return [name, rename] as const;
}
