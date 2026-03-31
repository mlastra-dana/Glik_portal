interface ProcessStepperProps {
  currentStep: 1 | 2 | 3;
}

const steps = [
  { id: 1, label: 'Cargar documentos' },
  { id: 2, label: 'Validar expediente' },
  { id: 3, label: 'Revisar resultado' }
] as const;

const ProcessStepper = ({ currentStep }: ProcessStepperProps) => {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-soft sm:p-5">
      <ol className="grid gap-3 md:grid-cols-3">
        {steps.map((step) => {
          const isCompleted = currentStep > step.id;
          const isActive = currentStep === step.id;

          return (
            <li key={step.id} className="flex items-center gap-3 rounded-xl bg-slate-50 p-3">
              <span
                className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold ${
                  isCompleted
                    ? 'bg-emerald-100 text-emerald-700'
                    : isActive
                      ? 'bg-purple-100 text-glik-primary'
                      : 'bg-slate-200 text-slate-600'
                }`}
              >
                {step.id}
              </span>
              <div>
                <p className="text-sm font-semibold text-slate-800">{step.label}</p>
                <p className="text-xs text-slate-500">
                  {isCompleted ? 'Completado' : isActive ? 'En curso' : 'Pendiente'}
                </p>
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
};

export default ProcessStepper;
