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

  const body = (await response.json()) as TResponse & { success?: boolean; message?: string; error?: string };
  if (!response.ok || body.success === false) {
    const baseMessage = body.message ?? 'Error validando archivo.';
    const detail = body.error ? ` Detalle: ${body.error}` : '';
    throw new Error(`${baseMessage}${detail}`);
  }
  return body as TResponse;
};

type DocumentSlot = Extract<DocumentType, 'invoice' | 'certificate_of_origin'>;
type ImageSlot = Extract<DocumentType, 'photo_plate' | 'photo_serial'>;

type SlotValidationPayload = {
  action: 'validate_slot';
  slot: DocumentType;
  document: {
    filename: string;
    content_base64: string;
    content_type: string;
  };
};

const slotExpectedMap: Record<DocumentType, string> = {
  invoice: 'INVOICE',
  certificate_of_origin: 'CERTIFICATE_OF_ORIGIN',
  photo_plate: 'PHOTO_PLATE',
  photo_serial: 'PHOTO_SERIAL'
};

const slotLabelMap: Record<DocumentType, string> = {
  invoice: 'Factura',
  certificate_of_origin: 'Certificado de origen',
  photo_plate: 'Fotoplaca',
  photo_serial: 'Fotoserial'
};

const extractPlateHintFromFilename = (filename?: string | null): string | null => {
  if (!filename) return null;
  const base = filename.toUpperCase().replace(/\.[A-Z0-9]+$/, '');
  const compact = base.replace(/[^A-Z0-9]/g, '');
  if (!compact) return null;

  // Busca placas candidatas de 6-7 caracteres alfanuméricos.
  const matches = compact.match(/[A-Z0-9]{6,7}/g);
  if (!matches || matches.length === 0) return null;

  const candidate = matches.find((value) => /[A-Z]/.test(value) && /\d/.test(value)) ?? matches[0];
  const normalized = normalizePlate(candidate);
  return normalized ?? null;
};

const levenshteinDistance = (a: string, b: string): number => {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;

  const prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  const curr = new Array<number>(b.length + 1).fill(0);

  for (let i = 1; i <= a.length; i += 1) {
    curr[0] = i;
    for (let j = 1; j <= b.length; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(
        prev[j] + 1, // eliminación
        curr[j - 1] + 1, // inserción
        prev[j - 1] + cost // sustitución
      );
    }
    for (let j = 0; j <= b.length; j += 1) {
      prev[j] = curr[j];
    }
  }
  return prev[b.length];
};

const isLikelyPlateOcrVariant = (detected: string, hint: string): boolean => {
  if (detected.length !== hint.length) return false;
  if (detected.length < 6 || detected.length > 7) return false;
  if (detected.slice(0, 2) !== hint.slice(0, 2)) return false;
  if (detected.slice(-1) !== hint.slice(-1)) return false;
  return levenshteinDistance(detected, hint) <= 3;
};

const applyFilenamePlateHint = (slotResult: SlotExtraction, filename?: string | null): SlotExtraction => {
  const hintPlate = extractPlateHintFromFilename(filename);
  const detectedPlate = normalizePlate(slotResult.plate);
  if (!hintPlate || !detectedPlate || detectedPlate === hintPlate) return slotResult;
  if (!slotResult.document_valid) return slotResult;
  if (!isLikelyPlateOcrVariant(detectedPlate, hintPlate)) return slotResult;

  return {
    ...slotResult,
    plate: hintPlate
  };
};

const buildSlotPayload = async (slot: DocumentType, file: File): Promise<SlotValidationPayload> => {
  const base64 = await toBase64(file);
  return {
    action: 'validate_slot',
    slot,
    document: {
      filename: file.name,
      content_base64: base64,
      content_type: file.type || 'application/octet-stream'
    }
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
  try {
    const payload = await buildSlotPayload(slot, file);
    const response = (await postDirect<Record<string, unknown>>(payload, phaseTimeoutMs)) as Record<string, unknown>;
    const nestedResult =
      typeof response.result === 'object' && response.result !== null ? (response.result as Record<string, unknown>) : response;
    return mapSlotValidationToExtraction(slot, nestedResult);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Error desconocido';
    throw new Error(`${slotLabelMap[slot]}: ${message}`);
  }
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

  // Regla de negocio principal:
  // 1) Fotoplaca vs placa del certificado
  // 2) Fotoserial vs serial del certificado
  const plateMatch = compareTwo(certificatePlate, imagePlate, 'plate');
  const serialMatch = compareTwo(certificateSerial, imageSerial, 'serial');

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
      ? 'La placa de fotoplaca coincide con el certificado de origen.'
      : plateMatch === false
        ? 'La placa de fotoplaca no coincide con el certificado de origen.'
        : 'No hay datos suficientes para validar placa (certificado/fotoplaca).'
  );
  messages.push(
    serialMatch === true
      ? 'El serial de fotoserial coincide con el certificado de origen.'
      : serialMatch === false
        ? 'El serial de fotoserial no coincide con el certificado de origen.'
        : 'No hay datos suficientes para validar serial (certificado/fotoserial).'
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
  const [invoiceRaw, certificateRaw] = await Promise.all([
    validateSingleSlot('invoice', filesBySlot.invoice),
    validateSingleSlot('certificate_of_origin', filesBySlot.certificate_of_origin)
  ]);
  const invoice = applyFilenamePlateHint(invoiceRaw, filesBySlot.invoice.name);
  const certificate = applyFilenamePlateHint(certificateRaw, filesBySlot.certificate_of_origin.name);

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
