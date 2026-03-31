import { ValidationResult } from '../../types/validation';
import StatusBadge from '../ui/StatusBadge';

interface ValidationSummaryProps {
  result: ValidationResult;
}

const ValidationSummary = ({ result }: ValidationSummaryProps) => {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-soft">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="font-display text-lg font-bold text-glik-secondary">Resumen del expediente</h3>
          <p className="mt-1 text-sm text-slate-600">Consolidado de tipo documental y consistencia cruzada.</p>
        </div>
        <StatusBadge status={result.overall_status} />
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        <div className="rounded-xl bg-slate-50 p-4 text-sm text-slate-700">
          <p className="font-semibold">Validación por tipo</p>
          <p className="mt-2">Factura: {result.invoice_document_valid ? 'Correcta' : 'Incorrecta'}</p>
          <p>Certificado: {result.certificate_document_valid ? 'Correcto' : 'Incorrecto'}</p>
          <p>Fotoplaca: {result.photo_plate_valid ? 'Correcta' : 'Incorrecta'}</p>
          <p>Fotoserial: {result.photo_serial_valid ? 'Correcta' : 'Incorrecta'}</p>
        </div>
        <div className="rounded-xl bg-slate-50 p-4 text-sm text-slate-700">
          <p className="font-semibold">Coincidencia del expediente</p>
          <p className="mt-2">Placa: {result.plate_match ? 'Coincide' : 'No coincide'}</p>
          <p>Serial: {result.serial_match ? 'Coincide' : 'No coincide'}</p>
        </div>
      </div>
    </div>
  );
};

export default ValidationSummary;
