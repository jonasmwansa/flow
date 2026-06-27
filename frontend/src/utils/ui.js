// A small set of shared Tailwind class strings. Keeping the repeated
// button/input/alert styles in one place keeps the components readable and the
// look consistent. Layout utilities (flex, spacing) stay inline in each file.

export const card = "rounded-xl border border-gray-200 bg-white p-5 shadow-sm";

export const link = "font-medium text-brand-700 hover:underline";

const btnBase =
  "inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold shadow-sm transition hover:-translate-y-0.5 hover:shadow-md active:translate-y-0 disabled:cursor-not-allowed disabled:opacity-50 disabled:shadow-none disabled:hover:translate-y-0";
export const btnPrimary = `${btnBase} bg-brand-600 text-white hover:bg-brand-700`;
export const btnSecondary = `${btnBase} border border-gray-300 bg-gray-100 text-gray-800 hover:bg-gray-200`;
export const btnDanger = `${btnBase} bg-red-600 text-white hover:bg-red-700`;
export const btnOutline = `${btnBase} border border-gray-300 bg-white text-gray-700 hover:bg-gray-50`;

const btnSmBase =
  "inline-flex items-center justify-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold shadow-sm transition hover:-translate-y-0.5 hover:shadow-md active:translate-y-0 disabled:cursor-not-allowed disabled:opacity-50 disabled:shadow-none disabled:hover:translate-y-0";
export const btnSmPrimary = `${btnSmBase} bg-brand-600 text-white hover:bg-brand-700`;
export const btnSmOutline = `${btnSmBase} border border-gray-300 bg-white text-gray-700 hover:bg-gray-50`;

export const label = "mb-1 block text-sm font-medium text-gray-700";
export const input =
  "w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500";
export const inputInvalid = "border-red-500 focus:border-red-500 focus:ring-red-500";
export const fieldError = "mt-1 text-sm text-red-600";

export const alertError =
  "rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800";
export const alertSuccess =
  "rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800";

export const th =
  "border-b border-gray-200 px-2 py-2 text-left text-xs font-semibold uppercase tracking-wide text-gray-500";
export const td = "border-b border-gray-100 px-2 py-2 align-top";

// Per-item accent colours, used for the sidebar icon tiles and KPI stat cards.
// Full class strings (not interpolated) so Tailwind keeps them at build time.
export const ACCENTS = {
  blue: { tile: "bg-blue-50 text-blue-600", bar: "border-l-blue-500" },
  green: { tile: "bg-green-50 text-green-600", bar: "border-l-green-500" },
  amber: { tile: "bg-amber-50 text-amber-600", bar: "border-l-amber-500" },
  violet: { tile: "bg-violet-50 text-violet-600", bar: "border-l-violet-500" },
  red: { tile: "bg-red-50 text-red-600", bar: "border-l-red-500" },
  slate: { tile: "bg-slate-100 text-slate-600", bar: "border-l-slate-400" },
};
