import { useState } from 'react';
import { useNavigate } from 'react-router';
import { Button } from '../components/Button';
import { Callout } from '../components/Callout';
import { Icon } from '../components/Icon';
import { LandingLayout } from '../components/Layout';
import { PixelSprite } from '../components/PixelSprite';
import { REPOSITORY_URL } from '../config';
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

const steps = [
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
] as const;

const questions = [
  {
    question: 'Quantas pessoas podem assistir?',
    answer:
      'Cada sala tem um limite de espectadores ao mesmo tempo. A página da sala mostra esse limite e quantas pessoas estão assistindo agora.',
  },
  {
    question: 'Dá para assistir pelo celular?',
    answer:
      'Sim. Quem assiste só precisa abrir o link no navegador. Para transmitir, use um computador.',
  },
  {
    question: 'O som vai junto?',
    answer:
      'Vai, se você compartilhar uma aba do navegador e marcar a opção de áudio, quando o navegador oferecer.',
  },
  {
    question: 'A transmissão fica gravada?',
    answer:
      'Não. O vídeo vai do seu navegador para o de quem assiste e não é guardado em lugar nenhum.',
  },
  {
    question: 'Quando a sala termina?',
    answer:
      'Quando você clica em Encerrar sala, ou quando sai da página e não volta logo. Recarregar a página não derruba a sala. Toda sala também tem um tempo máximo de duração.',
  },
] as const;

const exampleLink = `${window.location.host}/r/k7Qm2xPa`;
const repositoryName = new URL(REPOSITORY_URL).pathname.slice(1);

function SelectionFrame() {
  return (
    <div className="selection" aria-hidden="true">
      <span className="selection__tag">Tela inteira</span>
      <span className="selection__handle selection__handle--tl" />
      <span className="selection__handle selection__handle--tr" />
      <span className="selection__handle selection__handle--bl" />
      <span className="selection__handle selection__handle--br" />
      <PixelSprite name="cursor" size={30} className="selection__cursor" />
    </div>
  );
}

function DirectDiagram() {
  return (
    <div className="direct" aria-hidden="true">
      <div className="direct__host">
        <PixelSprite name="tv" size={200} className="direct__host-tv" />
        <span>Anfitrião</span>
      </div>
      {[1, 2, 3].map((row) => (
        <div key={`beam-${row}`} className="direct__beam" style={{ gridRow: row }} />
      ))}
      {[1, 2, 3].map((row) => (
        <div key={`viewer-${row}`} className="direct__viewer" style={{ gridRow: row }}>
          <PixelSprite name="tv" size={72} />
          <span>Espectador</span>
        </div>
      ))}
      <div className="direct__wire" />
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
    <LandingLayout>
      <section className="hero">
        <PixelSprite name="star" size={28} className="star star--1" />
        <PixelSprite name="star" size={20} className="star star--2" />
        <PixelSprite name="star" size={36} className="star star--3" />

        <div className="hero__inner">
          <div className="hero__title">
            <h1>Mostre sua tela para quem tiver o link.</h1>
            <SelectionFrame />
          </div>
          <div className="hero__side">
            <p className="hero__lead">
              Crie uma sala, compartilhe a tela do computador e envie o link. Quem tiver o link
              assiste pelo navegador, sem cadastro.
            </p>
            <Button
              variant="primary"
              size="lg"
              trailingIcon="arrowRight"
              busy={creating}
              disabled={creating}
              onClick={() => void handleCreate()}
            >
              {creating ? 'Criando sala…' : 'Criar sala'}
            </Button>
            <div aria-live="polite">{error && <Callout tone="error">{error}</Callout>}</div>
            <p className="hero__note">
              Para compartilhar a tela, use um navegador de computador atualizado. A transmissão é
              direta entre navegadores: o anfitrião e os espectadores podem ver o endereço IP uns
              dos outros.
            </p>
          </div>
        </div>
      </section>

      <section id="como-funciona" className="section section--paper" aria-labelledby="how-title">
        <div className="section__inner">
          <h2 id="how-title" className="section__title">
            Como funciona
          </h2>
          <ol className="steps">
            {steps.map((step, index) => (
              <li key={step.title} className="steps__item pixel-box">
                <span className="steps__number pixel-box">{index + 1}</span>
                <h3>{step.title}</h3>
                <p>{step.text}</p>
                {index === steps.length - 1 && <span className="steps__link">{exampleLink}</span>}
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="section section--night" aria-labelledby="direct-title">
        <div className="section__inner direct-section">
          <DirectDiagram />
          <div className="direct-section__text">
            <h2 id="direct-title" className="section__title">
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

      <section id="perguntas" className="section section--paper" aria-labelledby="faq-title">
        <div className="section__inner faq">
          <div className="faq__aside">
            <h2 id="faq-title" className="section__title">
              Perguntas frequentes
            </h2>
            <div className="github-box pixel-box">
              <div className="github-box__head">
                <PixelSprite name="github" size={48} label="GitHub" />
                <span className="github-box__title">Quer contribuir?</span>
              </div>
              <p>Abra uma issue ou envie um pull request no repositório do projeto.</p>
              <a
                className="btn btn--github"
                href={REPOSITORY_URL}
                aria-label="link do repositório no GitHub"
              >
                <span>link</span>
                <Icon name="arrowRight" />
              </a>
            </div>
          </div>
          <div className="faq__list">
            {questions.map((item, index) => (
              <details key={item.question} className="faq__item pixel-box" open={index === 0}>
                <summary>{item.question}</summary>
                <p>{item.answer}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      <section
        id="contribuir"
        className="section section--tomato"
        aria-labelledby="contribute-title"
      >
        <div className="section__inner contribute">
          <div className="contribute__intro">
            <h2 id="contribute-title" className="section__title">
              Contribua com o projeto
            </h2>
            <p>
              O código está no GitHub. Encontrou um problema ou tem uma ideia? Abra uma issue ou
              envie um pull request.
            </p>
          </div>
          <div className="repo-card pixel-box">
            <div className="repo-card__text">
              <span className="repo-card__label">Repositório</span>
              <span className="repo-card__name">{repositoryName}</span>
            </div>
            <a className="btn btn--accent" href={REPOSITORY_URL}>
              <Icon name="code" />
              <span>Ver no GitHub</span>
            </a>
          </div>
        </div>
      </section>
    </LandingLayout>
  );
}
