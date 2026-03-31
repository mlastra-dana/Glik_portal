import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import ProcessStepper from '../components/validation/ProcessStepper';
import ResultPanel from '../components/validation/ResultPanel';
import UploadCard from '../components/validation/UploadCard';
import EmptyState from '../components/ui/EmptyState';
import LoadingState from '../components/ui/LoadingState';
import { documentSlotsSeed, expectedDocumentTypeHints } from '../mocks/documents';
import { runMockValidation } from '../mocks/validation';
import { UploadedDocument, ValidationResult } from '../types/validation';

const resetDocument = (doc: UploadedDocument): UploadedDocument => ({
  ...doc,
  file: null,
  fileName: null,
  status: 'pending'
});

const normalize = (value: string) => value.toLowerCase().trim();

const matchesExpectedType = (type: UploadedDocument['type'], fileName: string) => {
  const hints = expectedDocumentTypeHints[type];
  const normalizedName = normalize(fileName);
  return hints.some((hint) => normalizedName.includes(hint));
};

const ValidationPortalPage = () => {
  const [documents, setDocuments] = useState<UploadedDocument[]>(documentSlotsSeed);
  const [isValidating, setIsValidating] = useState(false);
  const [hasValidationAttempt, setHasValidationAttempt] = useState(false);
  const [result, setResult] = useState<ValidationResult | null>(null);
  const [lastValidationSignature, setLastValidationSignature] = useState('');

  const uploadedCount = useMemo(
    () => documents.filter((document) => Boolean(document.file)).length,
    [documents]
  );

  const isReadyForValidation = documents.every((document) => document.file);
  const validationSignature = documents.map((document) => document.fileName ?? '').join('|');

  const currentStep: 1 | 2 | 3 = result ? 3 : hasValidationAttempt || isValidating ? 2 : 1;

  const handleSelectFile = (type: UploadedDocument['type'], file: File) => {
    setResult(null);
    setHasValidationAttempt(false);
    setLastValidationSignature('');

    setDocuments((prev) =>
      prev.map((doc) =>
        doc.type === type
          ? {
              ...doc,
              file,
              fileName: file.name,
              status: matchesExpectedType(type, file.name) ? 'validated' : 'error'
            }
          : doc
      )
    );
  };

  const handleClearFile = (type: UploadedDocument['type']) => {
    setResult(null);
    setHasValidationAttempt(false);
    setLastValidationSignature('');
    setDocuments((prev) => prev.map((doc) => (doc.type === type ? resetDocument(doc) : doc)));
  };

  const handleResetFlow = () => {
    setResult(null);
    setHasValidationAttempt(false);
    setLastValidationSignature('');
    setDocuments((prev) => prev.map((doc) => resetDocument(doc)));
  };

  useEffect(() => {
    let isMounted = true;

    const validateAutomatically = async () => {
      if (!isReadyForValidation || isValidating || validationSignature === lastValidationSignature) {
        return;
      }

      setHasValidationAttempt(true);
      setIsValidating(true);

      const validationResult = await runMockValidation(documents);
      if (!isMounted) {
        return;
      }

      setResult(validationResult);
      setLastValidationSignature(validationSignature);
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

    void validateAutomatically();

    return () => {
      isMounted = false;
    };
  }, [documents, isReadyForValidation, isValidating, lastValidationSignature, validationSignature]);

  return (
    <section className="container-app py-8 sm:py-10">
      <div className="space-y-4">
        <div className="flex items-start justify-between gap-3 px-1">
          <div>
            <h1 className="font-display text-xl font-bold text-white sm:text-2xl">
              Validación logística de expediente
            </h1>
            <p className="mt-1 text-sm text-purple-100">
              Cargue soportes de unidad y valide consistencia documental para despacho o recepción.
            </p>
          </div>
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-xl bg-glik-accent px-4 py-2 text-sm font-semibold text-white transition hover:bg-orange-600"
          >
            Salir
          </Link>
        </div>

        <ProcessStepper currentStep={currentStep} />
      </div>

      <div className="mt-5 space-y-5">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-soft">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 className="text-base font-bold text-glik-secondary">Carga documental logística</h2>
                <p className="text-sm text-slate-600">Soportes cargados: {uploadedCount}/4</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button type="button" className="btn-secondary" onClick={handleResetFlow}>
                  Limpiar carga
                </button>
              </div>
            </div>

            <p className="mt-3 text-sm text-slate-600">
              La validación se ejecuta automáticamente al cargar los documentos.
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
            description="Cargue los 4 soportes y el sistema generará el resultado logístico automáticamente."
          />
        ) : null}
        {!isValidating && result ? <ResultPanel result={result} onReset={handleResetFlow} /> : null}
      </div>
    </section>
  );
};

export default ValidationPortalPage;
