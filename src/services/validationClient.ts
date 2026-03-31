import { UploadedDocument, ValidationResult } from '../types/validation';

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
const lambdaTimeoutMs = Number(import.meta.env.VITE_LAMBDA_TIMEOUT_MS ?? 45000);

const toBase64 = async (file: File): Promise<string> => {
  const bytes = await file.arrayBuffer();
  let binary = '';
  const view = new Uint8Array(bytes);
  for (let i = 0; i < view.length; i += 1) {
    binary += String.fromCharCode(view[i]);
  }
  return btoa(binary);
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
      // En validación online enviamos el slot vacío para que Lambda procese parcial sin romper contrato.
      return {
        filename: '',
        content_base64: ''
      };
    }
    return {
      filename: doc.fileName,
      content_base64: await toBase64(doc.file)
    };
  };

  const payload = {
    expedient_id: 'EXP-LOGISTICA-001',
    documents: {
      invoice: await toPayloadSlot(requiredTypes[0]),
      certificate_of_origin: await toPayloadSlot(requiredTypes[1]),
      photo_plate: await toPayloadSlot(requiredTypes[2]),
      photo_serial: await toPayloadSlot(requiredTypes[3])
    }
  };

  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), lambdaTimeoutMs);

  let response: Response;
  try {
    response = await fetch(lambdaUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload),
      signal: controller.signal
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new Error(
        `La validación excedió ${Math.round(lambdaTimeoutMs / 1000)}s. Intente con un archivo más liviano o reintente.`
      );
    }
    throw error;
  } finally {
    window.clearTimeout(timeoutId);
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
