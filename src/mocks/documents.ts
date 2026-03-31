import { DocumentType, UploadedDocument } from '../types/validation';

export const documentSlotsSeed: UploadedDocument[] = [
  {
    type: 'invoice',
    label: 'Factura',
    file: null,
    fileName: null,
    status: 'pending',
    required: true
  },
  {
    type: 'certificate_of_origin',
    label: 'Certificado de origen',
    file: null,
    fileName: null,
    status: 'pending',
    required: true
  },
  {
    type: 'photo_plate',
    label: 'Fotoplaca',
    file: null,
    fileName: null,
    status: 'pending',
    required: true
  },
  {
    type: 'photo_serial',
    label: 'Fotoserial',
    file: null,
    fileName: null,
    status: 'pending',
    required: true
  }
];

export const expectedDocumentTypeHints: Record<DocumentType, string[]> = {
  invoice: ['factura', 'invoice', 'compra'],
  certificate_of_origin: ['origen', 'certificate', 'certificado'],
  photo_plate: ['placa', 'plate', 'fotoplaca'],
  photo_serial: ['serial', 'vin', 'fotoserial']
};
