import type { ReactNode } from 'react';
import { Link } from 'react-router';
import { REPOSITORY_URL } from '../config';
import { Icon } from './Icon';
import { PixelSprite } from './PixelSprite';

const sectionLinks = [
  { href: '#como-funciona', label: 'Como funciona' },
  { href: '#perguntas', label: 'Perguntas' },
  { href: '#contribuir', label: 'Contribuir' },
] as const;

export function LandingLayout({ children }: { children: ReactNode }) {
  return (
    <div className="app app--landing">
      <header className="hud pixel-box">
        <Link to="/" className="brand">
          <PixelSprite name="tv" size={30} />
          <span>Transmitir tela</span>
        </Link>
        <nav className="hud__nav" aria-label="Principal">
          {sectionLinks.map((link) => (
            <a key={link.href} className="hud__link" href={link.href}>
              {link.label}
            </a>
          ))}
          <a className="btn btn--accent btn--sm" href={REPOSITORY_URL}>
            <Icon name="code" />
            <span>GitHub</span>
          </a>
        </nav>
      </header>
      <main>{children}</main>
      <footer className="site-footer">
        <span className="site-footer__brand">Transmitir tela</span>
        <p>Vídeo direto entre navegadores, sem cadastro e sem instalar nada.</p>
      </footer>
    </div>
  );
}

interface LayoutProps {
  width?: 'narrow' | 'wide';
  // Room pages fill the window exactly: the stage shrinks to fit and the page never scrolls.
  fill?: boolean;
  children: ReactNode;
}

export function Layout({ width = 'wide', fill = false, children }: LayoutProps) {
  return (
    <div className={fill ? 'app app--room' : 'app'}>
      <main className={`container container--${width}`}>{children}</main>
    </div>
  );
}
