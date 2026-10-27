import { Link } from 'react-router';
import { Icon } from '../components/Icon';
import { Layout } from '../components/Layout';
import { StateMessage } from '../components/StateMessage';

export function NotFoundPage() {
  return (
    <Layout width="narrow">
      <h1 className="page-title">Transmitir tela</h1>
      <div className="card">
        <StateMessage icon="alert" message="Página não encontrada.">
          <Link className="btn btn--primary" to="/">
            <Icon name="play" />
            <span>Criar sala</span>
          </Link>
        </StateMessage>
      </div>
    </Layout>
  );
}
