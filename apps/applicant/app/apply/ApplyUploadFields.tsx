"use client";

import { useRef, useState } from "react";
import { Camera, FileText, Upload, X } from "lucide-react";

const CV_MAX_SIZE_BYTES = 5 * 1024 * 1024;
const PHOTO_MAX_SIZE_BYTES = 2 * 1024 * 1024;
const PHOTO_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

function formatFileSize(bytes: number): string {
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function setInputFile(input: HTMLInputElement | null, file: File | null) {
  if (!input) return;
  const transfer = new DataTransfer();
  if (file) transfer.items.add(file);
  input.files = transfer.files;
}

/** Circular, optional profile-photo upload with a live preview and initials fallback. */
export function AvatarUploadField({ initials }: { initials: string }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function accept(file: File | null) {
    if (!file) {
      setPreviewUrl(null);
      setError(null);
      setInputFile(inputRef.current, null);
      return;
    }
    if (!PHOTO_TYPES.has(file.type)) {
      setError("Use a JPG, PNG, or WebP image.");
      setInputFile(inputRef.current, null);
      return;
    }
    if (file.size > PHOTO_MAX_SIZE_BYTES) {
      setError(`That photo is ${formatFileSize(file.size)} — the limit is 2 MB.`);
      setInputFile(inputRef.current, null);
      return;
    }
    setError(null);
    setPreviewUrl(URL.createObjectURL(file));
    setInputFile(inputRef.current, file);
  }

  return (
    <div className="shrink-0">
      <div className="relative">
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="group relative flex h-16 w-16 items-center justify-center overflow-hidden rounded-full bg-brand-blue/10 text-lg font-semibold text-brand-blue ring-2 ring-white transition-shadow hover:ring-brand-blue/30"
          aria-label={previewUrl ? "Replace profile photo" : "Add a profile photo (optional)"}
        >
          {previewUrl ? (
            <img src={previewUrl} alt="" className="h-full w-full object-cover" />
          ) : (
            <span>{initials}</span>
          )}
          <span className="absolute inset-0 flex items-center justify-center bg-brand-navy/0 opacity-0 transition-opacity group-hover:bg-brand-navy/40 group-hover:opacity-100">
            <Camera className="h-5 w-5 text-white" />
          </span>
        </button>
        {previewUrl ? (
          <button
            type="button"
            onClick={() => accept(null)}
            aria-label="Remove profile photo"
            className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-white text-slate-500 shadow ring-1 ring-slate-200 hover:text-rose-600"
          >
            <X className="h-3 w-3" />
          </button>
        ) : null}
        <input
          ref={inputRef}
          type="file"
          name="photo"
          accept="image/jpeg,image/png,image/webp"
          onChange={(event) => accept(event.target.files?.[0] ?? null)}
          className="hidden"
        />
      </div>
      {error ? <p className="mt-1 max-w-[8rem] text-xs text-rose-600">{error}</p> : null}
    </div>
  );
}

/** Required CV upload with drag-and-drop, a drag-over state, and a selected-file confirmation. */
export function CvDropzone() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);

  function accept(next: File | null) {
    if (!next) {
      setFile(null);
      setError(null);
      setInputFile(inputRef.current, null);
      return;
    }
    if (next.type !== "application/pdf") {
      setError("Your CV must be a PDF file.");
      setInputFile(inputRef.current, null);
      return;
    }
    if (next.size > CV_MAX_SIZE_BYTES) {
      setError(`That file is ${formatFileSize(next.size)} — the limit is 5 MB.`);
      setInputFile(inputRef.current, null);
      return;
    }
    setError(null);
    setFile(next);
    setInputFile(inputRef.current, next);
  }

  return (
    <div>
      <div
        onDragOver={(event) => {
          event.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(event) => {
          event.preventDefault();
          setDragging(false);
          accept(event.dataTransfer.files[0] ?? null);
        }}
        onClick={() => inputRef.current?.click()}
        className={`flex cursor-pointer flex-col items-center gap-2 rounded-lg border-2 border-dashed p-6 text-center transition-colors ${
          dragging ? "border-brand-blue bg-brand-mist" : "border-slate-300 hover:border-brand-blue"
        }`}
      >
        {file ? (
          <>
            <FileText className="h-6 w-6 text-brand-blue" />
            <p className="text-sm font-medium text-slate-800">{file.name}</p>
            <p className="text-xs text-slate-500">{formatFileSize(file.size)}</p>
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                accept(null);
              }}
              className="mt-1 text-xs font-medium text-brand-blue hover:text-brand-navy"
            >
              Remove and choose a different file
            </button>
          </>
        ) : (
          <>
            <Upload className="h-6 w-6 text-slate-400" />
            <p className="text-sm font-medium text-slate-700">Drop your CV here, or click to browse</p>
            <p className="text-xs text-slate-500">PDF only, 5 MB max.</p>
          </>
        )}
      </div>
      {error ? <p className="mt-1.5 text-xs text-rose-600">{error}</p> : null}
      <input
        ref={inputRef}
        type="file"
        name="cv"
        accept="application/pdf"
        required
        onChange={(event) => accept(event.target.files?.[0] ?? null)}
        className="hidden"
      />
    </div>
  );
}
