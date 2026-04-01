import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import ProcessStepper from '../components/validation/ProcessStepper';
import ResultPanel from '../components/validation/ResultPanel';
import UploadCard from '../components/validation/UploadCard';
import EmptyState from '../components/ui/EmptyState';
import { documentSlotsSeed } from '../mocks/documents';
import { compareExpedient, toValidationResult, validateDocuments, validateImages } from '../services/api';
import { SlotExtraction } from '../types/api';
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
const slotLabel: Record<DocumentType, string> = {
  invoice: 'Factura',
  certificate_of_origin: 'Certificado de origen',
  photo_plate: 'Fotoplaca',
  photo_serial: 'Fotoserial'
};

const ValidationPortalPage = () => {
  const [activeScreen, setActiveScreen] = useState<'documents' | 'images'>('documents');
  const [documents, setDocuments] = useState<UploadedDocument[]>(documentSlotsSeed);
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
  const [progressValue, setProgressValue] = useState(0);
  const [lastAutoDocumentsSignature, setLastAutoDocumentsSignature] = useState('');
  const [lastAutoImagesSignature, setLastAutoImagesSignature] = useState('');

  const filesBySlot = useMemo(
    () =>
      Object.fromEntries(documents.filter((d) => d.file).map((d) => [d.type, d.file as File])) as Partial<
        Record<DocumentType, File>
      >,
    [documents]
  );

  const hasAnyDocument = documents.some((document) => Boolean(document.file));
  const isProcessing = Object.values(uploadingBySlot).some(Boolean) || Object.values(phaseLoading).some(Boolean);
  const currentStep: 1 | 2 | 3 = result ? 3 : hasAnyDocument || isProcessing ? 2 : 1;
  const documentsSignature = `${filesBySlot.invoice?.name ?? ''}|${filesBySlot.certificate_of_origin?.name ?? ''}`;
  const imagesSignature = `${filesBySlot.photo_plate?.name ?? ''}|${filesBySlot.photo_serial?.name ?? ''}`;

  const canValidateDocuments = useMemo(
    () =>
      DOCUMENT_SLOTS.every((slot) => Boolean(filesBySlot[slot])) &&
      !phaseLoading.validateDocuments &&
      !phaseLoading.compare,
    [filesBySlot, phaseLoading.compare, phaseLoading.validateDocuments]
  );

  const canValidateImages = useMemo(
    () => IMAGE_SLOTS.every((slot) => Boolean(filesBySlot[slot])) && !phaseLoading.validateImages && !phaseLoading.compare,
    [filesBySlot, phaseLoading.compare, phaseLoading.validateImages]
  );
  const canOpenImagesScreen = phaseCompleted.validateDocuments || DOCUMENT_SLOTS.every((slot) => Boolean(filesBySlot[slot]));
  const visibleDocuments = documents.filter((doc) =>
    activeScreen === 'documents' ? isDocumentSlot(doc.type) : isImageSlot(doc.type)
  );
  const activePhaseLabel = phaseLoading.validateDocuments
    ? 'Validando documentos...'
    : phaseLoading.validateImages
      ? 'Validando imágenes...'
      : phaseLoading.compare
        ? 'Comparando expediente...'
        : '';
  const activePhaseDetail = phaseLoading.validateDocuments
    ? 'Procesando Factura y Certificado de origen.'
    : phaseLoading.validateImages
      ? 'Procesando Fotoplaca y Fotoserial.'
      : phaseLoading.compare
        ? 'Consolidando coincidencia de placa y serial.'
        : '';

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

  const handleSelectFile = (type: DocumentType, file: File) => {
    setResult(null);
    setPhaseErrors((prev) => ({ ...prev, upload: '' }));
    setUploadingBySlot((prev) => ({ ...prev, [type]: true }));
    setDocumentStatus(type, {
      file,
      fileName: file.name,
      status: 'uploaded',
      errorMessage: null
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
    setUploadingBySlot((prev) => ({ ...prev, [type]: false }));
  };

  const handleClearFile = (type: DocumentType) => {
    setResult(null);
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

  const handleValidateDocuments = async (): Promise<boolean> => {
    if (!canValidateDocuments) {
      return false;
    }
    setPhaseLoading((prev) => ({ ...prev, validateDocuments: true }));
    setPhaseErrors((prev) => ({ ...prev, validateDocuments: '' }));
    try {
      const response = await validateDocuments(EXPEDIENT_ID, {
        invoice: filesBySlot.invoice as File,
        certificate_of_origin: filesBySlot.certificate_of_origin as File
      });
      const phaseExtractions = response.raw_extractions ?? {};
      const mergedExtractions = { ...rawExtractions, ...phaseExtractions };
      setRawExtractions(mergedExtractions);
      updateDocumentsFromExtractions(phaseExtractions);
      setPhaseCompleted((prev) => ({ ...prev, validateDocuments: true }));
      setActiveScreen('images');
      if (phaseCompleted.validateImages) {
        await handleCompareExpedient(mergedExtractions);
      }
      return true;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Error no controlado en validación documental.';
      setPhaseErrors((prev) => ({ ...prev, validateDocuments: message }));
      return false;
    } finally {
      setPhaseLoading((prev) => ({ ...prev, validateDocuments: false }));
    }
  };

  const handleValidateImages = async (): Promise<boolean> => {
    if (!canValidateImages) {
      return false;
    }
    setPhaseLoading((prev) => ({ ...prev, validateImages: true }));
    setPhaseErrors((prev) => ({ ...prev, validateImages: '' }));
    try {
      const response = await validateImages(EXPEDIENT_ID, {
        photo_plate: filesBySlot.photo_plate as File,
        photo_serial: filesBySlot.photo_serial as File
      });
      const phaseExtractions = response.raw_extractions ?? {};
      const mergedExtractions = { ...rawExtractions, ...phaseExtractions };
      setRawExtractions(mergedExtractions);
      updateDocumentsFromExtractions(phaseExtractions);
      setPhaseCompleted((prev) => ({ ...prev, validateImages: true }));
      if (phaseCompleted.validateDocuments) {
        await handleCompareExpedient(mergedExtractions);
      }
      return true;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Error no controlado en validación de imágenes.';
      setPhaseErrors((prev) => ({ ...prev, validateImages: message }));
      return false;
    } finally {
      setPhaseLoading((prev) => ({ ...prev, validateImages: false }));
    }
  };

  const handleResetFlow = () => {
    setDocuments((prev) => prev.map((doc) => resetDocument(doc)));
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
    setLastAutoDocumentsSignature('');
    setLastAutoImagesSignature('');
    setActiveScreen('documents');
  };

  useEffect(() => {
    const runAutoDocumentsValidation = async () => {
      if (!canValidateDocuments || phaseCompleted.validateDocuments) {
        return;
      }
      if (documentsSignature === lastAutoDocumentsSignature) {
        return;
      }
      setLastAutoDocumentsSignature(documentsSignature);
      await handleValidateDocuments();
    };
    void runAutoDocumentsValidation();
  }, [canValidateDocuments, documentsSignature, lastAutoDocumentsSignature, phaseCompleted.validateDocuments]);

  useEffect(() => {
    const runAutoImagesValidation = async () => {
      if (!canValidateImages || phaseCompleted.validateImages) {
        return;
      }
      if (imagesSignature === lastAutoImagesSignature) {
        return;
      }
      setLastAutoImagesSignature(imagesSignature);
      await handleValidateImages();
    };
    void runAutoImagesValidation();
  }, [canValidateImages, imagesSignature, lastAutoImagesSignature, phaseCompleted.validateImages]);

  useEffect(() => {
    if (!isProcessing) {
      setProgressValue(0);
      return;
    }

    setProgressValue(8);
    const id = window.setInterval(() => {
      setProgressValue((prev) => {
        if (prev >= 92) return prev;
        return prev + 6;
      });
    }, 450);

    return () => window.clearInterval(id);
  }, [isProcessing]);

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
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setActiveScreen('documents')}
              className={`btn-secondary ${activeScreen === 'documents' ? 'bg-purple-100 text-glik-primary' : ''}`}
            >
              Documentos
            </button>
            <button
              type="button"
              onClick={() => setActiveScreen('images')}
              disabled={!canOpenImagesScreen}
              className={`btn-secondary ${
                activeScreen === 'images' ? 'bg-purple-100 text-glik-primary' : ''
              } ${!canOpenImagesScreen ? 'cursor-not-allowed opacity-50' : ''}`}
            >
              Imágenes
            </button>
          </div>
          <p className="mb-4 text-sm text-slate-600">
            {activeScreen === 'documents'
              ? 'Pantalla 1: cargue y valide Factura y Certificado de origen.'
              : 'Pantalla 2: cargue y valide Fotoplaca y Fotoserial.'}
          </p>
          <div className="flex flex-wrap items-center gap-2">
            {activeScreen === 'documents' ? (
              <button
                type="button"
                onClick={handleValidateDocuments}
                disabled={!canValidateDocuments}
                className={`btn-primary ${!canValidateDocuments ? 'cursor-not-allowed opacity-50' : ''}`}
              >
                {phaseLoading.validateDocuments ? 'Validando documentos...' : 'Validar documentos'}
              </button>
            ) : (
              <button
                type="button"
                onClick={handleValidateImages}
                disabled={!canValidateImages}
                className={`btn-primary ${!canValidateImages ? 'cursor-not-allowed opacity-50' : ''}`}
              >
                {phaseLoading.validateImages ? 'Validando imágenes...' : 'Validar imágenes'}
              </button>
            )}
            <button type="button" onClick={handleResetFlow} className="btn-secondary">
              Reiniciar flujo
            </button>
          </div>
          <div className="mt-3 text-sm text-slate-600">
            {Object.values(uploadingBySlot).some(Boolean) ? <p>Subiendo archivo...</p> : null}
            {phaseLoading.compare ? <p>Comparando expediente...</p> : null}
            {!isProcessing && activeScreen === 'documents' && !canValidateDocuments ? (
              <p>Cargue Factura y Certificado para iniciar validación.</p>
            ) : null}
            {!isProcessing && activeScreen === 'images' && !canValidateImages ? (
              <p>Cargue Fotoplaca y Fotoserial para iniciar validación.</p>
            ) : null}
          </div>
          {isProcessing ? (
            <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
              <div className="mb-2 flex items-center justify-between text-xs font-semibold text-slate-700">
                <span>{activePhaseLabel || 'Procesando...'}</span>
                <span>{progressValue}%</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-slate-200">
                <div
                  className="h-full rounded-full bg-glik-primary transition-all duration-300"
                  style={{ width: `${progressValue}%` }}
                />
              </div>
              {activePhaseDetail ? <p className="mt-2 text-xs text-slate-600">{activePhaseDetail}</p> : null}
            </div>
          ) : null}
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
          {visibleDocuments.map((document) => (
            (() => {
              const isUploading = uploadingBySlot[document.type];
              const isPhaseValidating =
                (phaseLoading.validateDocuments && isDocumentSlot(document.type)) ||
                (phaseLoading.validateImages && isImageSlot(document.type));
              const missingPairText =
                document.type === 'invoice' && document.file
                  ? filesBySlot.certificate_of_origin
                    ? ''
                    : 'Esperando Certificado de origen para iniciar validación documental.'
                  : document.type === 'certificate_of_origin' && document.file
                    ? filesBySlot.invoice
                      ? ''
                      : 'Esperando Factura para iniciar validación documental.'
                    : document.type === 'photo_plate' && document.file
                      ? filesBySlot.photo_serial
                        ? ''
                        : 'Esperando Fotoserial para iniciar validación de imágenes.'
                      : document.type === 'photo_serial' && document.file
                        ? filesBySlot.photo_plate
                          ? ''
                          : 'Esperando Fotoplaca para iniciar validación de imágenes.'
                        : '';
              const activityText = isUploading
                ? `Subiendo ${slotLabel[document.type]}...`
                : isPhaseValidating
                  ? `Validando ${slotLabel[document.type]} en Lambda...`
                  : '';
              return (
            <UploadCard
              key={document.type}
              document={document}
              onSelectFile={handleSelectFile}
              onClear={handleClearFile}
              isValidating={Boolean(activityText)}
              activityText={activityText}
              helperText={missingPairText}
            />
              );
            })()
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
