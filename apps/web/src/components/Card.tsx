import type { ReactNode } from 'react';

interface CardProps {
  title?: string;
  className?: string;
  children: ReactNode;
}

export function Card({ title, className, children }: CardProps) {
  return (
    <section className={['card', className].filter(Boolean).join(' ')}>
      {title && <h2 className="card__title">{title}</h2>}
      {children}
    </section>
  );
}
