import { flowSteps } from '../../data/homeContent';

const HowItWorksSection = () => {
  return (
    <section id="como-funciona" className="bg-white py-14 sm:py-16">
      <div className="container-app">
        <h2 className="section-title">Cómo funciona</h2>
        <p className="section-subtitle">
          Un proceso simple para equipos comerciales, operativos y de riesgo con foco en motocicletas.
        </p>

        <div className="mt-8 grid gap-4 md:grid-cols-3">
          {flowSteps.map((step) => (
            <article key={step.title} className="rounded-2xl bg-glik-light p-6 shadow-soft">
              <h3 className="font-display text-lg font-bold text-glik-secondary">{step.title}</h3>
              <p className="mt-3 text-sm text-slate-600">{step.description}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
};

export default HowItWorksSection;
