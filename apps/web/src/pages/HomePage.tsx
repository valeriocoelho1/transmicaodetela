import { useState } from 'react';
import { useNavigate } from 'react-router';
import { Button } from '../components/Button';
import { Callout } from '../components/Callout';
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

const steps: { title: string; text: string }[] = [
  {
    title: 'Crie uma sala',
    text: 'Um clique gera a sala e o link para quem vai assistir.',
  },
  {
    title: 'Escolha o que mostrar',
    text: 'A tela inteira, uma janela ou uma aba, no seletor do próprio navegador.',
  },
  {
    title: 'Envie o link',
    text: 'Mande por onde quiser. O link é tudo que o espectador precisa.',
  },
];

function Selection() {
  return (
    <div className="selection" aria-hidden="true">
      <span className="selection__tag">Tela inteira</span>
      <span className="selection__handle selection__handle--tl" />
      <span className="selection__handle selection__handle--tr" />
      <span className="selection__handle selection__handle--bl" />
      <span className="selection__handle selection__handle--br" />
      <svg className="selection__cursor" viewBox="0 0 26 30" fill="none">
        <path
          d="M3 2v21l5.6-5.2 3.9 8.6 3.6-1.6-3.8-8.5H20L3 2Z"
          fill="#ffffff"
          stroke="#0d1330"
          strokeWidth="1.6"
          strokeLinejoin="round"
        />
      </svg>
    </div>
  );
}

function DirectDiagram() {
  return (
    <div className="direct" aria-hidden="true">
      <div className="direct__host">
        <span className="direct__screen direct__screen--host" />
        <span>Anfitrião</span>
      </div>
      {[1, 2, 3].map((row) => (
        <div key={`line-${row}`} className="direct__line" style={{ gridRow: row }} />
      ))}
      {[1, 2, 3].map((row) => (
        <div key={`viewer-${row}`} className="direct__viewer" style={{ gridRow: row }}>
          <span className="direct__screen" />
          <span>Espectador</span>
        </div>
      ))}
      <div className="direct__link" />
      <div className="direct__server">
        <strong>Servidor</strong>
        <span>Só combina a conexão. O vídeo não passa por aqui.</span>
      </div>
    </div>
  );
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
    <Layout width="landing">
      <section className="landing-hero">
        <div className="landing-hero__title">
          <h1>Mostre sua tela para quem tiver o link.</h1>
          <Selection />
        </div>
        <div className="landing-hero__side">
          <p className="landing-hero__lead">
            Crie uma sala, compartilhe a tela do computador e envie o link. Quem tiver o link
            assiste pelo navegador, sem cadastro.
          </p>
          <Button
            variant="primary"
            size="lg"
            icon="select"
            busy={creating}
            disabled={creating}
            className="landing-hero__cta"
            onClick={() => void handleCreate()}
          >
            {creating ? 'Criando sala…' : 'Criar sala'}
          </Button>
          <div aria-live="polite">{error && <Callout tone="error">{error}</Callout>}</div>
          <p className="landing-note">
            Para compartilhar a tela, use um navegador de computador atualizado. A transmissão é
            direta entre navegadores: o anfitrião e os espectadores podem ver o endereço IP uns dos
            outros.
          </p>
        </div>
      </section>

      <section className="landing-section" aria-labelledby="how-title">
        <div className="landing-section__inner">
          <h2 id="how-title" className="landing-section__title">
            Como funciona
          </h2>
          <ol className="landing-steps">
            {steps.map((step, index) => (
              <li key={step.title} className="landing-steps__item">
                <span className="landing-steps__number">{index + 1}</span>
                <h3>{step.title}</h3>
                <p>{step.text}</p>
                {index === steps.length - 1 && (
                  <span className="landing-steps__link">{window.location.host}/r/k7Qm2xPa</span>
                )}
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="landing-section landing-section--raised" aria-labelledby="direct-title">
        <div className="landing-section__inner landing-direct">
          <DirectDiagram />
          <div className="landing-direct__text">
            <h2 id="direct-title" className="landing-section__title">
              O vídeo vai direto de você para quem assiste.
            </h2>
            <p>
              Nenhuma conta, nenhum programa. Para assistir, até o celular serve. A imagem sai do
              seu navegador e chega ao navegador de cada espectador, sem ficar guardada em lugar
              nenhum.
            </p>
          </div>
        </div>
      </section>
    </Layout>
  );
}
