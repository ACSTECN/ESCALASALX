import { Modal } from './Modal';
import { AlertTriangle } from 'lucide-react';

interface ConfirmDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  loading?: boolean;
}

export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  message,
  confirmLabel = 'Confirmar',
  cancelLabel = 'Cancelar',
  loading = false,
}: ConfirmDialogProps) {
  return (
    <Modal open={open} onClose={onClose} title={title} size="sm">
      <div className="flex gap-4">
        <div className="flex-shrink-0 w-10 h-10 rounded-full bg-red-100 flex items-center justify-center">
          <AlertTriangle className="text-red-600" size={20} />
        </div>
        <p className="text-sm text-slate-600 pt-2">{message}</p>
      </div>
      <div className="flex justify-end gap-2 mt-6">
        <button className="btn-secondary" onClick={onClose} disabled={loading}>
          {cancelLabel}
        </button>
        <button
          className="btn-danger"
          onClick={() => {
            onConfirm();
          }}
          disabled={loading}
        >
          {loading ? 'Processando...' : confirmLabel}
        </button>
      </div>
    </Modal>
  );
}
