import { benefits } from '../../data/homeContent';

const BenefitsSection = () => {
  return (
    <section className="container-app py-14 sm:py-16">
      <h2 className="section-title">¿Por qué GLIK para validación documental?</h2>
      <p className="section-subtitle">
        Diseñado para operaciones de movilidad donde cada expediente requiere precisión, trazabilidad y rapidez.
      </p>
      <div className="mt-8 grid gap-4 md:grid-cols-3">
        {benefits.map((benefit) => (
          <article
            key={benefit.title}
            className="rounded-2xl border border-slate-200 bg-white p-6 shadow-soft transition hover:-translate-y-1"
          >
            <h3 className="font-display text-xl font-bold text-glik-secondary">{benefit.title}</h3>
            <p className="mt-3 text-sm leading-relaxed text-slate-600">{benefit.description}</p>
          </article>
        ))}
      </div>
    </section>
  );
};

export default BenefitsSection;
