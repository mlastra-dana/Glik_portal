import { SlotValidationResult, UploadedDocument, ValidationResult } from '../types/validation';

interface LambdaValidationResponse {
  ok: boolean;
  result?: ValidationResult;
  message?: string;
}

interface LambdaBackendResponse {
  success: boolean;
  message?: string;
  overall_status?: 'validated' | 'manual_review';
  messages?: string[];
  document_validation?: {
    invoice_valid?: boolean;
    certificate_of_origin_valid?: boolean;
    photo_plate_valid?: boolean;
    photo_serial_valid?: boolean;
  };
  cross_validation?: {
    plate_match?: boolean | null;
    serial_match?: boolean | null;
  };
}

const lambdaUrl = import.meta.env.VITE_NOMBRE_FUNCION_LAMBDA_URL;
const uploadSignerUrl = import.meta.env.VITE_UPLOAD_SIGNER_URL || lambdaUrl;
const useS3Upload = String(import.meta.env.VITE_USE_S3_UPLOAD ?? 'true') === 'true';
const configuredBucketName = import.meta.env.VITE_S3_BUCKET_NAME;
const lambdaTimeoutMs = Number(import.meta.env.VITE_LAMBDA_TIMEOUT_MS ?? 45000);
const networkTimeoutMs = Number(import.meta.env.VITE_NETWORK_TIMEOUT_MS ?? 30000);
const uploadTimeoutMs = Number(import.meta.env.VITE_UPLOAD_TIMEOUT_MS ?? 120000);

interface SlotValidationBackendResponse {
  success: boolean;
  message?: string;
  slot?: UploadedDocument['type'];
  result?: {
    document_valid?: boolean;
    plate?: string | null;
    serial?: string | null;
    reason?: string | null;
  };
}

const toBase64 = async (file: File): Promise<string> => {
  const bytes = await file.arrayBuffer();
  let binary = '';
  const view = new Uint8Array(bytes);
  for (let i = 0; i < view.length; i += 1) {
    binary += String.fromCharCode(view[i]);
  }
  return btoa(binary);
};

interface PresignResponse {
  success: boolean;
  message?: string;
  bucket?: string;
  key?: string;
  upload_url?: string;
}

const fetchWithTimeout = async (
  input: RequestInfo | URL,
  init: RequestInit,
  timeoutMs: number,
  timeoutMessage: string
) => {
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(input, {
      ...init,
      signal: controller.signal
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new Error(timeoutMessage);
    }
    throw error;
  } finally {
    window.clearTimeout(timeoutId);
  }
};

const createPresignedUrl = async (slot: UploadedDocument['type'], file: File) => {
  if (!uploadSignerUrl) {
    throw new Error('Falta VITE_UPLOAD_SIGNER_URL o VITE_NOMBRE_FUNCION_LAMBDA_URL.');
  }

  const response = await fetchWithTimeout(
    uploadSignerUrl,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        action: 'create_upload_url',
        slot,
        filename: file.name,
        content_type: file.type || 'application/octet-stream'
      })
    },
    networkTimeoutMs,
    'Se agotó el tiempo al solicitar URL de carga.'
  );

  const body = (await response.json()) as PresignResponse;
  if (!response.ok || !body.success || !body.upload_url || !body.key) {
    throw new Error(body.message ?? 'No se pudo obtener URL de carga a S3.');
  }

  return {
    uploadUrl: body.upload_url,
    key: body.key,
    bucket: body.bucket || configuredBucketName
  };
};

const uploadFileToS3 = async (slot: UploadedDocument['type'], file: File) => {
  const { uploadUrl, key, bucket } = await createPresignedUrl(slot, file);
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
    `Se agotó el tiempo subiendo ${file.name} al bucket.`
  );

  if (!putResponse.ok) {
    throw new Error(`Falló carga a bucket para ${slot}. HTTP ${putResponse.status}`);
  }

  if (!bucket) {
    throw new Error('No se recibió bucket de destino para validación.');
  }

  return { bucket, key };
};

const buildDocumentPayload = async (
  slot: UploadedDocument['type'],
  file: File,
  fileName: string
): Promise<Record<string, string>> => {
  if (useS3Upload) {
    const location = await uploadFileToS3(slot, file);
    return {
      filename: fileName,
      s3_bucket: location.bucket,
      s3_key: location.key
    };
  }

  return {
    filename: fileName,
    content_base64: await toBase64(file)
  };
};

export const validateDocumentSlot = async (
  slot: UploadedDocument['type'],
  file: File,
  fileName: string
): Promise<SlotValidationResult> => {
  if (!lambdaUrl) {
    throw new Error('Falta VITE_NOMBRE_FUNCION_LAMBDA_URL en el entorno local.');
  }

  const documentPayload = await buildDocumentPayload(slot, file, fileName);
  const response = await fetchWithTimeout(
    lambdaUrl,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        action: 'validate_slot',
        slot,
        document: documentPayload
      })
    },
    lambdaTimeoutMs,
    `La validación del documento excedió ${Math.round(lambdaTimeoutMs / 1000)}s. Reintente.`
  );

  const body = (await response.json()) as SlotValidationBackendResponse;
  if (!response.ok || !body.success || !body.result) {
    throw new Error(body.message ?? 'No se pudo validar el documento en Lambda.');
  }

  return {
    slot,
    document_valid: Boolean(body.result.document_valid),
    plate: body.result.plate ?? null,
    serial: body.result.serial ?? null,
    reason: body.result.reason ?? null
  };
};

const normalizePlate = (value: string | null | undefined): string | null => {
  if (!value) return null;
  const normalized = value.replace(/\s+/g, '').toUpperCase().trim();
  return normalized || null;
};

