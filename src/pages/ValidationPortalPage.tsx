import { useMemo, useState } from 'react';
import ExpeditionDashboard from '../components/validation/ExpeditionDashboard';
import ProcessStepper from '../components/validation/ProcessStepper';
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
  const [hasValidationAttempt, setHasValidationAttempt] = useState(false);
  const [result, setResult] = useState<ValidationResult | null>(null);

  const uploadedCount = useMemo(
    () => documents.filter((document) => Boolean(document.file)).length,
    [documents]
  );

  const isReadyForValidation = documents.every((document) => document.file);

  const currentStep: 1 | 2 | 3 = result ? 3 : hasValidationAttempt || isValidating ? 2 : 1;

  const handleSelectFile = (type: UploadedDocument['type'], file: File) => {
    setResult(null);
    setHasValidationAttempt(false);

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
    setHasValidationAttempt(false);
    setDocuments((prev) => prev.map((doc) => (doc.type === type ? resetDocument(doc) : doc)));
  };

  const handleValidate = async () => {
    if (!isReadyForValidation) {
      return;
    }

    setHasValidationAttempt(true);
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
    setHasValidationAttempt(false);
    setDocuments((prev) => prev.map((doc) => resetDocument(doc)));
  };

  return (
    <section className="container-app py-8 sm:py-10">
      <div className="space-y-4">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-soft">
          <p className="text-xs font-semibold uppercase tracking-wide text-glik-primary">Expediente activo</p>
          <h1 className="mt-1 font-display text-2xl font-bold text-glik-secondary sm:text-3xl">
            Validación documental de motocicleta
          </h1>
          <p className="mt-2 max-w-3xl text-sm text-slate-600">
            Cargue los documentos requeridos para validar el expediente. El sistema verificará que factura,
            certificado de origen, fotoplaca y fotoserial correspondan al mismo caso.
          </p>
        </div>

        <ProcessStepper currentStep={currentStep} />
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-[minmax(0,2fr),minmax(320px,1fr)]">
        <div className="space-y-5">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-soft">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 className="text-base font-bold text-glik-secondary">Carga de documentos</h2>
                <p className="text-sm text-slate-600">Documentos cargados: {uploadedCount}/4</p>
              </div>
              <div className="flex flex-wrap gap-2">
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

            <p className="mt-3 text-sm text-slate-600">
              Si la validación falla, el expediente deberá pasar a revisión manual.
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            {documents.map((document) => (
              <UploadCard
                key={document.type}
                document={document}
                onSelectFile={handleSelectFile}
                onClear={handleClearFile}
              />
            ))}
          </div>

          {isValidating ? <LoadingState /> : null}
          {!isValidating && !result ? (
            <EmptyState
              title="Resultado pendiente"
              description="Complete la carga de los cuatro documentos y pulse “Validar expediente” para generar el resultado de control."
            />
          ) : null}
          {!isValidating && result ? <ResultPanel result={result} onReset={handleResetFlow} /> : null}
        </div>

        <ExpeditionDashboard documents={documents} result={result} isValidating={isValidating} />
      </div>
    </section>
  );
};

export default ValidationPortalPage;
