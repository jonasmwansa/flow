import { useState } from "react";

import { ApiError } from "../lib/api";
import { CATEGORIES } from "../utils/types";
import {
  alertError,
  btnPrimary,
  btnSecondary,
  fieldError,
  input,
  inputInvalid,
  label,
} from "../utils/ui";

const AMOUNT_PATTERN = /^\d+(\.\d{1,2})?$/;
const PARTIAL_AMOUNT_PATTERN = /^\d*(\.\d{0,2})?$/;

// A reusable form for creating or editing an application.
// `onSubmit` receives { title, category, description, amount }.
// `confirm` (optional) runs after validation, before submitting — return false to abort.
export function ApplicationForm({ initial, submitLabel, onSubmit, onCancel, confirm }) {
  const [title, setTitle] = useState(initial?.title ?? "");
  const [category, setCategory] = useState(initial?.category ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [amount, setAmount] = useState(initial?.amount ?? "");
  const [attachment, setAttachment] = useState(null);
  const [fieldErrors, setFieldErrors] = useState({});
  const [formError, setFormError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError(null);

    // Client-side validation mirrors the server's required fields.
    const errors = {};
    if (!title.trim()) errors.title = ["Title is required."];
    if (!category) errors.category = ["Category is required."];
    const cleanAmount = amount.toString().trim();
    if (cleanAmount && !AMOUNT_PATTERN.test(cleanAmount)) {
      errors.amount = ["Amount must be a valid number with up to 2 decimal places."];
    }
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) return;

    if (confirm) {
      const ok = await confirm();
      if (!ok) return;
    }

    setSubmitting(true);
    try {
      await onSubmit({
        title: title.trim(),
        category,
        description: description.trim(),
        amount: cleanAmount === "" ? null : cleanAmount,
        ...(attachment ? { attachment } : {}),
      });
    } catch (err) {
      if (err instanceof ApiError && err.details) {
        setFieldErrors(err.details);
      } else if (err instanceof ApiError) {
        setFormError(err.message);
      } else {
        setFormError("Something went wrong.");
      }
    } finally {
      setSubmitting(false);
    }
  };

  const errId = (name) => (fieldErrors[name] ? `${name}-error` : undefined);
  const fieldClass = (name) => `${input}${fieldErrors[name] ? ` ${inputInvalid}` : ""}`;
  const handleAmountChange = (e) => {
    const next = e.target.value.trim();
    if (next === "" || PARTIAL_AMOUNT_PATTERN.test(next)) {
      setAmount(next);
      setFieldErrors((current) => {
        if (!current.amount) return current;
        const { amount: _amount, ...rest } = current;
        return rest;
      });
      return;
    }

    setFieldErrors((current) => ({
      ...current,
      amount: ["Amount must be a valid number with up to 2 decimal places."],
    }));
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4" noValidate>
      {formError && (
        <div className={alertError} role="alert">
          {formError}
        </div>
      )}

      <div>
        <label htmlFor="title" className={label}>Title *</label>
        <input
          id="title"
          className={fieldClass("title")}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          aria-invalid={!!fieldErrors.title}
          aria-describedby={errId("title")}
        />
        {fieldErrors.title && (
          <p id="title-error" className={fieldError}>
            {fieldErrors.title[0]}
          </p>
        )}
      </div>

      <div>
        <label htmlFor="category" className={label}>Category *</label>
        <select
          id="category"
          className={fieldClass("category")}
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          aria-invalid={!!fieldErrors.category}
          aria-describedby={errId("category")}
        >
          <option value="">Select a category…</option>
          {CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {c.charAt(0) + c.slice(1).toLowerCase()}
            </option>
          ))}
        </select>
        {fieldErrors.category && (
          <p id="category-error" className={fieldError}>
            {fieldErrors.category[0]}
          </p>
        )}
      </div>

      <div>
        <label htmlFor="description" className={label}>Description</label>
        <textarea
          id="description"
          className={input}
          rows={3}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
      </div>

      <div>
        <label htmlFor="amount" className={label}>Amount (ZMW)</label>
        <input
          id="amount"
          type="text"
          inputMode="decimal"
          pattern="^\d+(\.\d{1,2})?$"
          className={fieldClass("amount")}
          value={amount ?? ""}
          onChange={handleAmountChange}
          placeholder="0.00"
          aria-invalid={!!fieldErrors.amount}
          aria-describedby={errId("amount")}
        />
        {fieldErrors.amount && (
          <p id="amount-error" className={fieldError}>
            {fieldErrors.amount[0]}
          </p>
        )}
      </div>

      <div>
        <label htmlFor="attachment" className={label}>Attachment</label>
        <input
          id="attachment"
          type="file"
          accept=".pdf,.jpg,.jpeg,.png,.webp,application/pdf,image/jpeg,image/png,image/webp"
          className={fieldClass("attachment")}
          onChange={(e) => setAttachment(e.target.files?.[0] ?? null)}
          aria-invalid={!!fieldErrors.attachment}
          aria-describedby={errId("attachment")}
        />
        <p className="mt-1 text-xs text-gray-500">Optional PDF, JPG, PNG, or WEBP. Max 5 MB.</p>
        {initial?.attachment_url && !attachment && (
          <p className="mt-1 text-sm text-gray-600">
            Current file:{" "}
            <a
              href={initial.attachment_url}
              target="_blank"
              rel="noreferrer"
              className="font-medium text-brand-700 hover:underline"
            >
              {initial.attachment_name ?? "View attachment"}
            </a>
          </p>
        )}
        {attachment && (
          <p className="mt-1 text-sm text-gray-600">Selected file: {attachment.name}</p>
        )}
        {fieldErrors.attachment && (
          <p id="attachment-error" className={fieldError}>
            {fieldErrors.attachment[0]}
          </p>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        <button type="submit" className={btnPrimary} disabled={submitting}>
          {submitting ? "Saving…" : submitLabel}
        </button>
        {onCancel && (
          <button type="button" className={btnSecondary} onClick={onCancel}>
            Cancel
          </button>
        )}
      </div>
    </form>
  );
}
