import { useState } from 'react';
import { useNavigate } from 'react-router';
import { Layout } from '../components/Layout';
import { ApiError, createRoom } from '../lib/api';
import { saveHostToken } from '../lib/host-token';

function errorMessage(error: unknown): string {
  if (error instanceof ApiError && error.kind === 'rate_limited') {
    return 'Muitas tentativas. Aguarde um minuto.';
  }
  if (error instanceof ApiError && error.kind === 'server_busy') {
    return 'O servidor está lotado agora. Tente novamente mais tarde.';
  }
  return 'Não foi possível criar a sala. Tente novamente em instantes.';
}

export function HomePage() {
  const navigate = useNavigate();
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleCreate() {
    setCreating(true);
    setError(null);
    try {
      const { roomId, hostToken } = await createRoom();
      if (!saveHostToken(roomId, hostToken)) throw new Error('Storage unavailable');
      navigate(`/host/${roomId}`);
    } catch (createError) {
      setError(errorMessage(createError));
      setCreating(false);
    }
  }

  return (
    <Layout>
      <h1>Compartilhar tela</h1>
      <p>
        Crie uma sala, compartilhe a tela do computador e envie o link. Quem tiver o link assiste
        pelo navegador, sem cadastro.
      </p>
      <p className="notice">
        A transmissão é direta entre navegadores: o anfitrião e os espectadores podem ver o endereço
        IP uns dos outros.
      </p>
      <button
        type="button"
        className="primary"
        onClick={() => void handleCreate()}
        disabled={creating}
      >
        {creating ? 'Criando sala…' : 'Criar sala'}
      </button>
      <p className="error" aria-live="polite">
        {error}
      </p>
    </Layout>
  );
}
