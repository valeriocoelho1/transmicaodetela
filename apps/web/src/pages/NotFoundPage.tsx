import { Link } from 'react-router';
import { Layout } from '../components/Layout';

export function NotFoundPage() {
  return (
    <Layout>
      <h1>Compartilhar tela</h1>
      <p aria-live="polite">Página não encontrada.</p>
      <p>
        <Link to="/">Criar sala</Link>
      </p>
    </Layout>
  );
}
