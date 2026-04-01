import { DocumentType, ValidationResult } from '../types/validation';
import { CompareExpedientResponse, SlotExtraction, ValidateDocumentsResponse, ValidateImagesResponse } from '../types/api';

const apiUrl = import.meta.env.VITE_API_URL;
const networkTimeoutMs = Number(import.meta.env.VITE_NETWORK_TIMEOUT_MS ?? 30000);
const phaseTimeoutMs = Number(import.meta.env.VITE_LAMBDA_TIMEOUT_MS ?? 45000);
const fileReadTimeoutMs = Number(import.meta.env.VITE_FILE_READ_TIMEOUT_MS ?? 20000);

const fetchWithTimeout = async (
  input: RequestInfo | URL,
  init: RequestInit,
  timeoutMs: number,
  timeoutMessage: string
) => {
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new Error(timeoutMessage);
    }
    if (error instanceof TypeError) {
      throw new Error('No se pudo conectar con el backend (posible CORS, URL inválida o red).');
    }
    throw error;
  } finally {
    window.clearTimeout(timeoutId);
  }
};

const ensureApiUrl = () => {
  if (!apiUrl) {
    throw new Error('Falta VITE_API_URL en variables de entorno.');
  }
  return apiUrl;
};

const normalizePlate = (value?: string | null) => (value ? value.replace(/\s+/g, '').toUpperCase().trim() : null);
const normalizeSerial = (value?: string | null) => (value ? value.replace(/[^A-Z0-9]/gi, '').toUpperCase().trim() : null);

const toBase64 = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    const timeoutId = window.setTimeout(() => {
      reader.abort();
      reject(
        new Error(
          `La preparación del archivo "${file.name}" tardó demasiado. Intente nuevamente o use un archivo más liviano.`
        )
      );
    }, fileReadTimeoutMs);

    reader.onload = () => {
      window.clearTimeout(timeoutId);
      const result = reader.result;
      if (typeof result !== 'string') {
        reject(new Error('No se pudo leer el archivo para validación.'));
        return;
      }
      const markerIndex = result.indexOf(',');
      resolve(markerIndex >= 0 ? result.slice(markerIndex + 1) : result);
    };
    reader.onerror = () => {
      window.clearTimeout(timeoutId);
      reject(new Error('No se pudo convertir el archivo a base64.'));
    };
    reader.onabort = () => {
      window.clearTimeout(timeoutId);
    };
    reader.readAsDataURL(file);
  });

const postDirect = async <TResponse>(payload: Record<string, unknown>, timeoutMs = networkTimeoutMs) => {
  const response = await fetchWithTimeout(
    ensureApiUrl(),
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    },
    timeoutMs,
    'Se agotó el tiempo en la validación del archivo.'
  );

  const body = (await response.json()) as TResponse & { success?: boolean; message?: string };
  if (!response.ok || body.success === false) {
    throw new Error(body.message ?? 'Error validando archivo.');
  }
  return body as TResponse;
};

type DocumentSlot = Extract<DocumentType, 'invoice' | 'certificate_of_origin'>;
type ImageSlot = Extract<DocumentType, 'photo_plate' | 'photo_serial'>;

type SlotValidationPayload = {
  fileBase64: string;
  fileName: string;
  contentType: string;
  expectedDocumentType?: string;
  slotExpected?: string;
  documentTypeExpected?: string;
  requestedCategory?: string;
};

const slotExpectedMap: Record<DocumentType, string> = {
  invoice: 'INVOICE',
  certificate_of_origin: 'CERTIFICATE_OF_ORIGIN',
  photo_plate: 'PHOTO_PLATE',
  photo_serial: 'PHOTO_SERIAL'
};

