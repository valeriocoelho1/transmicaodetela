import type { ReactNode } from 'react';
import { Link } from 'react-router';
import { REPOSITORY_URL } from '../config';
import { Icon } from './Icon';

interface LayoutProps {
  width?: 'narrow' | 'wide' | 'landing';
  dark?: boolean;
  children: ReactNode;
}

const sectionLinks = [
  { href: '#como-funciona', label: 'Como funciona' },
  { href: '#perguntas', label: 'Perguntas' },
  { href: '#contribuir', label: 'Contribuir' },
];

export function Layout({ width = 'wide', dark = false, children }: LayoutProps) {
  const landing = width === 'landing';
  const classes = ['app', (dark || landing) && 'app--dark', landing && 'app--landing']
    .filter(Boolean)
    .join(' ');
  return (
    <div className={classes}>
      <header className="site-header">
        <div className="site-header__inner">
          <Link to="/" className="brand">
            <span className="brand__mark">
              <Icon name="screen" size={18} />
            </span>
            <span className="brand__name">Compartilhar tela</span>
          </Link>
          {(dark || landing) && (
            <nav className="site-nav" aria-label="Principal">
              {landing &&
                sectionLinks.map((link) => (
                  <a key={link.href} className="site-nav__link" href={link.href}>
                    {link.label}
                  </a>
                ))}
              <a className="site-nav__repo" href={REPOSITORY_URL}>
                <Icon name="code" size={18} />
                <span>GitHub</span>
              </a>
            </nav>
          )}
        </div>
      </header>
      <main className={`container container--${width}`}>{children}</main>
      <footer className="site-footer">
        <p>Vídeo direto entre navegadores, sem cadastro e sem instalar nada.</p>
      </footer>
    </div>
  );
}
