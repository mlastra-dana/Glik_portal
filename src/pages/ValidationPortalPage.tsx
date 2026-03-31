import { useMemo, useState } from 'react';
import ResultPanel from '../components/validation/ResultPanel';
import UploadCard from '../components/validation/UploadCard';
import EmptyState from '../components/ui/EmptyState';
import LoadingState from '../components/ui/LoadingState';
import { documentSlotsSeed } from '../mocks/documents';
import { runMockValidation } from '../mocks/validation';
import { UploadedDocument, ValidationResult } from '../types/validation';

const resetDocument = (doc: UploadedDocument): UploadedDocument => ({
  ...doc,
  file: null,
  fileName: null,
  status: 'pending'
});

const ValidationPortalPage = () => {
  const [documents, setDocuments] = useState<UploadedDocument[]>(documentSlotsSeed);
  const [isValidating, setIsValidating] = useState(false);
  const [result, setResult] = useState<ValidationResult | null>(null);

  const uploadedCount = useMemo(
    () => documents.filter((document) => Boolean(document.file)).length,
    [documents]
  );

  const isReadyForValidation = documents.every((document) => document.file);

  const handleSelectFile = (type: UploadedDocument['type'], file: File) => {
    setResult(null);
    setDocuments((prev) =>
      prev.map((doc) =>
        doc.type === type
          ? {
              ...doc,
              file,
              fileName: file.name,
              status: 'uploaded'
            }
          : doc
      )
    );
  };

  const handleClearFile = (type: UploadedDocument['type']) => {
    setResult(null);
    setDocuments((prev) => prev.map((doc) => (doc.type === type ? resetDocument(doc) : doc)));
  };

  const handleValidate = async () => {
    if (!isReadyForValidation) {
      return;
    }

    setIsValidating(true);
    const validationResult = await runMockValidation(documents);
    setResult(validationResult);

    setDocuments((prev) =>
      prev.map((doc) => {
        const hasErrors =
          (doc.type === 'invoice' && !validationResult.invoice_document_valid) ||
          (doc.type === 'certificate_of_origin' && !validationResult.certificate_document_valid) ||
          (doc.type === 'photo_plate' && !validationResult.photo_plate_valid) ||
          (doc.type === 'photo_serial' && !validationResult.photo_serial_valid);

        return {
          ...doc,
          status: hasErrors ? 'error' : 'validated'
        };
      })
    );

    setIsValidating(false);
  };

  const handleResetFlow = () => {
    setResult(null);
    setDocuments((prev) => prev.map((doc) => resetDocument(doc)));
  };

  return (
    <section className="container-app py-10 sm:py-12">
      <div className="rounded-3xl border border-slate-200 bg-white p-7 shadow-soft sm:p-8">
        <p className="text-xs font-semibold uppercase tracking-widest text-glik-primary">Expediente activo</p>
        <h1 className="mt-2 font-display text-3xl font-bold text-glik-secondary">
          Validación documental de motocicleta
        </h1>
        <p className="mt-3 max-w-3xl text-sm text-slate-600">
          Carga y valida los cuatro soportes obligatorios: factura, certificado de origen, fotoplaca y fotoserial.
          El resultado simula verificación de tipo documental y consistencia de expediente.
        </p>

        <div className="mt-6 flex flex-wrap items-center gap-3 rounded-2xl bg-glik-light p-4">
          <p className="text-sm font-medium text-slate-700">
            Documentos cargados: <span className="font-bold">{uploadedCount}/4</span>
          </p>
          <button
            type="button"
            className={`btn-primary ${isReadyForValidation && !isValidating ? '' : 'cursor-not-allowed opacity-60'}`}
            onClick={handleValidate}
            disabled={!isReadyForValidation || isValidating}
          >
            Validar expediente
          </button>
          <button type="button" className="btn-secondary" onClick={handleResetFlow}>
            Reiniciar
          </button>
        </div>
      </div>

      <div className="mt-6 grid gap-4 md:grid-cols-2">
        {documents.map((document) => (
          <UploadCard
            key={document.type}
            document={document}
            onSelectFile={handleSelectFile}
            onClear={handleClearFile}
          />
        ))}
      </div>

      <div className="mt-6">
        {isValidating ? <LoadingState /> : null}
        {!isValidating && !result ? (
          <EmptyState
            title="Sin resultados todavía"
            description="Carga los 4 documentos y ejecuta la validación para visualizar el resumen del expediente y sus reglas de consistencia."
          />
        ) : null}
        {!isValidating && result ? <ResultPanel result={result} onReset={handleResetFlow} /> : null}
      </div>
    </section>
  );
};

export default ValidationPortalPage;
