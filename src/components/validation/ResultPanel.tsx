import { ValidationChecklistItem, ValidationResult } from '../../types/validation';
import ValidationChecklist from './ValidationChecklist';
import ValidationSummary from './ValidationSummary';

interface ResultPanelProps {
  result: ValidationResult;
  onReset: () => void;
}

const buildChecklist = (result: ValidationResult): ValidationChecklistItem[] => {
  return [
    {
      id: 'invoice_document_valid',
      label: 'Factura corresponde al tipo esperado',
      valid: result.invoice_document_valid
    },
    {
      id: 'certificate_document_valid',
      label: 'Certificado de origen corresponde al tipo esperado',
      valid: result.certificate_document_valid
    },
    {
      id: 'photo_plate_valid',
      label: 'Fotoplaca corresponde al tipo esperado',
      valid: result.photo_plate_valid
    },
    {
      id: 'photo_serial_valid',
      label: 'Fotoserial corresponde al tipo esperado',
      valid: result.photo_serial_valid
    },
    {
      id: 'plate_match',
      label: 'Coincidencia de placa en expediente',
      valid: result.plate_match
    },
    {
      id: 'serial_match',
      label: 'Coincidencia de serial en expediente',
      valid: result.serial_match
    }
  ];
};

const ResultPanel = ({ result, onReset }: ResultPanelProps) => {
  const checklist = buildChecklist(result);
  const canContinue = result.overall_status === 'validated';
  const needsManualReview = result.overall_status !== 'validated';

  return (
    <section className="space-y-4">
      <ValidationSummary result={result} />
      <ValidationChecklist items={checklist} />

      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-soft">
        <h3 className="font-display text-lg font-bold text-glik-secondary">Mensajes de validación</h3>
        <ul className="mt-4 space-y-2 text-sm text-slate-700">
          {result.messages.map((message, index) => (
            <li key={`${message}-${index}`} className="rounded-xl bg-slate-50 p-3">
              {message}
            </li>
          ))}
        </ul>

        <div className="mt-6 flex flex-wrap gap-2">
          <button type="button" className="btn-secondary" onClick={onReset}>
            Revisar nuevamente
          </button>
          <button
            type="button"
            className={`btn-primary ${canContinue ? '' : 'cursor-not-allowed opacity-50'}`}
            disabled={!canContinue}
          >
            Continuar
          </button>
          {needsManualReview ? (
            <button type="button" className="btn-primary bg-rose-600 hover:bg-rose-700">
              Derivar a revisión manual
            </button>
          ) : null}
        </div>
      </div>
    </section>
  );
};

export default ResultPanel;
