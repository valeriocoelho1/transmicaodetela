import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from '../App';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe('HomePage', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    vi.unstubAllGlobals();
    localStorage.clear();
  });

  async function render(path = '/') {
    await act(async () => {
      root.render(
        <MemoryRouter initialEntries={[path]}>
          <App />
        </MemoryRouter>,
      );
    });
  }

  function createButton() {
    return [...container.querySelectorAll('button')].find((b) =>
      b.textContent?.startsWith('Criar sala'),
    )!;
  }

  it('shows the title, the description, the IP notice and the create button', async () => {
    await render();
    expect(container.querySelector('h1')?.textContent).toBe(
      'Mostre sua tela para quem tiver o link.',
    );
    expect(container.textContent).toContain('Crie uma sala, compartilhe a tela do computador');
    expect(container.textContent).toContain(
      'o anfitrião e os espectadores podem ver o endereço IP uns dos outros.',
    );
    expect(createButton()).toBeDefined();
  });

  it('stores the host token and opens the host page after creating a room', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        Response.json({ roomId: 'aZ09_-aZ09_-', hostToken: 'x'.repeat(43) }, { status: 201 }),
      ),
    );
    await render();
    await act(async () => createButton().click());
    expect(localStorage.getItem('host-token:aZ09_-aZ09_-')).toBe('x'.repeat(43));
    expect(container.querySelector('h1')?.textContent).toBe('Sua sala');
  });

  it('shows the rate limit message on 429', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => Response.json({}, { status: 429 })),
    );
    await render();
    await act(async () => createButton().click());
    expect(container.textContent).toContain('Muitas tentativas. Aguarde um minuto.');
  });

  it('renders the not found page for unknown routes', async () => {
    await render('/nope');
    expect(container.textContent).toContain('Página não encontrada.');
  });
});
