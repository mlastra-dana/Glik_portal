import { Link } from 'react-router-dom';

const HeroSection = () => {
  return (
    <section className="container-app pt-8 sm:pt-10">
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-soft sm:p-8">
        <p className="text-xs font-semibold uppercase tracking-wide text-glik-primary">Portal operativo</p>
        <h1 className="mt-2 font-display text-3xl font-bold text-glik-secondary sm:text-4xl">
          Portal de validación documental
        </h1>
        <p className="mt-3 max-w-3xl text-sm text-slate-600 sm:text-base">
          Verificación de expediente de motocicleta antes de procesamiento. Cargue y valide factura,
          certificado de origen, fotoplaca y fotoserial.
        </p>

        <div className="mt-5 flex flex-wrap gap-2">
          <Link to="/validation" className="btn-primary">
            Ir al portal de validación
          </Link>
          <a href="#como-funciona" className="btn-secondary">
            Ver proceso
          </a>
        </div>
      </div>
    </section>
  );
};

export default HeroSection;
