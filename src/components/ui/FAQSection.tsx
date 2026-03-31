import { faqs } from '../../data/homeContent';

const FAQSection = () => {
  return (
    <section id="faq" className="container-app py-14 sm:py-16">
      <h2 className="section-title">Preguntas frecuentes</h2>
      <div className="mt-8 space-y-3">
        {faqs.map((faq) => (
          <details key={faq.question} className="rounded-xl border border-slate-200 bg-white p-5 shadow-soft">
            <summary className="cursor-pointer list-none font-semibold text-glik-secondary">{faq.question}</summary>
            <p className="mt-3 text-sm text-slate-600">{faq.answer}</p>
          </details>
        ))}
      </div>
    </section>
  );
};

export default FAQSection;
