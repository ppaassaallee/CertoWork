import { useMemo, useRef, useState, type ChangeEvent, type DragEvent } from "react";
import { FileText, Paperclip, Trash2, X } from "./Icon";
import { Button } from "./Button";
import { Kbd } from "./Kbd";

export type MediaAsset = {
  id: string;
  name: string;
  url?: string;
  mimeType?: string;
  sizeBytes?: number;
  thumbnailUrl?: string;
};

export type MediaPickerProps = {
  open: boolean;
  onClose: () => void;
  onAdd: (payload: { files: File[]; selected: MediaAsset[] }) => void | Promise<void>;
  projectMedia?: MediaAsset[];
  recentMedia?: MediaAsset[];
  accept?: string;
  busy?: boolean;
  title?: string;
};

function formatBytes(size?: number) {
  if (!size || size < 0) return "—";
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

function typeLabel(mime?: string, name?: string) {
  if (mime?.startsWith("image/")) return "Image";
  if (mime === "application/pdf" || name?.toLowerCase().endsWith(".pdf")) return "PDF";
  if (mime) return mime.split("/").pop()?.toUpperCase() || "File";
  const ext = name?.split(".").pop();
  return ext ? ext.toUpperCase() : "File";
}

/** Two-pane media picker: upload left, numbered gallery right. */
export function MediaPicker({
  open,
  onClose,
  onAdd,
  projectMedia = [],
  recentMedia = [],
  accept = "image/*,application/pdf,.doc,.docx,.xls,.xlsx,.txt,.md",
  busy = false,
  title = "Add media",
}: MediaPickerProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [dragging, setDragging] = useState(false);

  const gallery = useMemo(() => {
    const seen = new Set<string>();
    const out: MediaAsset[] = [];
    for (const item of [...projectMedia, ...recentMedia]) {
      if (seen.has(item.id)) continue;
      seen.add(item.id);
      out.push(item);
    }
    return out;
  }, [projectMedia, recentMedia]);

  const selected = selectedIds
    .map((id) => gallery.find((item) => item.id === id))
    .filter(Boolean) as MediaAsset[];

  const reset = () => {
    setFiles([]);
    setSelectedIds([]);
    setDragging(false);
  };

  const close = () => {
    reset();
    onClose();
  };

  const addFiles = (list: FileList | File[]) => {
    const next = Array.from(list);
    if (!next.length) return;
    setFiles((current) => [...current, ...next]);
  };

  const onDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setDragging(false);
    if (event.dataTransfer.files?.length) addFiles(event.dataTransfer.files);
  };

  const toggleSelect = (id: string) => {
    setSelectedIds((current) => {
      if (current.includes(id)) return current.filter((item) => item !== id);
      return [...current, id];
    });
  };

  const selectionNumber = (id: string) => {
    const index = selectedIds.indexOf(id);
    return index >= 0 ? index + 1 : null;
  };

  if (!open) return null;

  return (
    <div
      aria-label={title}
      aria-modal="true"
      className="cw-media"
      data-testid="media-picker"
      role="dialog"
    >
      <button aria-label="Close" className="cw-media-scrim" onClick={close} type="button" />
      <div className="cw-media-panel">
        <header className="cw-media-head">
          <strong>{title}</strong>
          <button aria-label="Close" onClick={close} type="button">
            <X size={16} />
          </button>
        </header>
        <div className="cw-media-body">
          <section className="cw-media-upload">
            <div
              className={`cw-media-drop ${dragging ? "is-dragging" : ""}`}
              onDragLeave={() => setDragging(false)}
              onDragOver={(event) => {
                event.preventDefault();
                setDragging(true);
              }}
              onDrop={onDrop}
            >
              <Paperclip size={18} />
              <p>Drop files here or browse</p>
              <Button
                onClick={() => inputRef.current?.click()}
                size="sm"
                type="button"
                variant="secondary"
              >
                Browse
              </Button>
              <input
                accept={accept}
                hidden
                multiple
                onChange={(event: ChangeEvent<HTMLInputElement>) => {
                  if (event.target.files) addFiles(event.target.files);
                  event.target.value = "";
                }}
                ref={inputRef}
                type="file"
              />
            </div>
            <ul className="cw-media-file-list">
              {files.map((file, index) => (
                <li key={`${file.name}-${index}`}>
                  <span className="cw-media-thumb" aria-hidden="true">
                    <FileText size={14} />
                  </span>
                  <span className="cw-media-file-meta">
                    <strong>{file.name}</strong>
                    <small>
                      {formatBytes(file.size)} · {typeLabel(file.type, file.name)}
                    </small>
                  </span>
                  <button
                    aria-label={`Remove ${file.name}`}
                    onClick={() =>
                      setFiles((current) => current.filter((_, i) => i !== index))
                    }
                    type="button"
                  >
                    <Trash2 size={14} />
                  </button>
                </li>
              ))}
            </ul>
          </section>
          <section className="cw-media-gallery">
            <div className="cw-media-gallery-head">
              <span>Project media & recents</span>
              {selectedIds.length > 0 && (
                <button onClick={() => setSelectedIds([])} type="button">
                  Clear all
                </button>
              )}
            </div>
            {gallery.length === 0 ? (
              <p className="cw-media-gallery-empty">No media yet in this project.</p>
            ) : (
              <ul className="cw-media-grid">
                {gallery.map((asset) => {
                  const number = selectionNumber(asset.id);
                  return (
                    <li key={asset.id}>
                      <button
                        className={number ? "is-selected" : ""}
                        onClick={() => toggleSelect(asset.id)}
                        type="button"
                      >
                        {number && <em>{number}</em>}
                        {asset.thumbnailUrl || asset.url ? (
                          <img alt="" src={asset.thumbnailUrl || asset.url} />
                        ) : (
                          <FileText size={18} />
                        )}
                        <span>{asset.name}</span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        </div>
        <footer className="cw-media-foot">
          <Button disabled={busy} onClick={close} type="button" variant="secondary">
            Cancel
          </Button>
          <Button
            disabled={busy || (files.length === 0 && selected.length === 0)}
            onClick={() => void onAdd({ files, selected })}
            type="button"
            variant="primary"
          >
            Add
            <Kbd>↵</Kbd>
          </Button>
        </footer>
      </div>
    </div>
  );
}
