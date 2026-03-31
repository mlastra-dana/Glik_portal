import { Link, NavLink, useLocation } from 'react-router-dom';

const navLinks = [
  { label: 'Inicio', path: '/' },
  { label: 'Portal de validación', path: '/validation' },
  { label: 'Ayuda', path: '/#ayuda' }
];

const Header = () => {
  const location = useLocation();

  return (
    <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/95 backdrop-blur">
      <div className="container-app flex h-16 items-center justify-between gap-3">
        <Link to="/" className="flex items-center gap-3" aria-label="Ir al inicio">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-glik-primary text-sm font-bold text-white">
            GL
          </div>
          <div>
            <p className="font-display text-base font-bold text-glik-secondary">GLIK Portal</p>
            <p className="text-[11px] text-slate-500">Validación documental</p>
          </div>
        </Link>

        <nav className="hidden items-center gap-5 md:flex">
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
