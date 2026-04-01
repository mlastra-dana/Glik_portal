import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import ProcessStepper from '../components/validation/ProcessStepper';
import ResultPanel from '../components/validation/ResultPanel';
import UploadCard from '../components/validation/UploadCard';
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

const isDocumentSlot = (slot: DocumentType): slot is (typeof DOCUMENT_SLOTS)[number] =>
  DOCUMENT_SLOTS.includes(slot as (typeof DOCUMENT_SLOTS)[number]);

const isImageSlot = (slot: DocumentType): slot is (typeof IMAGE_SLOTS)[number] =>
  IMAGE_SLOTS.includes(slot as (typeof IMAGE_SLOTS)[number]);

const slotLabel: Record<DocumentType, string> = {
  invoice: 'Factura',
  certificate_of_origin: 'Certificado de origen',
  photo_plate: 'Fotoplaca',
  photo_serial: 'Fotoserial'
};

const normalizePlate = (value?: string | null) => (value ? value.replace(/\s+/g, '').toUpperCase().trim() : null);
const normalizeSerial = (value?: string | null) => (value ? value.replace(/[^A-Z0-9]/gi, '').toUpperCase().trim() : null);

const ValidationPortalPage = () => {
  const [flowStep, setFlowStep] = useState<1 | 2 | 3>(1);
  const [agentFirstName, setAgentFirstName] = useState('');
  const [agentLastName, setAgentLastName] = useState('');
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

  const filesBySlot = useMemo(
    () =>
      Object.fromEntries(documents.filter((d) => d.file).map((d) => [d.type, d.file as File])) as Partial<
        Record<DocumentType, File>
      >,
    [documents]
  );

  const currentStep: 1 | 2 | 3 = flowStep;
  const isProcessing = Object.values(uploadingBySlot).some(Boolean) || Object.values(phaseLoading).some(Boolean);
  const canContinueToValidation = agentFirstName.trim().length > 0 && agentLastName.trim().length > 0;

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

  const activePhaseLabel = phaseLoading.validateDocuments
    ? 'Validando documentos...'
    : phaseLoading.validateImages
      ? 'Validando imágenes...'
      : phaseLoading.compare
        ? 'Comparando expediente...'
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
      setFlowStep(3);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Error no controlado en comparación.';
      setPhaseErrors((prev) => ({ ...prev, compare: message }));
      setResult(null);
    } finally {
      setPhaseLoading((prev) => ({ ...prev, compare: false }));
    }
  };

  const handleSelectFile = (type: DocumentType, file: File) => {
    if (flowStep === 3) setFlowStep(2);
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
    if (flowStep === 3) setFlowStep(2);
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
    if (!canValidateDocuments) return false;

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
    if (!canValidateImages) return false;

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
    setFlowStep(1);
    setAgentFirstName('');
    setAgentLastName('');
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
  };

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

  const renderUploadGrid = (slots: UploadedDocument[]) => (
    <div className="grid gap-4 md:grid-cols-2">
      {slots.map((document) => {
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
            ? `Validando ${slotLabel[document.type]}...`
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
      })}
    </div>
  );

  return (
    <section className="container-app py-8 sm:py-10">
      <div className="space-y-4">
        <div className="flex items-start justify-between gap-3 px-1">
          <div>
            <h1 className="font-display text-xl font-bold text-white sm:text-2xl">Validación logística de expediente</h1>
            <p className="mt-1 text-sm text-purple-100">Control de documentos y evidencias de motocicleta.</p>
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
        {flowStep === 1 ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-soft">
            <h2 className="font-display text-lg font-bold text-glik-secondary">Paso 1: Datos del agente</h2>
            <p className="mt-1 text-sm text-slate-600">Ingrese nombre y apellido para iniciar la validación del expediente.</p>
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <label className="space-y-1 text-sm font-medium text-slate-700">
                <span>Nombre</span>
                <input
                  type="text"
                  value={agentFirstName}
                  onChange={(event) => setAgentFirstName(event.target.value)}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-800 outline-none transition focus:border-glik-primary"
                  placeholder="Ej. Maria"
                />
              </label>
              <label className="space-y-1 text-sm font-medium text-slate-700">
                <span>Apellido</span>
                <input
                  type="text"
                  value={agentLastName}
                  onChange={(event) => setAgentLastName(event.target.value)}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-800 outline-none transition focus:border-glik-primary"
                  placeholder="Ej. Lastra"
                />
              </label>
            </div>
            <div className="mt-5 flex justify-end">
              <button
                type="button"
                onClick={() => setFlowStep(2)}
                disabled={!canContinueToValidation}
                className={`btn-primary ${!canContinueToValidation ? 'cursor-not-allowed opacity-50' : ''}`}
              >
                Siguiente
              </button>
            </div>
          </div>
        ) : null}

        {flowStep >= 2 ? (
          <>
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-soft">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div className="flex flex-wrap items-center gap-2 text-sm">
                  <span className="rounded-full bg-slate-100 px-3 py-1 font-medium text-slate-600">Paso 2: Validación de expediente</span>
                  <span className="rounded-full bg-slate-100 px-3 py-1 font-medium text-slate-600">
                    Agente: {agentFirstName} {agentLastName}
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <button type="button" onClick={handleResetFlow} className="btn-secondary">
                    Reiniciar flujo
                  </button>
                </div>
              </div>

              <div className="mt-2 text-sm text-slate-600">
                {Object.values(uploadingBySlot).some(Boolean) ? <p>Subiendo archivo...</p> : null}
                {phaseLoading.compare ? <p>Comparando expediente...</p> : null}
              </div>

              {isProcessing ? (
                <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
                  <div className="mb-2 flex items-center justify-between text-xs font-semibold text-slate-700">
                    <span>{activePhaseLabel || 'Procesando...'}</span>
                    <span>{progressValue}%</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-slate-200">
                    <div className="h-full rounded-full bg-glik-primary transition-all duration-300" style={{ width: `${progressValue}%` }} />
                  </div>
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

            {flowStep === 2 ? (
              <>
                <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-soft">
                  <div className="flex items-center justify-between">
                    <h3 className="font-display text-lg font-bold text-glik-secondary">Documentos</h3>
                    <div className="flex items-center gap-3">
                      {!isProcessing && !canValidateDocuments ? (
                        <span className="text-sm text-slate-500">Cargue Factura y Certificado para validar.</span>
                      ) : null}
                      <button
                        type="button"
                        onClick={handleValidateDocuments}
                        disabled={!canValidateDocuments}
                        className={`btn-primary ${!canValidateDocuments ? 'cursor-not-allowed opacity-50' : ''}`}
                      >
                        {phaseLoading.validateDocuments ? 'Validando documentos...' : 'Validar documentos'}
                      </button>
                    </div>
                  </div>
                  <div className="mt-4">{renderUploadGrid(documents.filter((doc) => isDocumentSlot(doc.type)))}</div>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-soft">
                  <div className="flex items-center justify-between">
                    <h3 className="font-display text-lg font-bold text-glik-secondary">Imágenes</h3>
                    <div className="flex items-center gap-3">
                      {!isProcessing && !canValidateImages ? (
                        <span className="text-sm text-slate-500">Cargue Fotoplaca y Fotoserial para validar.</span>
                      ) : null}
                      <button
                        type="button"
                        onClick={handleValidateImages}
                        disabled={!canValidateImages}
                        className={`btn-primary ${!canValidateImages ? 'cursor-not-allowed opacity-50' : ''}`}
                      >
                        {phaseLoading.validateImages ? 'Validando imágenes...' : 'Validar imágenes'}
                      </button>
                    </div>
                  </div>
                  <div className="mt-4">{renderUploadGrid(documents.filter((doc) => isImageSlot(doc.type)))}</div>
                </div>
              </>
            ) : null}

            {Object.keys(rawExtractions).length > 0 ? (
              <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-soft">
                <h3 className="font-display text-lg font-bold text-glik-secondary">Extracción detectada</h3>
                <div className="mt-4 overflow-hidden rounded-xl border border-slate-200">
                  <table className="w-full min-w-[640px] border-collapse text-sm">
                    <thead className="bg-slate-50">
                      <tr>
                        <th className="px-4 py-3 text-left font-semibold text-slate-600">Soporte</th>
                        <th className="px-4 py-3 text-left font-semibold text-slate-600">Dato</th>
                        <th className="px-4 py-3 text-left font-semibold text-slate-600">Valor detectado</th>
                        <th className="px-4 py-3 text-left font-semibold text-slate-600">Estado</th>
                      </tr>
                    </thead>
                    <tbody>
                      {documents.map((doc) => {
                        const extraction = rawExtractions[doc.type];
                        const plate = extraction?.plate ?? null;
                        const serial = extraction?.serial ?? null;
                        const isDetected = Boolean(extraction?.document_valid);
                        const invoiceRef = rawExtractions.invoice;
                        const certificateRef = rawExtractions.certificate_of_origin;
                        const invoicePlate = normalizePlate(invoiceRef?.plate);
                        const certificatePlate = normalizePlate(certificateRef?.plate);
                        const invoiceSerial = normalizeSerial(invoiceRef?.serial);
                        const certificateSerial = normalizeSerial(certificateRef?.serial);
                        const referencePlate = certificatePlate ?? invoicePlate;
                        const referenceSerial = certificateSerial ?? invoiceSerial;

                        const datumLabel =
                          doc.type === 'photo_plate' ? 'Placa' : doc.type === 'photo_serial' ? 'Serial' : 'Placa / Serial';
                        const detectedValue =
                          doc.type === 'photo_plate'
                            ? plate || '-'
                            : doc.type === 'photo_serial'
                              ? serial || '-'
                              : `${plate || '-'} / ${serial || '-'}`;

                        let statusLabel = 'Sin dato';
                        let statusClass = 'bg-slate-200 text-slate-600';

                        if (doc.type === 'photo_plate') {
                          const current = normalizePlate(plate);
                          if (!isDetected || !current) {
                            statusLabel = 'Sin dato';
                          } else if (!referencePlate) {
                            statusLabel = 'Sin referencia';
                          } else if (current === referencePlate) {
                            statusLabel = 'Coincide';
                            statusClass = 'bg-emerald-100 text-emerald-700';
                          } else {
                            statusLabel = 'No coincide';
                            statusClass = 'bg-rose-100 text-rose-700';
                          }
                        } else if (doc.type === 'photo_serial') {
                          const current = normalizeSerial(serial);
                          if (!isDetected || !current) {
                            statusLabel = 'Sin dato';
                          } else if (!referenceSerial) {
                            statusLabel = 'Sin referencia';
                          } else if (current === referenceSerial) {
                            statusLabel = 'Coincide';
                            statusClass = 'bg-emerald-100 text-emerald-700';
                          } else {
                            statusLabel = 'No coincide';
                            statusClass = 'bg-rose-100 text-rose-700';
                          }
                        } else {
                          if (!isDetected) {
                            statusLabel = 'Sin dato';
                          } else if (!invoicePlate || !certificatePlate || !invoiceSerial || !certificateSerial) {
                            statusLabel = 'Sin referencia';
                          } else if (invoicePlate === certificatePlate && invoiceSerial === certificateSerial) {
                            statusLabel = 'Coincide';
                            statusClass = 'bg-emerald-100 text-emerald-700';
                          } else {
                            statusLabel = 'No coincide';
                            statusClass = 'bg-rose-100 text-rose-700';
                          }
                        }

                        return (
                          <tr key={doc.type} className="border-t border-slate-200 bg-white">
                            <td className="px-4 py-3 font-medium text-slate-800">{doc.label}</td>
                            <td className="px-4 py-3 text-slate-700">{datumLabel}</td>
                            <td className="px-4 py-3 font-mono text-slate-700">{detectedValue}</td>
                            <td className="px-4 py-3">
                              <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${statusClass}`}>{statusLabel}</span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : null}
          </>
        ) : null}

        {!isProcessing && result && flowStep === 3 ? <ResultPanel result={result} onReset={handleResetFlow} /> : null}
      </div>
    </section>
  );
};

export default ValidationPortalPage;
