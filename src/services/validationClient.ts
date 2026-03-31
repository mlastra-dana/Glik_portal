import { UploadedDocument, ValidationResult } from '../types/validation';

interface LambdaValidationResponse {
  ok: boolean;
  result?: ValidationResult;
  message?: string;
}

const lambdaUrl = import.meta.env.VITE_NOMBRE_FUNCION_LAMBDA_URL;

export const runLambdaValidation = async (
  uploadedDocuments: UploadedDocument[]
): Promise<ValidationResult> => {
  if (!lambdaUrl) {
    throw new Error('Falta VITE_NOMBRE_FUNCION_LAMBDA_URL en el entorno local.');
  }

  const response = await fetch(lambdaUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      documents: uploadedDocuments.map((doc) => ({
        type: doc.type,
        fileName: doc.fileName
      }))
    })
  });

  const payload = (await response.json()) as LambdaValidationResponse;
  if (!response.ok || !payload.ok || !payload.result) {
    throw new Error(payload.message ?? 'No se obtuvo un resultado válido desde Lambda.');
  }

  return payload.result;
};
