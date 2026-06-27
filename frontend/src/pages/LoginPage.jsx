import { useState } from "react";
import { useNavigate } from "react-router-dom";

import { ApiError } from "../lib/api";
import { useAuth } from "../context/auth";
import { Icon } from "../components/icons";

const DEMO_ACCOUNTS = [
  { label: "Applicant", email: "applicant@example.com", icon: "user" },
  { label: "Reviewer", email: "reviewer@example.com", icon: "users" },
];

export function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const user = await login(email, password);
      navigate(user.role === "REVIEWER" ? "/reviewer" : "/applicant", { replace: true });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Login failed. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const fillDemo = (demoEmail) => {
    setEmail(demoEmail);
    setPassword("password123");
  };

  return (
    <div className="relative min-h-screen overflow-hidden bg-sky-100 text-gray-950">
      <div className="absolute inset-0 bg-[linear-gradient(180deg,#8ed1ef_0%,#cceffc_45%,#f8fbff_100%)]" />
      <div
        className="absolute inset-x-[-15%] bottom-[-16rem] h-[32rem] opacity-95"
        style={{
          backgroundImage:
            "radial-gradient(ellipse at 12% 42%, rgba(255,255,255,0.96) 0 22%, transparent 45%), radial-gradient(ellipse at 38% 28%, rgba(255,255,255,0.9) 0 18%, transparent 43%), radial-gradient(ellipse at 64% 36%, rgba(255,255,255,0.96) 0 24%, transparent 48%), radial-gradient(ellipse at 88% 46%, rgba(255,255,255,0.9) 0 20%, transparent 44%)",
        }}
        aria-hidden="true"
      />
      <div
        className="absolute left-1/2 top-[43%] h-[28rem] w-[72rem] -translate-x-1/2 rounded-[50%] border border-white/50"
        aria-hidden="true"
      />
      <div
        className="absolute left-1/2 top-[49%] h-[24rem] w-[58rem] -translate-x-1/2 rounded-[50%] border border-white/35"
        aria-hidden="true"
      />

      <div className="absolute left-5 top-5 z-10 flex items-center gap-2 sm:left-8 sm:top-7">
        <div className="grid h-9 w-9 place-items-center rounded-lg bg-gray-950 text-white shadow-lg">
          <Icon name="grid" className="h-4 w-4" />
        </div>
        <span className="text-base font-bold tracking-tight text-gray-950">Flow</span>
      </div>

      <main className="relative z-10 flex min-h-screen items-center justify-center px-4 py-20">
        <section className="w-full max-w-[380px] rounded-2xl border border-white/70 bg-white/70 p-6 shadow-[0_24px_70px_rgba(37,99,235,0.24)] backdrop-blur-2xl sm:p-8">
          <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl border border-white/80 bg-white/85 text-gray-900 shadow-[0_12px_30px_rgba(15,23,42,0.16)]">
            <Icon name="login" className="h-6 w-6" />
          </div>

          <div className="mt-5 text-center">
            <h1 className="text-2xl font-bold tracking-tight">Sign in with email</h1>
            <p className="mt-2 text-sm leading-6 text-gray-600">
              Review submissions, track decisions, and keep the approval flow moving.
            </p>
          </div>

          {error && (
            <div
              className="mt-5 rounded-xl border border-red-200 bg-red-50/90 px-4 py-3 text-sm text-red-800"
              role="alert"
            >
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="mt-6 space-y-3" noValidate>
            <div className="relative">
              <label htmlFor="email" className="sr-only">
                Email
              </label>
              <Icon
                name="mail"
                className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500"
              />
              <input
                id="email"
                type="email"
                className="h-11 w-full rounded-xl border border-white/70 bg-slate-100/85 pl-10 pr-3 text-sm text-gray-900 outline-none transition placeholder:text-gray-500 focus:border-brand-400 focus:bg-white focus:ring-2 focus:ring-brand-200"
                autoComplete="username"
                placeholder="Email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>

            <div className="relative">
              <label htmlFor="password" className="sr-only">
                Password
              </label>
              <Icon
                name="lock"
                className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500"
              />
              <input
                id="password"
                type={showPassword ? "text" : "password"}
                className="h-11 w-full rounded-xl border border-white/70 bg-slate-100/85 pl-10 pr-11 text-sm text-gray-900 outline-none transition placeholder:text-gray-500 focus:border-brand-400 focus:bg-white focus:ring-2 focus:ring-brand-200"
                autoComplete="current-password"
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
              <button
                type="button"
                className="absolute right-2 top-1/2 grid h-8 w-8 -translate-y-1/2 place-items-center rounded-lg text-gray-500 transition hover:bg-white/80 hover:text-gray-800"
                onClick={() => setShowPassword((visible) => !visible)}
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                <Icon name={showPassword ? "eye-off" : "eye"} className="h-4 w-4" />
              </button>
            </div>

            <div className="flex items-center justify-between text-xs text-gray-600">
              <span>Demo password</span>
              <code className="rounded-md bg-white/70 px-2 py-1 font-semibold text-gray-800">
                password123
              </code>
            </div>

            <button
              type="submit"
              className="mt-2 h-11 w-full rounded-xl border border-gray-950 bg-[linear-gradient(180deg,#30313a_0%,#12131a_100%)] text-sm font-semibold text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.18),0_12px_24px_rgba(15,23,42,0.22)] transition hover:-translate-y-0.5 hover:shadow-[inset_0_1px_0_rgba(255,255,255,0.18),0_16px_28px_rgba(15,23,42,0.26)] disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-y-0"
              disabled={submitting}
            >
              {submitting ? "Signing in..." : "Get Started"}
            </button>
          </form>

          <div className="my-5 flex items-center gap-3">
            <span className="h-px flex-1 bg-gradient-to-r from-transparent via-gray-300 to-gray-300" />
            <span className="text-xs text-gray-500">Try a demo account</span>
            <span className="h-px flex-1 bg-gradient-to-l from-transparent via-gray-300 to-gray-300" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            {DEMO_ACCOUNTS.map((account) => (
              <button
                key={account.email}
                type="button"
                className="flex h-12 items-center justify-center gap-2 rounded-xl border border-white/75 bg-white/70 text-sm font-semibold text-gray-800 shadow-sm transition hover:-translate-y-0.5 hover:bg-white hover:shadow-md"
                onClick={() => fillDemo(account.email)}
              >
                <Icon name={account.icon} className="h-4 w-4 text-brand-600" />
                {account.label}
              </button>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}
