import { DocumentType, ValidationResult } from '../types/validation';
import {
  CompareExpedientResponse,
  SlotExtraction,
  UploadUrlResponse,
  UploadedDocumentRef,
  ValidateDocumentsResponse,
  ValidateImagesResponse
} from '../types/api';

const apiUrl = import.meta.env.VITE_API_URL;
const networkTimeoutMs = Number(import.meta.env.VITE_NETWORK_TIMEOUT_MS ?? 30000);
const uploadTimeoutMs = Number(import.meta.env.VITE_UPLOAD_TIMEOUT_MS ?? 120000);
const compareTimeoutMs = Number(import.meta.env.VITE_LAMBDA_TIMEOUT_MS ?? 45000);

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

export const createUploadUrl = async (slot: DocumentType, file: File): Promise<UploadUrlResponse> => {
  return postAction<UploadUrlResponse>('create_upload_url', {
    slot,
    filename: file.name,
    content_type: file.type || 'application/octet-stream'
  });
};

export const uploadFileToS3 = async (uploadUrl: string, file: File): Promise<void> => {
  const putResponse = await fetchWithTimeout(
    uploadUrl,
    {
      method: 'PUT',
      headers: {
        'Content-Type': file.type || 'application/octet-stream'
      },
      body: file
    },
    uploadTimeoutMs,
    `Se agotó el tiempo subiendo ${file.name}.`
  );

  if (!putResponse.ok) {
    throw new Error(`Falló carga a S3. HTTP ${putResponse.status}`);
  }
};

export const uploadDocument = async (slot: DocumentType, file: File): Promise<UploadedDocumentRef> => {
  const upload = await createUploadUrl(slot, file);
  if (!upload.success || !upload.upload_url || !upload.key || !upload.bucket) {
    throw new Error(upload.message ?? 'No se recibió información de carga a S3.');
  }

  await uploadFileToS3(upload.upload_url, file);

  return {
    slot,
    filename: file.name,
    s3_bucket: upload.bucket,
    s3_key: upload.key
  };
};

type DocumentSlot = Extract<DocumentType, 'invoice' | 'certificate_of_origin'>;
type ImageSlot = Extract<DocumentType, 'photo_plate' | 'photo_serial'>;

export const validateDocuments = async (
  expedientId: string,
  refs: Record<DocumentSlot, UploadedDocumentRef>
): Promise<ValidateDocumentsResponse> => {
  return postAction<ValidateDocumentsResponse>(
    'validate_documents',
    {
      expedient_id: expedientId,
      documents: {
        invoice: refs.invoice,
        certificate_of_origin: refs.certificate_of_origin
      }
    },
    compareTimeoutMs
  );
};

export const validateImages = async (
  expedientId: string,
  refs: Record<ImageSlot, UploadedDocumentRef>
): Promise<ValidateImagesResponse> => {
  return postAction<ValidateImagesResponse>(
    'validate_images',
    {
      expedient_id: expedientId,
      documents: {
        photo_plate: refs.photo_plate,
        photo_serial: refs.photo_serial
      }
    },
    compareTimeoutMs
  );
};

export const compareExpedient = async (
  expedientId: string,
  rawExtractions: Partial<Record<DocumentType, SlotExtraction>>
): Promise<CompareExpedientResponse> => {
  return postAction<CompareExpedientResponse>(
    'compare_expedient',
    {
      expedient_id: expedientId,
      raw_extractions: rawExtractions
    },
    compareTimeoutMs
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

