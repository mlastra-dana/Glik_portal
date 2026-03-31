import { Link, NavLink, useLocation } from 'react-router-dom';

const navLinks = [
  { label: 'Inicio', path: '/' },
  { label: 'Validación documental', path: '/validation' },
  { label: 'Cómo funciona', path: '/#como-funciona' },
  { label: 'Preguntas frecuentes', path: '/#faq' },
  { label: 'Contacto', path: '/#contacto' }
];

const Header = () => {
  const location = useLocation();

  return (
    <header className="sticky top-0 z-40 border-b border-slate-200/70 bg-white/95 backdrop-blur">
      <div className="container-app flex h-20 items-center justify-between gap-3">
        <Link to="/" className="flex items-center gap-3" aria-label="Ir al inicio">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-glik-primary text-lg font-bold text-white">
            G
          </div>
          <div>
            <p className="font-display text-lg font-bold text-glik-secondary">GLIK Portal</p>
            <p className="text-xs text-slate-500">Validación documental de motos</p>
          </div>
        </Link>

        <nav className="hidden items-center gap-6 lg:flex">
          {navLinks.map((link) => {
            if (link.path.includes('#')) {
              return (
                <a
                  key={link.label}
                  href={link.path}
                  className="text-sm font-semibold text-slate-600 hover:text-glik-primary"
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
                  `text-sm font-semibold ${isActive ? 'text-glik-primary' : 'text-slate-600 hover:text-glik-primary'}`
                }
              >
                {link.label}
              </NavLink>
            );
          })}
        </nav>

        <Link
          to="/validation"
          className="btn-primary px-4 py-2.5"
          aria-current={location.pathname === '/validation' ? 'page' : undefined}
        >
          Validar expediente
        </Link>
      </div>
    </header>
  );
};

export default Header;
