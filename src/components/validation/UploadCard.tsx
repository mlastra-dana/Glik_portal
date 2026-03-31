import { ChangeEvent, useRef } from 'react';
import { UploadedDocument } from '../../types/validation';
import StatusBadge from '../ui/StatusBadge';

interface UploadCardProps {
  document: UploadedDocument;
  onSelectFile: (type: UploadedDocument['type'], file: File) => void;
  onClear: (type: UploadedDocument['type']) => void;
}

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
        <div>
          <h3 className="font-display text-lg font-bold text-glik-secondary">{document.label}</h3>
          <p className="mt-1 text-xs text-slate-500">Formatos sugeridos: PDF, JPG, PNG.</p>
        </div>
        <StatusBadge status={document.status} />
      </div>

      <div className="mt-4 rounded-xl bg-slate-50 p-4">
        {document.fileName ? (
          <p className="text-sm font-medium text-slate-700">{document.fileName}</p>
        ) : (
          <p className="text-sm text-slate-500">Aún no has cargado este documento.</p>
        )}
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <button type="button" className="btn-primary px-4 py-2" onClick={handleOpenFilePicker}>
          {document.fileName ? 'Reemplazar' : 'Seleccionar archivo'}
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
