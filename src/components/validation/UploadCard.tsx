import { ChangeEvent, useRef } from 'react';
import { DocumentType, UploadedDocument } from '../../types/validation';
import StatusBadge from '../ui/StatusBadge';

interface UploadCardProps {
  document: UploadedDocument;
  onSelectFile: (type: UploadedDocument['type'], file: File) => void;
  onClear: (type: UploadedDocument['type']) => void;
}

const iconByDocument: Record<DocumentType, JSX.Element> = {
  invoice: (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M7 3h7l5 5v13H7z" />
      <path d="M14 3v5h5" />
      <path d="M10 13h6M10 17h6" />
    </svg>
  ),
  certificate_of_origin: (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M5 4h14v16H5z" />
      <path d="M8 9h8M8 13h8" />
      <circle cx="9" cy="17" r="1.4" />
    </svg>
  ),
  photo_plate: (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8">
      <rect x="3" y="6" width="18" height="12" rx="2" />
      <path d="M7 12h10M7 9h2M15 15h2" />
    </svg>
  ),
  photo_serial: (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8">
      <rect x="3" y="6" width="18" height="12" rx="2" />
      <path d="M7 10h2M11 10h2M15 10h2M7 14h10" />
    </svg>
  )
};

const UploadCard = ({ document, onSelectFile, onClear }: UploadCardProps) => {
  const inputRef = useRef<HTMLInputElement | null>(null);

  const handleOpenFilePicker = () => {
    inputRef.current?.click();
  };

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      onSelectFile(document.type, file);
    }
  };

  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-soft">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="rounded-lg bg-blue-50 p-2 text-glik-primary">{iconByDocument[document.type]}</div>
          <div>
            <h3 className="text-base font-bold text-glik-secondary">{document.label}</h3>
            <p className="mt-1 text-xs text-slate-600">{document.description}</p>
            <p className="mt-1 text-[11px] text-slate-500">Formato permitido: {document.acceptedFormats}</p>
          </div>
        </div>
        <StatusBadge status={document.status} />
      </div>

      <button
        type="button"
        onClick={handleOpenFilePicker}
        className="mt-4 flex w-full items-center justify-between rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-3 text-left transition hover:border-glik-primary hover:bg-blue-50/40"
      >
        <span className="text-sm font-medium text-slate-700">
          {document.fileName ? document.fileName : 'Seleccione o arrastre el archivo correspondiente'}
        </span>
        <span className="text-xs font-semibold text-glik-primary">Cargar</span>
      </button>

      <div className="mt-4 flex flex-wrap gap-2">
        <button type="button" className="btn-primary px-4 py-2" onClick={handleOpenFilePicker}>
          {document.fileName ? 'Reemplazar archivo' : 'Seleccionar archivo'}
        </button>
        {document.fileName ? (
          <button
            type="button"
            className="btn-secondary border-rose-300 text-rose-700 hover:border-rose-500 hover:text-rose-700"
            onClick={() => onClear(document.type)}
          >
            Eliminar
          </button>
        ) : null}
      </div>

      <input
        ref={inputRef}
        type="file"
        onChange={handleFileChange}
        className="hidden"
        accept=".pdf,.png,.jpg,.jpeg"
      />
    </article>
  );
};

export default UploadCard;
