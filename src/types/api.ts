import { DocumentType, ExpeditionStatus } from './validation';

export type PhaseAction = 'validate_documents' | 'validate_images' | 'compare_expedient';

export interface UploadUrlResponse {
  success: boolean;
  message?: string;
  bucket?: string;
  key?: string;
  upload_url?: string;
  expires_in?: number;
}

export interface UploadedDocumentRef {
  slot: DocumentType;
  filename: string;
  s3_bucket: string;
  s3_key: string;
}

export interface SlotExtraction {
  document_valid: boolean;
  plate: string | null;
  serial: string | null;
  reason: string | null;
}

export interface PhaseResponseBase {
  success: boolean;
  message?: string;
  expedient_id?: string;
  phase?: PhaseAction;
  raw_extractions?: Partial<Record<DocumentType, SlotExtraction>>;
}

export interface ValidateDocumentsResponse extends PhaseResponseBase {
  document_validation?: {
    invoice_valid?: boolean;
    certificate_of_origin_valid?: boolean;
  };
  extracted_data?: {
    invoice_plate?: string | null;
    certificate_plate?: string | null;
    invoice_serial?: string | null;
    certificate_serial?: string | null;
  };
  messages?: string[];
}

export interface ValidateImagesResponse extends PhaseResponseBase {
  document_validation?: {
    photo_plate_valid?: boolean;
    photo_serial_valid?: boolean;
  };
  extracted_data?: {
    photo_plate?: string | null;
    photo_serial?: string | null;
  };
  messages?: string[];
}

export interface CompareExpedientResponse extends PhaseResponseBase {
  document_validation?: {
    invoice_valid?: boolean;
    certificate_of_origin_valid?: boolean;
    photo_plate_valid?: boolean;
    photo_serial_valid?: boolean;
  };
  extracted_data?: {
    invoice_plate?: string | null;
    certificate_plate?: string | null;
    photo_plate?: string | null;
    invoice_serial?: string | null;
    certificate_serial?: string | null;
    photo_serial?: string | null;
  };
  cross_validation?: {
    plate_match?: boolean | null;
    serial_match?: boolean | null;
    same_expedient?: boolean | null;
  };
  overall_status?: ExpeditionStatus | 'validated' | 'manual_review';
  messages?: string[];
}

