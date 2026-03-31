import { Link, NavLink, useLocation } from 'react-router-dom';
import logoGlik from '../../assets/logo-glik.png';

const navLinks = [
  { label: 'Inicio', path: '/' },
  { label: 'Portal de validación', path: '/validation' },
  { label: 'Ayuda', path: '/#ayuda' }
];

const Header = () => {
  const location = useLocation();

  return (
    <header className="sticky top-0 z-40 border-b border-white/10 bg-glik-primary text-white backdrop-blur">
      <div className="container-app flex h-16 items-center justify-between gap-3">
        <Link to="/" className="flex items-center gap-3" aria-label="Ir al inicio">
          <img src={logoGlik} alt="GLIK" className="h-8 w-auto sm:h-9" />
          <span className="hidden text-xs text-purple-100 sm:inline">Portal de validación documental</span>
        </Link>

        <nav className="hidden items-center gap-5 md:flex">
          {navLinks.map((link) => {
            if (link.path.includes('#')) {
              return (
                <a
                  key={link.label}
                  href={link.path}
                  className="text-sm font-semibold text-purple-100 hover:text-white"
                >
                  {link.label}
                </a>
              );
            }

            return (
              <NavLink
                key={link.label}
                to={link.path}
                className={({ isActive }) =>
                  `text-sm font-semibold ${isActive ? 'text-white' : 'text-purple-100 hover:text-white'}`
                }
              >
                {link.label}
              </NavLink>
            );
          })}
        </nav>

        <Link
          to="/validation"
          className="btn-primary px-4 py-2"
          aria-current={location.pathname === '/validation' ? 'page' : undefined}
        >
          Iniciar validación
        </Link>
      </div>
    </header>
  );
};

export default Header;
