import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import ProcessStepper from '../components/validation/ProcessStepper';
import ResultPanel from '../components/validation/ResultPanel';
import UploadCard from '../components/validation/UploadCard';
import EmptyState from '../components/ui/EmptyState';
import { documentSlotsSeed } from '../mocks/documents';
import { compareExpedient, toValidationResult, uploadDocument, validateDocuments, validateImages } from '../services/api';
import { SlotExtraction, UploadedDocumentRef } from '../types/api';
import { DocumentType, UploadedDocument, ValidationResult } from '../types/validation';

const resetDocument = (doc: UploadedDocument): UploadedDocument => ({
  ...doc,
  file: null,
  fileName: null,
  status: 'pending',
  errorMessage: null
});

const DOCUMENT_SLOTS: Array<Extract<DocumentType, 'invoice' | 'certificate_of_origin'>> = ['invoice', 'certificate_of_origin'];
const IMAGE_SLOTS: Array<Extract<DocumentType, 'photo_plate' | 'photo_serial'>> = ['photo_plate', 'photo_serial'];
const EXPEDIENT_ID = 'EXP-LOGISTICA-001';
const isDocumentSlot = (slot: DocumentType): slot is (typeof DOCUMENT_SLOTS)[number] => DOCUMENT_SLOTS.includes(slot as (typeof DOCUMENT_SLOTS)[number]);
const isImageSlot = (slot: DocumentType): slot is (typeof IMAGE_SLOTS)[number] => IMAGE_SLOTS.includes(slot as (typeof IMAGE_SLOTS)[number]);

