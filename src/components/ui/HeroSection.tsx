import { Link } from 'react-router-dom';

const HeroSection = () => {
  return (
    <section className="container-app py-6 sm:py-8">
      <div className="overflow-hidden rounded-2xl border border-white/15 bg-glik-primary shadow-card">
        <div className="grid min-h-[420px] lg:grid-cols-[220px,1fr]">
          <div className="hidden bg-glik-primary/55 lg:block" />

          <div className="bg-hero-mesh px-6 py-10 sm:px-10 sm:py-12">
            <div className="max-w-3xl">
              <div className="mb-5 h-1.5 w-20 rounded-full bg-glik-accent/90" />
              <p className="text-xs font-semibold uppercase tracking-wide text-purple-200">
                Módulo operativo logístico
              </p>
              <h1 className="mt-3 font-display text-3xl font-bold leading-tight text-white sm:text-4xl">
                Validación Logística
              </h1>
              <p className="mt-4 max-w-2xl text-sm text-purple-100 sm:text-base">
                Cargue soportes y valide consistencia documental para operación logística.
              </p>

              <div className="mt-7">
                <Link to="/validation" className="btn-primary">
                  Ingresar al módulo
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default HeroSection;
