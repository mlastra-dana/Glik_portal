import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import ProcessStepper from '../components/validation/ProcessStepper';
import ResultPanel from '../components/validation/ResultPanel';
import UploadCard from '../components/validation/UploadCard';
import EmptyState from '../components/ui/EmptyState';
import { documentSlotsSeed } from '../mocks/documents';
import { buildValidationResultFromSlots, validateDocumentSlot } from '../services/validationClient';
import { SlotValidationResult, UploadedDocument, ValidationResult } from '../types/validation';

const resetDocument = (doc: UploadedDocument): UploadedDocument => ({
  ...doc,
  file: null,
  fileName: null,
  status: 'pending',
  errorMessage: null
});

const ValidationPortalPage = () => {
  const [documents, setDocuments] = useState<UploadedDocument[]>(documentSlotsSeed);
  const [validatingSlots, setValidatingSlots] = useState<Record<UploadedDocument['type'], boolean>>({
    invoice: false,
    certificate_of_origin: false,
    photo_plate: false,
    photo_serial: false
  });
  const [hasValidationAttempt, setHasValidationAttempt] = useState(false);
  const [result, setResult] = useState<ValidationResult | null>(null);
  const [slotResults, setSlotResults] = useState<Partial<Record<UploadedDocument['type'], SlotValidationResult>>>({});
  const [validationError, setValidationError] = useState<string | null>(null);
  const hasAnyDocument = documents.some((document) => Boolean(document.file));
  const hasAllRequiredDocuments = documents.every((document) => Boolean(document.file && slotResults[document.type]));
  const isValidating = Object.values(validatingSlots).some(Boolean);

  const currentStep: 1 | 2 | 3 = result ? 3 : hasValidationAttempt || isValidating ? 2 : 1;

  const handleSelectFile = async (type: UploadedDocument['type'], file: File) => {
    setValidationError(null);
    setResult(null);
    setHasValidationAttempt(true);
    setSlotResults((prev) => {
      const next = { ...prev };
      delete next[type];
      return next;
    });

    setDocuments((prev) =>
      prev.map((doc) =>
        doc.type === type
          ? {
              ...doc,
              file,
              fileName: file.name,
              status: 'uploaded',
              errorMessage: null
            }
          : doc
      )
    );

    setValidatingSlots((prev) => ({
      ...prev,
      [type]: true
    }));

    try {
      const slotResult = await validateDocumentSlot(type, file, file.name);
      setSlotResults((prev) => ({
        ...prev,
        [type]: slotResult
      }));
      setDocuments((prev) =>
        prev.map((doc) =>
          doc.type === type
            ? {
                ...doc,
                status: slotResult.document_valid ? 'validated' : 'error',
                errorMessage: slotResult.document_valid ? null : slotResult.reason ?? 'Documento inválido.'
              }
            : doc
        )
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Error no controlado';
      setValidationError(message);
      setDocuments((prev) =>
        prev.map((doc) =>
          doc.type === type
            ? {
                ...doc,
                status: 'error',
                errorMessage: message
              }
            : doc
        )
      );
    } finally {
      setValidatingSlots((prev) => ({
        ...prev,
        [type]: false
      }));
    }
  };

  const handleClearFile = (type: UploadedDocument['type']) => {
    setValidationError(null);
    setResult(null);
    setSlotResults((prev) => {
      const next = { ...prev };
      delete next[type];
      return next;
    });
    setDocuments((prev) => prev.map((doc) => (doc.type === type ? resetDocument(doc) : doc)));
  };

  const handleResetFlow = () => {
    setValidationError(null);
    setResult(null);
    setHasValidationAttempt(false);
    setSlotResults({});
    setDocuments((prev) => prev.map((doc) => resetDocument(doc)));
  };

  useEffect(() => {
    if (!hasAllRequiredDocuments || isValidating) {
      return;
    }
    setResult(buildValidationResultFromSlots(slotResults));
  }, [hasAllRequiredDocuments, isValidating, slotResults]);

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
        <div className="grid gap-4 md:grid-cols-2">
          {documents.map((document) => (
            <UploadCard
              key={document.type}
              document={document}
              onSelectFile={handleSelectFile}
              onClear={handleClearFile}
              isValidating={validatingSlots[document.type]}
            />
          ))}
        </div>

        {validationError ? (
          <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            Error de validación: {validationError}
          </div>
        ) : null}

        {!isValidating && !result ? (
          <EmptyState
            title="Resultado pendiente"
            description={
              hasAnyDocument
                ? 'Cada documento se valida al cargar. Al completar los 4 soportes se mostrará el resultado consolidado.'
                : 'Cargue los soportes para iniciar validación documental en línea.'
            }
          />
        ) : null}
        {!isValidating && result ? <ResultPanel result={result} onReset={handleResetFlow} /> : null}
      </div>
    </section>
  );
};

export default ValidationPortalPage;
