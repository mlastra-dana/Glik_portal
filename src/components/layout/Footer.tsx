const Footer = () => {
  return (
    <footer id="contacto" className="border-t border-slate-200 bg-white">
      <div className="container-app grid gap-8 py-10 md:grid-cols-3">
        <div>
          <h3 className="font-display text-lg font-bold text-glik-secondary">GLIK Portal</h3>
          <p className="mt-3 text-sm text-slate-600">
            Plataforma de validación documental para operaciones de movilidad y expedientes de motocicletas.
          </p>
        </div>
        <div>
          <h4 className="text-sm font-bold uppercase tracking-wide text-slate-700">Contacto</h4>
          <ul className="mt-3 space-y-2 text-sm text-slate-600">
            <li>comercial@glik7.com</li>
            <li>+58 212 000 0000</li>
            <li>Caracas, Venezuela</li>
          </ul>
        </div>
        <div>
          <h4 className="text-sm font-bold uppercase tracking-wide text-slate-700">Portal</h4>
          <p className="mt-3 text-sm text-slate-600">
            Diseñado para crecer hacia integraciones reales de OCR, reglas de negocio y trazabilidad por lote.
          </p>
        </div>
      </div>
      <div className="border-t border-slate-200 py-4 text-center text-xs text-slate-500">
        © {new Date().getFullYear()} GLIK. Todos los derechos reservados.
      </div>
    </footer>
  );
};

export default Footer;