const normalizeSerial = (value: string | null | undefined): string | null => {
  if (!value) return null;
  const normalized = value.toUpperCase().replace(/[^A-Z0-9]/g, '').trim();
  return normalized || null;
};

const aggregateMatch = (values: Array<string | null>, mode: 'plate' | 'serial'): boolean => {
  const validValues = values
    .map((value) => (mode === 'plate' ? normalizePlate(value) : normalizeSerial(value)))
    .filter((value): value is string => Boolean(value));
  if (validValues.length <= 1) {
    return false;
  }
  return validValues.every((value) => value === validValues[0]);
};

export const buildValidationResultFromSlots = (
  slotResults: Partial<Record<UploadedDocument['type'], SlotValidationResult>>
): ValidationResult => {
  const invoice = slotResults.invoice;
  const certificate = slotResults.certificate_of_origin;
  const photoPlate = slotResults.photo_plate;
  const photoSerial = slotResults.photo_serial;

  const invoiceValid = Boolean(invoice?.document_valid);
  const certificateValid = Boolean(certificate?.document_valid);
  const photoPlateValid = Boolean(photoPlate?.document_valid);
  const photoSerialValid = Boolean(photoSerial?.document_valid);

  const plateMatch = aggregateMatch([invoice?.plate ?? null, certificate?.plate ?? null, photoPlate?.plate ?? null], 'plate');
  const serialMatch = aggregateMatch(
    [invoice?.serial ?? null, certificate?.serial ?? null, photoSerial?.serial ?? null],
    'serial'
  );

  const sameExpedient = invoiceValid && certificateValid && photoPlateValid && photoSerialValid && plateMatch && serialMatch;

  const messages = [
    invoiceValid ? 'La factura corresponde al tipo documental esperado.' : `La factura: ${invoice?.reason ?? 'Documento inválido.'}`,
    certificateValid
      ? 'El certificado de origen corresponde al tipo documental esperado.'
      : `El certificado de origen: ${certificate?.reason ?? 'Documento inválido.'}`,
    photoPlateValid ? 'La fotoplaca corresponde al tipo documental esperado.' : `La fotoplaca: ${photoPlate?.reason ?? 'Documento inválido.'}`,
    photoSerialValid ? 'El fotoserial corresponde al tipo documental esperado.' : `El fotoserial: ${photoSerial?.reason ?? 'Documento inválido.'}`,
    plateMatch ? 'La placa coincide entre documentos e imagen.' : 'La placa no coincide o no fue posible validarla en todas las fuentes.',
    serialMatch ? 'El serial coincide entre documentos e imagen.' : 'El serial no coincide o no fue posible validarlo en todas las fuentes.'
  ];

  return {
    invoice_document_valid: invoiceValid,
    certificate_document_valid: certificateValid,
    photo_plate_valid: photoPlateValid,
    photo_serial_valid: photoSerialValid,
    plate_match: plateMatch,
    serial_match: serialMatch,
    overall_status: sameExpedient ? 'validated' : 'manual_review',
    messages
  };
};

export const runLambdaValidation = async (
  uploadedDocuments: UploadedDocument[]
): Promise<ValidationResult> => {
  if (!lambdaUrl) {
    throw new Error('Falta VITE_NOMBRE_FUNCION_LAMBDA_URL en el entorno local.');
  }

  const byType = Object.fromEntries(uploadedDocuments.map((doc) => [doc.type, doc])) as Record<
    UploadedDocument['type'],
    UploadedDocument
  >;

  const requiredTypes: UploadedDocument['type'][] = ['invoice', 'certificate_of_origin', 'photo_plate', 'photo_serial'];

  const toPayloadSlot = async (type: UploadedDocument['type']) => {
    const doc = byType[type];
    if (!doc?.file || !doc?.fileName) {
      return {
        filename: '',
        content_base64: ''
      };
    }

    return buildDocumentPayload(type, doc.file, doc.fileName);
  };

  const slotPayloads = await Promise.all(requiredTypes.map((type) => toPayloadSlot(type)));
  const payload = {
    expedient_id: 'EXP-LOGISTICA-001',
    documents: {
      invoice: slotPayloads[0],
      certificate_of_origin: slotPayloads[1],
      photo_plate: slotPayloads[2],
      photo_serial: slotPayloads[3]
    }
  };

  let response: Response;
  try {
    response = await fetchWithTimeout(
      lambdaUrl,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      },
      lambdaTimeoutMs,
      `La validación excedió ${Math.round(lambdaTimeoutMs / 1000)}s. Reintente en unos segundos.`
    );
  } catch (error) {
    throw error;
  }

  const body = (await response.json()) as LambdaBackendResponse | LambdaValidationResponse;
  if (!response.ok) {
    throw new Error((body as LambdaBackendResponse).message ?? 'Lambda devolvió un error HTTP.');
  }

  const backendBody = body as LambdaBackendResponse;
  if (!backendBody.success) {
    throw new Error(backendBody.message ?? 'La validación en Lambda no fue exitosa.');
  }

  return {
    invoice_document_valid: Boolean(backendBody.document_validation?.invoice_valid),
    certificate_document_valid: Boolean(backendBody.document_validation?.certificate_of_origin_valid),
    photo_plate_valid: Boolean(backendBody.document_validation?.photo_plate_valid),
    photo_serial_valid: Boolean(backendBody.document_validation?.photo_serial_valid),
    plate_match: Boolean(backendBody.cross_validation?.plate_match),
    serial_match: Boolean(backendBody.cross_validation?.serial_match),
    overall_status: backendBody.overall_status === 'validated' ? 'validated' : 'manual_review',
    messages:
      backendBody.messages && backendBody.messages.length > 0
        ? backendBody.messages
        : ['Validación ejecutada. Revise el detalle del expediente.']
  };
};
