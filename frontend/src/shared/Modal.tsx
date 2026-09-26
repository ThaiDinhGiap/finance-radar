import { useState, type ReactNode } from "react";
import { X } from "lucide-react";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogTitle,
} from "../components/ui/dialog";

export function Modal({
  title,
  children,
  close,
}: {
  title: string;
  children: ReactNode;
  close: () => void;
}) {
  const [opener] = useState(() =>
    document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null,
  );
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) close();
      }}
    >
      <DialogContent
        className="modal"
        showCloseButton={false}
        finalFocus={() => opener}
      >
        <div className="modal-heading">
          <DialogTitle>{title}</DialogTitle>
          <DialogClose className="icon-button" aria-label="Đóng">
            <X size={20} />
          </DialogClose>
        </div>
        {children}
      </DialogContent>
    </Dialog>
  );
}
