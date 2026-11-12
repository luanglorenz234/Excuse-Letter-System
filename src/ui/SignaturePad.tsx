import { useEffect, useRef, type PointerEvent, type ReactNode } from 'react';
import { Button } from './components';
import { safeImageSrc } from './letter/Letter';

export interface SignaturePadProps {
  /** The signature so far, as an image; drawn into the pad when it changes from outside. */
  readonly value: string;
  readonly onChange: (dataUrl: string) => void;
  readonly label: string;
  readonly small?: boolean | undefined;
  /** Extra buttons beside Clear, e.g. "Use saved signature". */
  readonly extra?: ReactNode;
  /** Upload a PNG/JPG instead of drawing. */
  readonly allowUpload?: boolean | undefined;
}

/** A pad to sign on with a mouse, pen or finger. Each finished stroke saves the whole pad as a PNG. */
export function SignaturePad({ value, onChange, label, small = false, extra, allowUpload = false }: SignaturePadProps) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const drawn = useRef<string>(''); // what the pad itself last produced
  const drawing = useRef(false);

  // Draw a signature that came from outside (saved signature, upload, an edit).
  useEffect(() => {
    const el = canvas.current;
    const ctx = el?.getContext('2d');
    if (!el || !ctx || value === drawn.current) return;
    ctx.clearRect(0, 0, el.width, el.height);
    drawn.current = value;
    const src = safeImageSrc(value);
    if (!src) return;
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(el.width / img.width, el.height / img.height, 1);
      const w = img.width * scale;
      const h = img.height * scale;
      ctx.drawImage(img, (el.width - w) / 2, (el.height - h) / 2, w, h);
    };
    img.src = src;
  }, [value]);

  const pos = (e: PointerEvent<HTMLCanvasElement>) => {
    const el = e.currentTarget;
    const rect = el.getBoundingClientRect();
    return { x: ((e.clientX - rect.left) / rect.width) * el.width, y: ((e.clientY - rect.top) / rect.height) * el.height };
  };

  const finish = () => {
    if (!drawing.current || !canvas.current) return;
    drawing.current = false;
    const url = canvas.current.toDataURL('image/png');
    drawn.current = url;
    onChange(url);
  };

  return (
    <div className="sig-pad">
      <canvas
        ref={canvas}
        className={`sig-pad__canvas${small ? ' sig-pad__canvas--small' : ''}`}
        width={400}
        height={small ? 96 : 130}
        aria-label={label}
        role="img"
        onPointerDown={(e) => {
          e.preventDefault();
          const ctx = e.currentTarget.getContext('2d');
          if (!ctx) return;
          try {
            e.currentTarget.setPointerCapture(e.pointerId);
          } catch {
            // already released; drawing still works
          }
          ctx.strokeStyle = '#0c2340';
          ctx.lineWidth = 2.2;
          ctx.lineCap = 'round';
          ctx.lineJoin = 'round';
          const p = pos(e);
          ctx.beginPath();
          ctx.moveTo(p.x, p.y);
          drawing.current = true;
        }}
        onPointerMove={(e) => {
          if (!drawing.current) return;
          const ctx = e.currentTarget.getContext('2d');
          const p = pos(e);
          ctx?.lineTo(p.x, p.y);
          ctx?.stroke();
        }}
        onPointerUp={finish}
        onPointerCancel={finish}
      />
      <div className="sig-pad__foot">
        <span>{value ? 'Signed' : `${label}: sign above`}</span>
        <div className="row">
          {allowUpload ? (
            <label className="button button--ghost button--small" style={{ cursor: 'pointer' }}>
              <span className="button__label">Upload image</span>
              <input
                type="file"
                accept="image/png,image/jpeg"
                hidden
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  const reader = new FileReader();
                  reader.onload = () => typeof reader.result === 'string' && onChange(reader.result);
                  reader.readAsDataURL(file);
                  e.target.value = '';
                }}
              />
            </label>
          ) : null}
          {extra}
          <Button size="small" variant="ghost" onClick={() => onChange('')}>
            Clear
          </Button>
        </div>
      </div>
    </div>
  );
}

/** Shrinks a photo so it fits comfortably in one record (and later one Firestore document, 1 MB). */
export function compressImageFile(file: File, maxDim = 1600, maxChars = 700_000): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith('image/')) {
      reject(new Error('Please choose an image file (JPG or PNG).'));
      return;
    }
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Could not read that file.'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('That image could not be opened.'));
      img.onload = () => {
        let dim = maxDim;
        let quality = 0.75;
        for (let attempt = 0; attempt < 6; attempt++) {
          const scale = Math.min(1, dim / Math.max(img.width, img.height));
          const c = document.createElement('canvas');
          c.width = Math.round(img.width * scale);
          c.height = Math.round(img.height * scale);
          const ctx = c.getContext('2d');
          if (!ctx) break;
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(0, 0, c.width, c.height);
          ctx.drawImage(img, 0, 0, c.width, c.height);
          const url = c.toDataURL('image/jpeg', quality);
          if (url.length <= maxChars) {
            resolve(url);
            return;
          }
          dim = Math.round(dim * 0.8);
          quality = Math.max(0.5, quality - 0.07);
        }
        reject(new Error('That photo is too large even after shrinking. Try a smaller or clearer photo.'));
      };
      img.src = String(reader.result);
    };
    reader.readAsDataURL(file);
  });
}
