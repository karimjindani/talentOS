"use client";

import { useActionState, useEffect, useRef, useState } from "react";

type ResourceType = "MARKDOWN" | "YOUTUBE" | "DOCUMENT";

export type ResourceFormDefaults = {
  id?: string;
  type?: ResourceType;
  title?: string;
  url?: string | null;
  markdownContent?: string | null;
  description?: string | null;
  order?: number;
  durationSeconds?: number | null;
  fileId?: string | null;
  file?: { id: string; originalName: string } | null;
};

type ServerAction = (formData: FormData) => Promise<void>;
type ActionState = { ok: boolean; error?: string };

const inputClass = "mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm";
const labelClass = "block text-xs font-medium text-slate-600";

const ACCEPTED_FILE_TYPES = ".pdf,.doc,.docx,.txt,.png,.jpg,.jpeg,.webp";

/** Client resource form used for both adding (collapsible, auto-collapses after save) and editing a
 * learning resource. Supports Markdown, YouTube and uploaded Documents; documents are uploaded
 * straight to storage (presign → PUT → confirm) and linked by fileId. */
export function ResourceForm({
  mode,
  programId,
  taskId,
  defaults,
  createResource,
  updateResource,
  deleteResource
}: {
  mode: "add" | "edit";
  programId: string;
  taskId: string;
  defaults?: ResourceFormDefaults;
  createResource?: ServerAction;
  updateResource?: ServerAction;
  deleteResource?: ServerAction;
}) {
  const [open, setOpen] = useState(false);
  const [type, setType] = useState<ResourceType>(defaults?.type ?? "MARKDOWN");
  const [fileId, setFileId] = useState<string | null>(defaults?.fileId ?? null);
  const [fileName, setFileName] = useState<string | null>(defaults?.file?.originalName ?? null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const formRef = useRef<HTMLFormElement>(null);

  const primaryAction = mode === "add" ? createResource : updateResource;

  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    async (_prev, formData) => {
      if (!primaryAction) return { ok: false, error: "No action configured." };
      try {
        await primaryAction(formData);
        return { ok: true };
      } catch (error) {
        return { ok: false, error: error instanceof Error ? error.message : "Something went wrong." };
      }
    },
    { ok: false }
  );

  // Collapse back to the single-line row after saving (both add and edit); the add form also resets.
  useEffect(() => {
    if (!state.ok) return;
    if (mode === "add") {
      setType("MARKDOWN");
      setFileId(null);
      setFileName(null);
      setUploadError(null);
      formRef.current?.reset();
    }
    setOpen(false);
  }, [state, mode]);

  // Opening an existing resource for editing seeds the form from the latest saved values.
  function openEdit() {
    setType(defaults?.type ?? "MARKDOWN");
    setFileId(defaults?.fileId ?? null);
    setFileName(defaults?.file?.originalName ?? null);
    setUploadError(null);
    setOpen(true);
  }

  async function onFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setUploadError(null);
    setFileId(null);
    setFileName(null);
    try {
      const presignRes = await fetch("/api/files/presign-upload", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ filename: file.name, contentType: file.type, size: file.size, category: "learning-resource" })
      });
      if (!presignRes.ok) {
        const body = (await presignRes.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? "Could not start the upload.");
      }
      const { fileId: uploadedId, uploadUrl } = (await presignRes.json()) as { fileId: string; uploadUrl: string };
      const put = await fetch(uploadUrl, { method: "PUT", headers: { "content-type": file.type }, body: file });
      if (!put.ok) throw new Error("Upload to storage failed.");
      const confirm = await fetch(`/api/files/${uploadedId}/confirm`, { method: "POST" });
      if (!confirm.ok) throw new Error("Could not confirm the upload.");
      setFileId(uploadedId);
      setFileName(file.name);
    } catch (error) {
      setUploadError(error instanceof Error ? error.message : "Upload failed.");
    } finally {
      setUploading(false);
    }
  }

  if (mode === "add" && !open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="mt-3 inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-emerald-700"
      >
        + Add learning resource
      </button>
    );
  }

  // Existing resources render as a compact single-line row; expand to the full form via Edit.
  if (mode === "edit" && !open) {
    const typeLabel = defaults?.type === "YOUTUBE" ? "Video" : defaults?.type === "DOCUMENT" ? "Document" : "Reading";
    const urlPending = defaults?.type === "YOUTUBE" && !defaults?.url;
    return (
      <div className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white px-3 py-2">
        <div className="flex min-w-0 items-center gap-2">
          <span className="shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-600">{typeLabel}</span>
          <span className="truncate text-sm font-medium text-slate-800">{defaults?.title || "Untitled resource"}</span>
          {urlPending ? <span className="shrink-0 text-xs font-medium text-amber-700">URL pending</span> : null}
        </div>
        <div className="flex shrink-0 items-center gap-3">
          <button type="button" onClick={openEdit} className="text-sm font-semibold text-brand-blue hover:underline">
            Edit
          </button>
          {deleteResource ? (
            <form action={deleteResource}>
              <input type="hidden" name="id" value={defaults?.id ?? ""} />
              <input type="hidden" name="programId" value={programId} />
              <button type="submit" className="text-sm font-semibold text-red-600 hover:underline">
                Delete
              </button>
            </form>
          ) : null}
        </div>
      </div>
    );
  }

  const documentMissing = type === "DOCUMENT" && !fileId;
  const containerClass =
    mode === "add"
      ? "mt-3 rounded-xl border border-dashed border-slate-300 bg-white p-3"
      : "rounded-xl border border-slate-200 bg-slate-50 p-3";

  return (
    <form ref={formRef} action={formAction} className={containerClass}>
      <input type="hidden" name="programId" value={programId} />
      <input type="hidden" name="taskId" value={taskId} />
      {mode === "edit" && defaults?.id ? <input type="hidden" name="id" value={defaults.id} /> : null}
      {/* Documents carry a fileId; other types submit empty so the link is cleared. */}
      <input type="hidden" name="fileId" value={type === "DOCUMENT" ? fileId ?? "" : ""} />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <label className={labelClass}>
          Type
          <select
            name="type"
            value={type}
            onChange={(event) => setType(event.target.value as ResourceType)}
            className={inputClass}
          >
            <option value="MARKDOWN">Markdown (reading)</option>
            <option value="YOUTUBE">YouTube (video)</option>
            <option value="DOCUMENT">Document (upload)</option>
          </select>
        </label>
        <label className={labelClass}>
          Title
          <input name="title" required defaultValue={defaults?.title ?? ""} className={inputClass} />
        </label>
        <label className={labelClass}>
          Description
          <input name="description" defaultValue={defaults?.description ?? ""} className={inputClass} />
        </label>
        <label className={labelClass}>
          Order
          <input name="order" type="number" min={0} defaultValue={defaults?.order ?? 0} className={inputClass} />
        </label>
        <label className={labelClass}>
          Duration (seconds)
          <input name="durationSeconds" type="number" min={1} defaultValue={defaults?.durationSeconds ?? ""} className={inputClass} />
        </label>
      </div>

      {type === "YOUTUBE" ? (
        <label className={`${labelClass} mt-3`}>
          YouTube URL
          <input name="url" type="url" defaultValue={defaults?.url ?? ""} placeholder="https://www.youtube.com/..." className={inputClass} />
        </label>
      ) : null}

      {type === "MARKDOWN" ? (
        <label className={`${labelClass} mt-3`}>
          Markdown content
          <textarea name="markdownContent" rows={5} defaultValue={defaults?.markdownContent ?? ""} className={inputClass} />
        </label>
      ) : null}

      {type === "DOCUMENT" ? (
        <div className="mt-3">
          <label className={labelClass}>
            Document file
            <input
              type="file"
              accept={ACCEPTED_FILE_TYPES}
              onChange={onFileChange}
              disabled={uploading}
              className="mt-1 block w-full text-sm text-slate-700 file:mr-3 file:rounded-lg file:border-0 file:bg-brand-blue file:px-3 file:py-1.5 file:text-sm file:font-semibold file:text-white hover:file:bg-brand-navy"
            />
          </label>
          {uploading ? <p className="mt-2 text-xs text-slate-500">Uploading…</p> : null}
          {fileName ? (
            <p className="mt-2 text-xs font-medium text-emerald-700">✓ {fileName} attached</p>
          ) : defaults?.file ? (
            <p className="mt-2 text-xs text-slate-600">Current file: {defaults.file.originalName}</p>
          ) : null}
          {uploadError ? <p className="mt-2 text-xs text-rose-600">{uploadError}</p> : null}
          <p className="mt-1 text-xs text-slate-500">PDF, DOC, DOCX, TXT or image, up to 10 MB.</p>
        </div>
      ) : null}

      {state.error ? <p className="mt-3 text-sm text-rose-600">{state.error}</p> : null}

      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="submit"
          disabled={pending || uploading || documentMissing}
          className="rounded-lg bg-brand-blue px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-brand-navy disabled:cursor-not-allowed disabled:opacity-60"
        >
          {mode === "add" ? "Add resource" : "Save"}
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100"
        >
          Cancel
        </button>
        {mode === "edit" && deleteResource ? (
          <button type="submit" formAction={deleteResource} className="rounded-lg border border-red-300 px-3 py-2 text-sm font-semibold text-red-700">
            Delete
          </button>
        ) : null}
      </div>
    </form>
  );
}
