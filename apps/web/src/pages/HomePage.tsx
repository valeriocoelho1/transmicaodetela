import { useEffect, useState } from 'react';
import { isApiHealthy } from '../lib/api';

export function HomePage() {
  const [healthy, setHealthy] = useState<boolean | null>(null);

  useEffect(() => {
    let active = true;
    void isApiHealthy().then((ok) => {
      if (active) setHealthy(ok);
    });
    return () => {
      active = false;
    };
  }, []);

  return (
    <main className="container">
      <h1>Compartilhar tela</h1>
      <p aria-live="polite">
        {healthy === null ? null : healthy ? 'API: ok' : 'API: indisponível'}
      </p>
    </main>
  );
}
