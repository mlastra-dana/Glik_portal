import { Link } from 'react-router-dom';

const HeroSection = () => {
  return (
    <section className="relative overflow-hidden bg-hero-mesh">
      <div className="container-app py-20 sm:py-24 lg:py-28">
        <div className="max-w-3xl text-white">
          <p className="inline-flex rounded-full border border-white/25 bg-white/10 px-4 py-1 text-xs font-semibold uppercase tracking-widest">
            Solución documental para movilidad
          </p>
          <h1 className="mt-6 font-display text-4xl font-bold leading-tight sm:text-5xl">
            Valida expedientes de motocicletas con criterio comercial y control operativo.
          </h1>
          <p className="mt-5 max-w-2xl text-base text-blue-100 sm:text-lg">
            Un portal moderno para cargar documentos, comprobar coherencia de expediente y acelerar decisiones de aprobación.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link to="/validation" className="btn-primary bg-glik-accent hover:bg-orange-500">
              Iniciar validación
            </Link>
            <a href="#como-funciona" className="btn-secondary border-white/40 bg-white/10 text-white hover:border-white hover:text-white">
              Ver cómo funciona
            </a>
          </div>
        </div>
      </div>
    </section>
  );
};

export default HeroSection;
