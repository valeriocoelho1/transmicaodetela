import { useState } from 'react';
import { useNavigate } from 'react-router';
import { Button } from '../components/Button';
import { Callout } from '../components/Callout';
import { Icon, type IconName } from '../components/Icon';
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

const steps: { icon: IconName; title: string; text: string }[] = [
  {
    icon: 'play',
    title: 'Crie uma sala',
    text: 'Um clique gera a sua sala e o link para os espectadores.',
  },
  {
    icon: 'screen',
    title: 'Compartilhe a tela',
    text: 'Escolha a tela inteira, uma janela ou uma aba no seletor do navegador.',
  },
  {
    icon: 'link',
    title: 'Envie o link',
    text: 'Quem abrir o link assiste na hora, pelo navegador.',
  },
];

const highlights: { icon: IconName; title: string; text: string }[] = [
  {
    icon: 'users',
    title: 'Sem cadastro',
    text: 'Nem o anfitrião nem os espectadores precisam de conta.',
  },
  {
    icon: 'globe',
    title: 'Sem instalar nada',
    text: 'Funciona no navegador. Para assistir, até o celular serve.',
  },
  {
    icon: 'shield',
    title: 'Direto entre navegadores',
    text: 'O vídeo não passa pelo servidor: vai do anfitrião para cada espectador.',
  },
];

function HeroIllustration() {
  return (
    <div className="hero-art" aria-hidden="true">
      <div className="hero-art__window">
        <div className="hero-art__bar">
          <span />
          <span />
          <span />
          <span className="hero-art__live" />
        </div>
        <div className="hero-art__screen">
          <div className="hero-art__block hero-art__block--wide" />
          <div className="hero-art__block" />
          <div className="hero-art__block hero-art__block--short" />
        </div>
      </div>
      <div className="hero-art__viewers">
        {[0, 1, 2].map((index) => (
          <div
            key={index}
            className="hero-art__viewer"
            style={{ animationDelay: `${index * 0.4}s` }}
          >
            <div className="hero-art__viewer-screen" />
          </div>
        ))}
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
    <Layout>
      <section className="hero">
        <div className="hero__content">
          <span className="eyebrow">Transmissão de tela pelo navegador</span>
          <h1>Compartilhar tela</h1>
          <p className="hero__lead">
            Crie uma sala, compartilhe a tela do computador e envie o link. Quem tiver o link
            assiste pelo navegador, sem cadastro.
          </p>
          <div className="hero__actions">
            <Button
              variant="primary"
              size="lg"
              icon="play"
              busy={creating}
              disabled={creating}
              onClick={() => void handleCreate()}
            >
              {creating ? 'Criando sala…' : 'Criar sala'}
            </Button>
          </div>
          <div aria-live="polite">{error && <Callout tone="error">{error}</Callout>}</div>
        </div>
        <HeroIllustration />
      </section>

      <section className="section" aria-labelledby="how-title">
        <h2 id="how-title" className="section__title">
          Como funciona
        </h2>
        <ol className="steps">
          {steps.map((step, index) => (
            <li key={step.title} className="steps__item">
              <span className="steps__number">{index + 1}</span>
              <span className="steps__icon">
                <Icon name={step.icon} size={22} />
              </span>
              <h3>{step.title}</h3>
              <p>{step.text}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="section" aria-label="Destaques">
        <ul className="highlights">
          {highlights.map((item) => (
            <li key={item.title} className="highlights__item">
              <Icon name={item.icon} size={22} />
              <div>
                <h3>{item.title}</h3>
                <p>{item.text}</p>
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section className="section">
        <Callout tone="warning">
          A transmissão é direta entre navegadores: o anfitrião e os espectadores podem ver o
          endereço IP uns dos outros.
        </Callout>
        <p className="fine-print">
          Para compartilhar a tela, use um navegador de computador atualizado.
        </p>
      </section>
    </Layout>
  );
}
