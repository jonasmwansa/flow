import Swal from "sweetalert2";
import "sweetalert2/dist/sweetalert2.min.css";

// Themed wrappers around SweetAlert2 so every action gets consistent feedback:
// a confirmation before, a toast after, and a clear error on failure.

const BRAND = "#2563eb";
const DANGER = "#dc2626";
const GRAY = "#6b7280";

/** Ask the user to confirm an action. Resolves to true if they proceed. */
export function confirmAction({ title, text, confirmText = "Confirm", danger = false }) {
  return Swal.fire({
    title,
    text,
    icon: danger ? "warning" : "question",
    showCancelButton: true,
    confirmButtonText: confirmText,
    cancelButtonText: "Cancel",
    confirmButtonColor: danger ? DANGER : BRAND,
    cancelButtonColor: GRAY,
    reverseButtons: true,
  }).then((result) => result.isConfirmed);
}

const toast = Swal.mixin({
  toast: true,
  position: "top-end",
  showConfirmButton: false,
  timer: 2500,
  timerProgressBar: true,
});

export function toastSuccess(title) {
  return toast.fire({ icon: "success", title });
}

export function showError(title, text) {
  return Swal.fire({ icon: "error", title, text, confirmButtonColor: BRAND });
}

export function showWarning(title, text) {
  return Swal.fire({ icon: "warning", title, text, confirmButtonColor: BRAND });
}
