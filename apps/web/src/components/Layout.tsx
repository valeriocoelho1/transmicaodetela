import type { ReactNode } from 'react';
import { Link } from 'react-router';
import { Icon } from './Icon';

interface LayoutProps {
  width?: 'narrow' | 'wide';
  children: ReactNode;
}

export function Layout({ width = 'wide', children }: LayoutProps) {
  return (
    <div className="app">
      <header className="site-header">
        <div className="site-header__inner">
          <Link to="/" className="brand">
            <span className="brand__mark">
              <Icon name="screen" size={18} />
            </span>
            <span className="brand__name">Compartilhar tela</span>
          </Link>
        </div>
      </header>
      <main className={`container container--${width}`}>{children}</main>
      <footer className="site-footer">
        <p>Vídeo direto entre navegadores, sem cadastro e sem instalar nada.</p>
      </footer>
    </div>
  );
}
