"use client";

import {
  useEffect,
  useMemo,
  useState,
} from 'react';

type PurchaseOrder = {
  id: number;
  poNumber: string;
  supplier: string;
  amount: number;
  currency: string;
  invoiceNumber: string;
  createdAt: string;
  invoiceLink: string;
  fileLink: string;
};

type Phase = "login" | "mfa" | "home";

export default function Home() {
  const apiBase = useMemo(() => {
    if (typeof window !== "undefined") {
      const runtimeApi = window.__RUNTIME_CONFIG__?.API_URL;
      if (runtimeApi) {
        return runtimeApi;
      }
    }
    return process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";
  }, []);
  const [phase, setPhase] = useState<Phase>("login");
  const [loading, setLoading] = useState(true);
  const [loginError, setLoginError] = useState("");
  const [mfaError, setMfaError] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [mfaToken, setMfaToken] = useState("");
  const [qrCode, setQrCode] = useState("");
  const [secret, setSecret] = useState("");
  const [refreshingMfa, setRefreshingMfa] = useState(false);
  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>([]);

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const res = await fetch(`${apiBase}/api/auth/status`, {
          credentials: "include"
        });
        const data = await res.json();
        if (data.authenticated && data.mfaVerified) {
          setPhase("home");
          await loadPurchaseOrders();
        } else if (data.authenticated) {
          setPhase("mfa");
          await loadMfaSetup();
        } else {
          setPhase("login");
        }
      } catch (error) {
        setPhase("login");
      } finally {
        setLoading(false);
      }
    };

    checkAuth();
  }, [apiBase]);

  const loadMfaSetup = async () => {
    const res = await fetch(`${apiBase}/api/mfa/setup`, {
      credentials: "include"
    });
    if (!res.ok) {
      return;
    }
    const data = await res.json();
    setQrCode(data.qrCodeDataUrl);
    setSecret(data.secret);
  };

  const refreshMfaSecret = async () => {
    setRefreshingMfa(true);
    setMfaError("");
    setMfaToken("");

    const res = await fetch(`${apiBase}/api/mfa/refresh`, {
      method: "POST",
      credentials: "include"
    });

    if (!res.ok) {
      setMfaError("Unable to refresh secret. Try again.");
      setRefreshingMfa(false);
      return;
    }

    const data = await res.json();
    setQrCode(data.qrCodeDataUrl);
    setSecret(data.secret);
    setRefreshingMfa(false);
  };

  const loadPurchaseOrders = async () => {
    const res = await fetch(`${apiBase}/api/purchase-orders`, {
      credentials: "include"
    });
    if (!res.ok) {
      return;
    }
    const data = await res.json();
    setPurchaseOrders(data.data || []);
  };

  const handleLogin = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoginError("");

    const res = await fetch(`${apiBase}/api/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ username, password })
    });

    if (!res.ok) {
      setLoginError("Invalid username or password.");
      return;
    }

    const data = await res.json();
    if (data.mfaRequired) {
      setPhase("mfa");
      await loadMfaSetup();
    } else {
      setPhase("home");
      await loadPurchaseOrders();
    }
  };

  const handleVerifyMfa = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setMfaError("");

    const res = await fetch(`${apiBase}/api/mfa/verify`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ token: mfaToken })
    });

    if (!res.ok) {
      setMfaError("Invalid code. Try again.");
      return;
    }

    setPhase("home");
    setMfaToken("");
    await loadPurchaseOrders();
  };

  const handleLogout = async () => {
    await fetch(`${apiBase}/api/logout`, {
      method: "POST",
      credentials: "include"
    });
    setPhase("login");
    setPurchaseOrders([]);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[radial-gradient(circle_at_top,_#fff8ea,_#f4f7ff_60%,_#fef2d4)] text-slate-900">
        <div className="mx-auto flex max-w-5xl flex-col items-center px-6 py-20">
          <div className="w-full rounded-3xl border border-white/60 bg-white/70 p-10 shadow-[0_20px_60px_-30px_rgba(16,24,40,0.4)]">
            <p className="text-lg font-semibold">Loading secure session...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_#fff8ea,_#f4f7ff_60%,_#fef2d4)] text-slate-900">
      <div className="mx-auto flex min-h-screen max-w-6xl flex-col gap-10 px-6 py-12">
        <header className="flex flex-wrap items-center justify-between gap-6">
          <div>
            <p className="text-sm uppercase tracking-[0.25em] text-slate-500">
              Secure Purchase Portal
            </p>
            <h1 className="mt-3 text-3xl font-semibold text-slate-900 md:text-4xl">
              MFA Login + Purchase Order Extraction
            </h1>
            <p className="mt-2 max-w-2xl text-base text-slate-600">
              Use this demo to automate login, validate TOTP, and capture invoice links
              for RPA testing.
            </p>
          </div>
          {phase === "home" ? (
            <button
              onClick={handleLogout}
              className="rounded-full border border-slate-300 bg-white px-6 py-2 text-sm font-semibold text-slate-700 shadow-sm transition hover:-translate-y-0.5 hover:border-slate-400"
            >
              Log out
            </button>
          ) : null}
        </header>

        <main className="grid gap-10 lg:grid-cols-[minmax(0,_1fr)_minmax(0,_380px)]">
          <section className="rounded-[32px] border border-white/70 bg-white/80 p-8 shadow-[0_18px_50px_-35px_rgba(15,23,42,0.35)]">
            {phase === "login" ? (
              <form className="space-y-6" onSubmit={handleLogin}>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.3em] text-amber-500">
                    Step 1
                  </p>
                  <h2 className="mt-2 text-2xl font-semibold">Login</h2>
                  <p className="mt-2 text-sm text-slate-600">
                    Demo user is ready. Use it to test automated login flows.
                  </p>
                </div>
                <div className="space-y-4">
                  <label className="block text-sm font-semibold text-slate-700">
                    Username
                    <input
                      className="mt-2 w-full rounded-2xl border border-slate-200 bg-white/80 px-4 py-3 text-sm text-slate-900 shadow-inner focus:border-amber-400 focus:outline-none"
                      value={username}
                      onChange={(event) => setUsername(event.target.value)}
                      placeholder="demo"
                    />
                  </label>
                  <label className="block text-sm font-semibold text-slate-700">
                    Password
                    <input
                      type="password"
                      className="mt-2 w-full rounded-2xl border border-slate-200 bg-white/80 px-4 py-3 text-sm text-slate-900 shadow-inner focus:border-amber-400 focus:outline-none"
                      value={password}
                      onChange={(event) => setPassword(event.target.value)}
                      placeholder="demo123"
                    />
                  </label>
                  {loginError ? (
                    <p className="text-sm font-semibold text-rose-500">{loginError}</p>
                  ) : null}
                </div>
                <button
                  type="submit"
                  className="w-full rounded-2xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-slate-900/20 transition hover:-translate-y-0.5"
                >
                  Sign in
                </button>
                <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-3 text-xs text-slate-600">
                  Demo credentials: <span className="font-semibold">demo</span> /
                  <span className="font-semibold">demo123</span>
                </div>
              </form>
            ) : null}

            {phase === "mfa" ? (
              <form className="space-y-6" onSubmit={handleVerifyMfa}>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.3em] text-sky-500">
                    Step 2
                  </p>
                  <h2 className="mt-2 text-2xl font-semibold">Verify MFA</h2>
                  <p className="mt-2 text-sm text-slate-600">
                    Scan the QR code in Google or Microsoft Authenticator, then enter
                    the 6-digit TOTP.
                  </p>
                </div>
                <div className="grid gap-6 md:grid-cols-[160px_1fr]">
                  <div className="flex items-center justify-center rounded-2xl border border-slate-200 bg-white p-4 shadow-inner">
                    {qrCode ? (
                      <img src={qrCode} alt="MFA QR Code" className="h-32 w-32" />
                    ) : (
                      <div className="h-32 w-32 animate-pulse rounded-2xl bg-slate-100" />
                    )}
                  </div>
                  <div className="space-y-3 text-sm text-slate-600">
                    <p className="font-semibold text-slate-700">Manual secret</p>
                    <p className="rounded-xl bg-slate-50 px-3 py-2 font-mono text-xs text-slate-700">
                      {secret || "Loading..."}
                    </p>
                    <button
                      type="button"
                      onClick={refreshMfaSecret}
                      disabled={refreshingMfa}
                      className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-600 transition hover:border-slate-400 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {refreshingMfa ? "Refreshing..." : "Refresh TOTP Secret"}
                    </button>
                    <p>
                      Issuer: <span className="font-semibold">RPA Demo</span>
                    </p>
                  </div>
                </div>
                <label className="block text-sm font-semibold text-slate-700">
                  6-digit code
                  <input
                    className="mt-2 w-full rounded-2xl border border-slate-200 bg-white/80 px-4 py-3 text-sm text-slate-900 shadow-inner focus:border-sky-400 focus:outline-none"
                    value={mfaToken}
                    onChange={(event) => setMfaToken(event.target.value)}
                    placeholder="123456"
                  />
                </label>
                {mfaError ? (
                  <p className="text-sm font-semibold text-rose-500">{mfaError}</p>
                ) : null}
                <button
                  type="submit"
                  className="w-full rounded-2xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-slate-900/20 transition hover:-translate-y-0.5"
                >
                  Verify MFA
                </button>
              </form>
            ) : null}

            {phase === "home" ? (
              <div className="space-y-6">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.3em] text-emerald-500">
                    Step 3
                  </p>
                  <h2 className="mt-2 text-2xl font-semibold">Purchase Orders</h2>
                  <p className="mt-2 text-sm text-slate-600">
                    Extract rows, open invoice links, and download files for RPA
                    automation samples.
                  </p>
                </div>
                <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white">
                  <div className="grid grid-cols-[1.1fr_1.2fr_0.8fr_0.9fr_0.8fr] gap-3 border-b border-slate-200 bg-slate-50 px-6 py-4 text-xs font-semibold uppercase tracking-wider text-slate-500">
                    <span>PO Number</span>
                    <span>Supplier</span>
                    <span>Amount</span>
                    <span>Invoice</span>
                    <span>File</span>
                  </div>
                  <div className="divide-y divide-slate-100">
                    {purchaseOrders.map((po) => (
                      <div
                        key={po.id}
                        className="grid grid-cols-[1.1fr_1.2fr_0.8fr_0.9fr_0.8fr] items-center gap-3 px-6 py-4 text-sm"
                      >
                        <div>
                          <p className="font-semibold text-slate-900">{po.poNumber}</p>
                          <p className="text-xs text-slate-500">
                            {new Date(po.createdAt).toLocaleDateString()}
                          </p>
                        </div>
                        <p className="text-slate-700">{po.supplier}</p>
                        <p className="font-semibold text-slate-900">
                          {po.currency} {po.amount.toFixed(2)}
                        </p>
                        <a
                          className="rounded-full border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-600 transition hover:border-slate-400"
                          href={`${apiBase}${po.invoiceLink}`}
                          target="_blank"
                          rel="noreferrer"
                        >
                          {po.invoiceNumber}
                        </a>
                        <a
                          className="rounded-full bg-slate-900 px-3 py-1 text-xs font-semibold text-white transition hover:bg-slate-700"
                          href={`${apiBase}${po.fileLink}`}
                          target="_blank"
                          rel="noreferrer"
                        >
                          Download
                        </a>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ) : null}
          </section>

          <aside className="flex flex-col gap-6">
            <div className="rounded-[28px] border border-white/70 bg-white/80 p-6 shadow-[0_18px_50px_-35px_rgba(15,23,42,0.35)]">
              <h3 className="text-lg font-semibold text-slate-900">Automation Checklist</h3>
              <ul className="mt-4 space-y-3 text-sm text-slate-600">
                <li>
                  <span className="font-semibold text-slate-800">1.</span> Enter credentials
                  and submit login form.
                </li>
                <li>
                  <span className="font-semibold text-slate-800">2.</span> Capture TOTP using
                  the shared secret.
                </li>
                <li>
                  <span className="font-semibold text-slate-800">3.</span> Verify MFA and
                  read table rows.
                </li>
                <li>
                  <span className="font-semibold text-slate-800">4.</span> Follow invoice
                  links and download files.
                </li>
              </ul>
            </div>
            <div className="rounded-[28px] border border-amber-200 bg-gradient-to-br from-amber-100 via-white to-amber-50 p-6 shadow-[0_18px_50px_-35px_rgba(15,23,42,0.35)]">
              <h3 className="text-lg font-semibold text-slate-900">Demo Notes</h3>
              <p className="mt-3 text-sm text-slate-600">
                MFA is pre-seeded for the demo user. If you need a new QR code,
                refresh the MFA step and rescan.
              </p>
              <div className="mt-4 rounded-2xl bg-white/80 px-4 py-3 text-xs text-slate-600">
                API Base: <span className="font-semibold">{apiBase}</span>
              </div>
            </div>
          </aside>
        </main>
      </div>
    </div>
  );
}