const buildSlotPayload = async (slot: DocumentType, file: File): Promise<SlotValidationPayload> => {
  const base64 = await toBase64(file);
  const slotExpected = slotExpectedMap[slot];

  if (slot === 'invoice' || slot === 'certificate_of_origin') {
    return {
      fileBase64: base64,
      fileName: file.name,
      contentType: file.type || 'application/octet-stream',
      expectedDocumentType: slotExpected,
      slotExpected,
      documentTypeExpected: slotExpected
    };
  }

  return {
    fileBase64: base64,
    fileName: file.name,
    contentType: file.type || 'application/octet-stream',
    requestedCategory: slotExpected
  };
};

const mapSlotValidationToExtraction = (slot: DocumentType, response: Record<string, unknown>): SlotExtraction => {
  const plate = (response.plate as string | undefined) ?? null;
  const serial = (response.serial as string | undefined) ?? null;
  const docValid =
    typeof response.document_valid === 'boolean'
      ? response.document_valid
      : typeof response.isValidForSlot === 'boolean'
        ? response.isValidForSlot
        : typeof response.validationResult === 'string'
          ? response.validationResult === 'VALIDADA'
          : false;

  const reason =
    (response.reason as string | undefined) ||
    (response.slotValidationReason as string | undefined) ||
    (response.description as string | undefined) ||
    (response.message as string | undefined) ||
    `Validación ${slotExpectedMap[slot]}`;

  return {
    document_valid: Boolean(docValid),
    plate: plate ?? null,
    serial: serial ?? null,
    reason
  };
};

const validateSingleSlot = async (slot: DocumentType, file: File): Promise<SlotExtraction> => {
  const payload = await buildSlotPayload(slot, file);
  const response = (await postDirect<Record<string, unknown>>(payload, phaseTimeoutMs)) as Record<string, unknown>;
  return mapSlotValidationToExtraction(slot, response);
};

const aggregateMatch = (values: Array<boolean | null>): boolean | null => {
  const filtered = values.filter((value): value is boolean => value !== null);
  if (filtered.length === 0) return null;
  if (filtered.includes(false)) return false;
  return true;
};

const compareTwo = (a?: string | null, b?: string | null, mode: 'plate' | 'serial' = 'plate'): boolean | null => {
  if (!a || !b) return null;
  if (mode === 'plate') return normalizePlate(a) === normalizePlate(b);
  return normalizeSerial(a) === normalizeSerial(b);
};

const compareInFrontend = (
  expedientId: string,
  rawExtractions: Partial<Record<DocumentType, SlotExtraction>>
): CompareExpedientResponse => {
  const invoice = rawExtractions.invoice;
  const certificate = rawExtractions.certificate_of_origin;
  const photoPlate = rawExtractions.photo_plate;
  const photoSerial = rawExtractions.photo_serial;

  const invoicePlate = normalizePlate(invoice?.plate);
  const certificatePlate = normalizePlate(certificate?.plate);
  const imagePlate = normalizePlate(photoPlate?.plate);

  const invoiceSerial = normalizeSerial(invoice?.serial);
  const certificateSerial = normalizeSerial(certificate?.serial);
  const imageSerial = normalizeSerial(photoSerial?.serial);

  const plateMatch = aggregateMatch([
    compareTwo(invoicePlate, certificatePlate, 'plate'),
    compareTwo(invoicePlate, imagePlate, 'plate'),
    compareTwo(certificatePlate, imagePlate, 'plate')
  ]);
  const serialMatch = aggregateMatch([
    compareTwo(invoiceSerial, certificateSerial, 'serial'),
    compareTwo(invoiceSerial, imageSerial, 'serial'),
    compareTwo(certificateSerial, imageSerial, 'serial')
  ]);

  const invoiceValid = Boolean(invoice?.document_valid);
  const certificateValid = Boolean(certificate?.document_valid);
  const photoPlateValid = Boolean(photoPlate?.document_valid);
  const photoSerialValid = Boolean(photoSerial?.document_valid);
  const sameExpedient =
    invoiceValid &&
    certificateValid &&
    photoPlateValid &&
    photoSerialValid &&
    plateMatch === true &&
    serialMatch === true;

  const messages: string[] = [];
  messages.push(invoiceValid ? 'La factura corresponde al tipo esperado.' : `Factura: ${invoice?.reason ?? 'No válida.'}`);
  messages.push(
    certificateValid
      ? 'El certificado de origen corresponde al tipo esperado.'
      : `Certificado: ${certificate?.reason ?? 'No válido.'}`
  );
  messages.push(photoPlateValid ? 'La fotoplaca es válida.' : `Fotoplaca: ${photoPlate?.reason ?? 'No válida.'}`);
  messages.push(photoSerialValid ? 'El fotoserial es válido.' : `Fotoserial: ${photoSerial?.reason ?? 'No válido.'}`);
  messages.push(
    plateMatch === true
      ? 'La placa coincide entre soportes.'
      : plateMatch === false
        ? 'La placa no coincide entre soportes.'
        : 'No hay datos suficientes de placa para comparar.'
  );
  messages.push(
    serialMatch === true
      ? 'El serial coincide entre soportes.'
      : serialMatch === false
        ? 'El serial no coincide entre soportes.'
        : 'No hay datos suficientes de serial para comparar.'
  );

  return {
    success: true,
    expedient_id: expedientId,
    raw_extractions: rawExtractions,
    document_validation: {
      invoice_valid: invoiceValid,
      certificate_of_origin_valid: certificateValid,
      photo_plate_valid: photoPlateValid,
      photo_serial_valid: photoSerialValid
    },
    extracted_data: {
      invoice_plate: invoicePlate,
      certificate_plate: certificatePlate,
      photo_plate: imagePlate,
      invoice_serial: invoiceSerial,
      certificate_serial: certificateSerial,
      photo_serial: imageSerial
    },
    cross_validation: {
      plate_match: plateMatch,
      serial_match: serialMatch,
      same_expedient: sameExpedient
    },
    overall_status: sameExpedient ? 'validated' : 'manual_review',
    messages
  };
};

