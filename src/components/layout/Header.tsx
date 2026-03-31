import { Link } from 'react-router-dom';
import logoGlik from '../../assets/logo-glik.png';

const Header = () => {
  return (
    <header className="sticky top-0 z-40 border-b border-white/10 bg-glik-primary text-white backdrop-blur">
      <div className="container-app flex h-16 items-center">
        <Link to="/" className="flex items-center" aria-label="Ir al inicio">
          <img src={logoGlik} alt="GLIK" className="h-8 w-auto sm:h-9" />
        </Link>
      </div>
    </header>
  );
};

export default Header;