const ValidationPortalPage = () => {
  const [documents, setDocuments] = useState<UploadedDocument[]>(documentSlotsSeed);
  const [uploadedRefs, setUploadedRefs] = useState<Partial<Record<DocumentType, UploadedDocumentRef>>>({});
  const [rawExtractions, setRawExtractions] = useState<Partial<Record<DocumentType, SlotExtraction>>>({});
  const [result, setResult] = useState<ValidationResult | null>(null);

  const [uploadingBySlot, setUploadingBySlot] = useState<Record<DocumentType, boolean>>({
    invoice: false,
    certificate_of_origin: false,
    photo_plate: false,
    photo_serial: false
  });
  const [phaseLoading, setPhaseLoading] = useState({
    validateDocuments: false,
    validateImages: false,
    compare: false
  });
  const [phaseErrors, setPhaseErrors] = useState({
    upload: '',
    validateDocuments: '',
    validateImages: '',
    compare: ''
  });
  const [phaseCompleted, setPhaseCompleted] = useState({
    validateDocuments: false,
    validateImages: false
  });

  const hasAnyDocument = documents.some((document) => Boolean(document.file));
  const isProcessing = Object.values(uploadingBySlot).some(Boolean) || Object.values(phaseLoading).some(Boolean);
  const currentStep: 1 | 2 | 3 = result ? 3 : hasAnyDocument || isProcessing ? 2 : 1;

  const canValidateDocuments = useMemo(
    () =>
      DOCUMENT_SLOTS.every((slot) => Boolean(uploadedRefs[slot])) &&
      !phaseLoading.validateDocuments &&
      !phaseLoading.compare,
    [phaseLoading.compare, phaseLoading.validateDocuments, uploadedRefs]
  );

  const canValidateImages = useMemo(
    () => IMAGE_SLOTS.every((slot) => Boolean(uploadedRefs[slot])) && !phaseLoading.validateImages && !phaseLoading.compare,
    [phaseLoading.compare, phaseLoading.validateImages, uploadedRefs]
  );

  const setDocumentStatus = (slot: DocumentType, patch: Partial<UploadedDocument>) => {
    setDocuments((prev) => prev.map((doc) => (doc.type === slot ? { ...doc, ...patch } : doc)));
  };

  const updateDocumentsFromExtractions = (extractions: Partial<Record<DocumentType, SlotExtraction>>) => {
    setDocuments((prev) =>
      prev.map((doc) => {
        const extraction = extractions[doc.type];
        if (!extraction || !doc.file) {
          return doc;
        }
        return {
          ...doc,
          status: extraction.document_valid ? 'validated' : 'error',
          errorMessage: extraction.document_valid ? null : extraction.reason ?? 'Documento inválido.'
        };
      })
    );
  };

  const handleCompareExpedient = async (mergedExtractions: Partial<Record<DocumentType, SlotExtraction>>) => {
    setPhaseLoading((prev) => ({ ...prev, compare: true }));
    setPhaseErrors((prev) => ({ ...prev, compare: '' }));
    try {
      const compareResponse = await compareExpedient(EXPEDIENT_ID, mergedExtractions);
      setResult(toValidationResult(compareResponse));
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Error no controlado en comparación.';
      setPhaseErrors((prev) => ({ ...prev, compare: message }));
      setResult(null);
    } finally {
      setPhaseLoading((prev) => ({ ...prev, compare: false }));
    }
  };

  const handleSelectFile = async (type: DocumentType, file: File) => {
    setResult(null);
    setPhaseErrors((prev) => ({ ...prev, upload: '' }));
    setPhaseCompleted((prev) => ({
      validateDocuments: isDocumentSlot(type) ? false : prev.validateDocuments,
      validateImages: isImageSlot(type) ? false : prev.validateImages
    }));

    setUploadingBySlot((prev) => ({ ...prev, [type]: true }));
    try {
      const ref = await uploadDocument(type, file);
      setUploadedRefs((prev) => ({ ...prev, [type]: ref }));
      setRawExtractions((prev) => {
        const next = { ...prev };
        delete next[type];
        return next;
      });
      setDocumentStatus(type, {
        file,
        fileName: file.name,
        status: 'uploaded',
        errorMessage: null
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Error no controlado en carga.';
      setPhaseErrors((prev) => ({ ...prev, upload: message }));
      setDocumentStatus(type, {
        file: null,
        fileName: null,
        status: 'error',
        errorMessage: message
      });
    } finally {
      setUploadingBySlot((prev) => ({ ...prev, [type]: false }));
    }
  };

  const handleClearFile = (type: DocumentType) => {
    setResult(null);
    setUploadedRefs((prev) => {
      const next = { ...prev };
      delete next[type];
      return next;
    });
    setRawExtractions((prev) => {
      const next = { ...prev };
      delete next[type];
      return next;
    });
    setPhaseCompleted((prev) => ({
      validateDocuments: isDocumentSlot(type) ? false : prev.validateDocuments,
      validateImages: isImageSlot(type) ? false : prev.validateImages
    }));
    setDocuments((prev) => prev.map((doc) => (doc.type === type ? resetDocument(doc) : doc)));
  };

  const handleValidateDocuments = async () => {
    if (!canValidateDocuments) {
      return;
    }
    setPhaseLoading((prev) => ({ ...prev, validateDocuments: true }));
    setPhaseErrors((prev) => ({ ...prev, validateDocuments: '' }));
    try {
      const response = await validateDocuments(EXPEDIENT_ID, {
        invoice: uploadedRefs.invoice as UploadedDocumentRef,
        certificate_of_origin: uploadedRefs.certificate_of_origin as UploadedDocumentRef
      });
      const phaseExtractions = response.raw_extractions ?? {};
      const mergedExtractions = { ...rawExtractions, ...phaseExtractions };
      setRawExtractions(mergedExtractions);
      updateDocumentsFromExtractions(phaseExtractions);
      setPhaseCompleted((prev) => ({ ...prev, validateDocuments: true }));
      if (phaseCompleted.validateImages) {
        await handleCompareExpedient(mergedExtractions);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Error no controlado en validación documental.';
      setPhaseErrors((prev) => ({ ...prev, validateDocuments: message }));
    } finally {
      setPhaseLoading((prev) => ({ ...prev, validateDocuments: false }));
    }
  };

  const handleValidateImages = async () => {
    if (!canValidateImages) {
      return;
    }
    setPhaseLoading((prev) => ({ ...prev, validateImages: true }));
    setPhaseErrors((prev) => ({ ...prev, validateImages: '' }));
    try {
      const response = await validateImages(EXPEDIENT_ID, {
        photo_plate: uploadedRefs.photo_plate as UploadedDocumentRef,
        photo_serial: uploadedRefs.photo_serial as UploadedDocumentRef
      });
      const phaseExtractions = response.raw_extractions ?? {};
      const mergedExtractions = { ...rawExtractions, ...phaseExtractions };
      setRawExtractions(mergedExtractions);
      updateDocumentsFromExtractions(phaseExtractions);
      setPhaseCompleted((prev) => ({ ...prev, validateImages: true }));
      if (phaseCompleted.validateDocuments) {
        await handleCompareExpedient(mergedExtractions);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Error no controlado en validación de imágenes.';
      setPhaseErrors((prev) => ({ ...prev, validateImages: message }));
    } finally {
      setPhaseLoading((prev) => ({ ...prev, validateImages: false }));
    }
  };

  const handleResetFlow = () => {
    setDocuments((prev) => prev.map((doc) => resetDocument(doc)));
    setUploadedRefs({});
    setRawExtractions({});
    setResult(null);
    setPhaseErrors({
      upload: '',
      validateDocuments: '',
      validateImages: '',
      compare: ''
    });
    setPhaseLoading({
      validateDocuments: false,
      validateImages: false,
      compare: false
    });
    setUploadingBySlot({
      invoice: false,
      certificate_of_origin: false,
      photo_plate: false,
      photo_serial: false
    });
    setPhaseCompleted({
      validateDocuments: false,
      validateImages: false
    });
  };

  return (
    <section className="container-app py-8 sm:py-10">
      <div className="space-y-4">
        <div className="flex items-start justify-between gap-3 px-1">
          <div>
            <h1 className="font-display text-xl font-bold text-white sm:text-2xl">Validación logística de expediente</h1>
            <p className="mt-1 text-sm text-purple-100">
              Cargue soportes de unidad y ejecute validación por fases para confirmar placa y serial del expediente.
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
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleValidateDocuments}
              disabled={!canValidateDocuments}
              className={`btn-primary ${!canValidateDocuments ? 'cursor-not-allowed opacity-50' : ''}`}
            >
              {phaseLoading.validateDocuments ? 'Validando documentos...' : 'Validar documentos'}
            </button>
            <button
              type="button"
              onClick={handleValidateImages}
              disabled={!canValidateImages}
              className={`btn-secondary ${!canValidateImages ? 'cursor-not-allowed opacity-50' : ''}`}
            >
              {phaseLoading.validateImages ? 'Validando imágenes...' : 'Validar imágenes'}
            </button>
            <button type="button" onClick={handleResetFlow} className="btn-secondary">
              Reiniciar flujo
            </button>
          </div>
          <div className="mt-3 text-sm text-slate-600">
            {Object.values(uploadingBySlot).some(Boolean) ? <p>Subiendo archivo...</p> : null}
            {phaseLoading.compare ? <p>Comparando expediente...</p> : null}
          </div>
          {phaseErrors.upload ? <p className="mt-2 text-sm text-rose-700">Error de carga: {phaseErrors.upload}</p> : null}
          {phaseErrors.validateDocuments ? (
            <p className="mt-2 text-sm text-rose-700">Error validando documentos: {phaseErrors.validateDocuments}</p>
          ) : null}
          {phaseErrors.validateImages ? (
            <p className="mt-2 text-sm text-rose-700">Error validando imágenes: {phaseErrors.validateImages}</p>
          ) : null}
          {phaseErrors.compare ? <p className="mt-2 text-sm text-rose-700">Error comparando expediente: {phaseErrors.compare}</p> : null}
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          {documents.map((document) => (
            <UploadCard
              key={document.type}
              document={document}
              onSelectFile={handleSelectFile}
              onClear={handleClearFile}
              isValidating={
                uploadingBySlot[document.type] ||
                (phaseLoading.validateDocuments && isDocumentSlot(document.type)) ||
                (phaseLoading.validateImages && isImageSlot(document.type))
              }
            />
          ))}
        </div>

        {Object.keys(rawExtractions).length > 0 ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-soft">
            <h3 className="font-display text-lg font-bold text-glik-secondary">Extracción detectada</h3>
            <p className="mt-1 text-sm text-slate-600">Valores detectados por soporte para control operativo del expediente.</p>
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              {documents.map((doc) => {
                const extraction = rawExtractions[doc.type];
                return (
                  <div key={doc.type} className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm">
                    <p className="font-semibold text-slate-800">{doc.label}</p>
                    <p className="mt-1 text-slate-600">Placa detectada: {extraction?.plate ?? 'No detectada'}</p>
                    <p className="text-slate-600">Serial detectado: {extraction?.serial ?? 'No detectado'}</p>
                  </div>
                );
              })}
            </div>
          </div>
        ) : null}

        {!isProcessing && !result ? (
          <EmptyState
            title="Resultado pendiente"
            description="Cargue soportes, ejecute validación documental e imágenes, y luego se comparará automáticamente el expediente."
          />
        ) : null}
        {!isProcessing && result ? <ResultPanel result={result} onReset={handleResetFlow} /> : null}
      </div>
    </section>
  );
};

export default ValidationPortalPage;