export const validateDocuments = async (
  expedientId: string,
  filesBySlot: Record<DocumentSlot, File>
): Promise<ValidateDocumentsResponse> => {
  const [invoice, certificate] = await Promise.all([
    validateSingleSlot('invoice', filesBySlot.invoice),
    validateSingleSlot('certificate_of_origin', filesBySlot.certificate_of_origin)
  ]);

  return {
    success: true,
    expedient_id: expedientId,
    phase: 'documents',
    raw_extractions: {
      invoice,
      certificate_of_origin: certificate
    }
  };
};

export const validateImages = async (
  expedientId: string,
  filesBySlot: Record<ImageSlot, File>
): Promise<ValidateImagesResponse> => {
  const [photoPlate, photoSerial] = await Promise.all([
    validateSingleSlot('photo_plate', filesBySlot.photo_plate),
    validateSingleSlot('photo_serial', filesBySlot.photo_serial)
  ]);

  return {
    success: true,
    expedient_id: expedientId,
    phase: 'images',
    raw_extractions: {
      photo_plate: photoPlate,
      photo_serial: photoSerial
    }
  };
};

export const compareExpedient = async (
  expedientId: string,
  rawExtractions: Partial<Record<DocumentType, SlotExtraction>>
): Promise<CompareExpedientResponse> => {
  return compareInFrontend(expedientId, rawExtractions);
};

export const toValidationResult = (response: CompareExpedientResponse): ValidationResult => {
  return {
    invoice_document_valid: Boolean(response.document_validation?.invoice_valid),
    certificate_document_valid: Boolean(response.document_validation?.certificate_of_origin_valid),
    photo_plate_valid: Boolean(response.document_validation?.photo_plate_valid),
    photo_serial_valid: Boolean(response.document_validation?.photo_serial_valid),
    plate_match: Boolean(response.cross_validation?.plate_match),
    serial_match: Boolean(response.cross_validation?.serial_match),
    overall_status: response.overall_status === 'validated' ? 'validated' : 'manual_review',
    messages:
      response.messages && response.messages.length > 0
        ? response.messages
        : ['Validación completada. Revise el resultado del expediente.']
  };
};
