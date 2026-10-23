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
  });

  async function renderHome() {
    await act(async () => {
      root.render(
        <MemoryRouter initialEntries={['/']}>
          <App />
        </MemoryRouter>,
      );
    });
  }

  it('shows the title and "API: ok" when /api/health answers ok', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => Response.json({ status: 'ok' })),
    );
    await renderHome();
    expect(container.querySelector('h1')?.textContent).toBe('Compartilhar tela');
    expect(container.textContent).toContain('API: ok');
  });

  it('shows "API: indisponível" when the response is invalid', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => Response.json({ status: 'down' })),
    );
    await renderHome();
    expect(container.textContent).toContain('API: indisponível');
  });

  it('shows "API: indisponível" when the request fails', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => Promise.reject(new Error('offline'))),
    );
    await renderHome();
    expect(container.textContent).toContain('API: indisponível');
  });
});
