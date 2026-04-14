import Link from "next/link";
import { ClientErrorBoundary } from "@/components/client-error-boundary";
import { LoginForm } from "@/components/login-form";

export default function LoginPage() {
  return (
    <div className="min-h-screen flex flex-col bg-[#F9F9FB]">
      {/* Nav */}
      <nav className="sticky top-0 z-50 bg-white/90 backdrop-blur-xl border-b border-brand-ink-100 flex justify-between items-center px-8 md:px-12 py-5">
        <div className="wordmark">
          <span className="wordmark-badge text-[18px]">SiS</span>
          <span className="wordmark-text">Warehouse</span>
        </div>
        <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-brand-ink-400">
          <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
          System Online
        </div>
      </nav>

      {/* Main */}
      <main className="flex-1 flex items-center justify-center relative overflow-hidden px-6 py-12 md:py-16">
        {/* Hex grid background */}
        <div
          aria-hidden
          className="absolute inset-0 opacity-[0.25] pointer-events-none"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M30 0l25.98 15v30L30 60 4.02 45V15z' fill-rule='evenodd' stroke='%23C8C6C7' fill='none' stroke-width='0.5'/%3E%3C/svg%3E")`,
            backgroundSize: "60px",
          }}
        />

        <div className="w-full max-w-6xl relative z-10">
          <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">

            {/* Left — hero image */}
            <div className="hidden lg:flex flex-col">
              <div className="relative group">
                <div className="absolute -inset-1 bg-gradient-to-r from-brand-red-600/20 to-transparent rounded-2xl blur opacity-25 group-hover:opacity-40 transition duration-1000" />
                <div className="relative bg-white border border-brand-ink-100 rounded-2xl overflow-hidden shadow-2xl">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    alt="Warehouse operations"
                    className="object-cover w-full aspect-[16/10]"
                    src="https://lh3.googleusercontent.com/aida-public/AB6AXuDIHouejoIYWqJJkSonoUrEkZNHUhuqEElxEnhvO3wwLzoUdGGH2oci7x7PtAbmMNIVgfJjuB2xupa5hV0qZzC6wfR62IW3fv_iHA3LRMgalDQYz2fRwuJwM_ouexk2DXVsbbpHnSBHfYkfOl2hqGrUKiJTKRnHAIB7E1T76GzrrNIX91wvsDtmVc29WfiCJI6xhMyAJPkwkp6QCSzx2iyIrBdeK5WfpChXYjNNpzpaRQp1qZH60w99ggSX70i8NArsw8iqtCHOu6I"
                  />

                  {/* Status badge */}
                  <div className="absolute top-4 right-4 flex items-center gap-2 px-3 py-1.5 bg-black/60 backdrop-blur-md rounded-full border border-white/10">
                    <span className="w-1.5 h-1.5 rounded-full bg-brand-red-500 animate-pulse" />
                    <span className="text-[9px] tracking-widest uppercase font-bold text-white">
                      Core System: Active
                    </span>
                  </div>

                  {/* Glass caption */}
                  <div className="absolute bottom-4 left-4 p-5 bg-white/85 backdrop-blur-md border border-brand-ink-100/50 rounded-xl max-w-[260px] shadow-lg">
                    <h3 className="font-bold text-xs leading-tight uppercase tracking-widest text-brand-ink-900 mb-1.5">
                      Smart Gear, Seamless Flow
                    </h3>
                    <p className="text-brand-ink-500 text-[11px] leading-relaxed">
                      อุปกรณ์ที่ใช่ เพื่อการทำงานที่ไหลลื่น — เน้นความเป็นมืออาชีพและการส่งของที่ไม่มีสะดุด
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Right — login */}
            <div className="flex flex-col items-center lg:items-start">
              <div className="max-w-md w-full">

                {/* Heading */}
                <div className="mb-10 text-center lg:text-left">
                  <div className="inline-flex items-center gap-2 mb-6">
                    <div className="w-10 h-1 bg-brand-red-600 rounded-full" />
                    <span className="text-[10px] font-black uppercase tracking-[0.3em] text-brand-ink-400">
                      Authorized Access Only
                    </span>
                  </div>
                  <h1 className="text-4xl lg:text-5xl font-bold tracking-tight text-brand-ink-900 leading-[1.1]">
                    พร้อมจัดการ<br />ออเดอร์แล้วหรือยัง?
                  </h1>
                </div>

                {/* Login card */}
                <div className="bg-white border border-brand-ink-100 px-8 pt-8 pb-10 rounded-2xl shadow-xl shadow-brand-ink-100/60 relative overflow-hidden group">
                  {/* Animated top accent */}
                  <div className="absolute top-0 left-0 right-0 h-1.5 bg-brand-ink-50">
                    <div className="h-full bg-gradient-to-r from-brand-red-500 to-brand-red-700 w-1/3 group-focus-within:w-full transition-all duration-700" />
                  </div>
                  <ClientErrorBoundary
                    description="The login form hit an unexpected runtime issue. Retry this screen before checking the password hash configuration."
                    homeHref="/login"
                    title="Login form needs recovery"
                  >
                    <LoginForm />
                  </ClientErrorBoundary>
                </div>

                {/* Secondary links */}
                <div className="mt-8 flex justify-between items-center px-1">
                  <div className="flex flex-col gap-0.5">
                    <span className="text-[9px] text-brand-ink-400 uppercase tracking-widest font-semibold">
                      Support
                    </span>
                    <Link
                      className="text-xs font-bold text-brand-ink-700 hover:text-brand-red-600 transition-colors"
                      href="https://line.me"
                      target="_blank"
                    >
                      @line pshha
                    </Link>
                  </div>
                  <div className="flex flex-col gap-0.5 items-end text-right">
                    <span className="text-[9px] text-brand-ink-400 uppercase tracking-widest font-semibold">
                      Infrastructure
                    </span>
                    <span className="text-xs font-bold text-brand-ink-700 flex items-center gap-1.5">
                      System Status
                      <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
                    </span>
                  </div>
                </div>

              </div>
            </div>

          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="w-full py-6 border-t border-brand-ink-100 bg-white">
        <div className="container mx-auto max-w-6xl px-8 md:px-12 flex flex-col md:flex-row justify-between items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="text-xs font-black tracking-tight text-brand-ink-300 uppercase">koko</span>
            <span className="text-[10px] text-brand-ink-300">v4.2.0</span>
          </div>
          <p className="text-[10px] tracking-widest uppercase text-brand-ink-300">
            © 2026 Sorravit Lamaijetra
          </p>
        </div>
      </footer>
    </div>
  );
}
