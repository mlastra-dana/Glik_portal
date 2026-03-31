const Footer = () => {
  return (
    <footer className="mt-10 border-t border-slate-200 bg-white">
      <div className="container-app flex flex-col items-start justify-between gap-3 py-5 text-xs text-slate-500 sm:flex-row sm:items-center">
        <p>© {new Date().getFullYear()} GLIK. Portal de validación documental.</p>
        <p>Ambiente de operación interna y aliados.</p>
      </div>
    </footer>
  );
};

export default Footer;
