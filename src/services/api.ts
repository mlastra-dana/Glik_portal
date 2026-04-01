import { DocumentType, ValidationResult } from '../types/validation';
import { CompareExpedientResponse, SlotExtraction, ValidateDocumentsResponse, ValidateImagesResponse } from '../types/api';

const apiUrl = import.meta.env.VITE_API_URL;
const networkTimeoutMs = Number(import.meta.env.VITE_NETWORK_TIMEOUT_MS ?? 30000);
const phaseTimeoutMs = Number(import.meta.env.VITE_LAMBDA_TIMEOUT_MS ?? 45000);

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

const toBase64 = async (file: File): Promise<string> => {
  const bytes = await file.arrayBuffer();
  let binary = '';
  const view = new Uint8Array(bytes);
  for (let i = 0; i < view.length; i += 1) {
    binary += String.fromCharCode(view[i]);
  }
  return btoa(binary);
};

const encodeFilesBySlot = async (filesBySlot: Partial<Record<DocumentType, File>>, slots: DocumentType[]) => {
  const entries = await Promise.all(
    slots.map(async (slot) => {
      const file = filesBySlot[slot];
      if (!file) {
        throw new Error(`Falta archivo para ${slot}.`);
      }
      return [
        slot,
        {
          filename: file.name,
          content_base64: await toBase64(file)
        }
      ] as const;
    })
  );
  return Object.fromEntries(entries) as Record<DocumentType, { filename: string; content_base64: string }>;
};

const postAction = async <TResponse>(action: string, payload: Record<string, unknown>, timeoutMs = networkTimeoutMs) => {
  const response = await fetchWithTimeout(
    ensureApiUrl(),
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, ...payload })
    },
    timeoutMs,
    `Se agotó el tiempo en la fase ${action}.`
  );

  const body = (await response.json()) as TResponse & { success?: boolean; message?: string };
  if (!response.ok || body.success === false) {
    throw new Error(body.message ?? `Error en fase ${action}.`);
  }
  return body as TResponse;
};

type DocumentSlot = Extract<DocumentType, 'invoice' | 'certificate_of_origin'>;
type ImageSlot = Extract<DocumentType, 'photo_plate' | 'photo_serial'>;

export const validateDocuments = async (
  expedientId: string,
  filesBySlot: Record<DocumentSlot, File>
): Promise<ValidateDocumentsResponse> => {
  const documents = await encodeFilesBySlot(filesBySlot, ['invoice', 'certificate_of_origin']);
  return postAction<ValidateDocumentsResponse>(
    'validate_documents',
    { expedient_id: expedientId, documents },
    phaseTimeoutMs
  );
};

export const validateImages = async (
  expedientId: string,
  filesBySlot: Record<ImageSlot, File>
): Promise<ValidateImagesResponse> => {
  const documents = await encodeFilesBySlot(filesBySlot, ['photo_plate', 'photo_serial']);
  return postAction<ValidateImagesResponse>(
    'validate_images',
    { expedient_id: expedientId, documents },
    phaseTimeoutMs
  );
};

export const compareExpedient = async (
  expedientId: string,
  rawExtractions: Partial<Record<DocumentType, SlotExtraction>>
): Promise<CompareExpedientResponse> => {
  return postAction<CompareExpedientResponse>(
    'compare_expedient',
    { expedient_id: expedientId, raw_extractions: rawExtractions },
    phaseTimeoutMs
  );
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

