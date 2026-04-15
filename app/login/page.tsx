import Link from "next/link";
import { ClientErrorBoundary } from "@/components/client-error-boundary";
import { LoginForm } from "@/components/login-form";
import { ThemeToggle } from "@/components/theme-toggle";

export default function LoginPage() {
  return (
    <div className="dark min-h-screen flex flex-col bg-[#080808]">
      {/* Nav */}
      <nav className="sticky top-0 z-50 bg-white/80 dark:bg-black/80 backdrop-blur-xl border-b border-brand-ink-100 dark:border-white/10 flex justify-between items-center px-8 md:px-12 py-5">
        <div className="wordmark">
          <span className="wordmark-badge text-[18px]">SiS</span>
          <span className="wordmark-text">Warehouse</span>
        </div>
        <div className="flex items-center gap-3">
          <ThemeToggle />
          <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-brand-ink-400 dark:text-white/40">
            <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
            System Online
          </div>
        </div>
      </nav>

      {/* Main */}
      <main className="flex-1 flex items-center justify-center relative overflow-hidden px-6 py-12 md:py-16">

        {/* Diagonal red slash background */}
        <div
          aria-hidden
          className="absolute inset-0 pointer-events-none"
          style={{
            background: "linear-gradient(135deg, #C8102E18 0%, transparent 50%, #C8102E08 100%)",
          }}
        />

        {/* Hex grid — visible on dark */}
        <div
          aria-hidden
          className="absolute inset-0 opacity-[0.08] pointer-events-none"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M30 0l25.98 15v30L30 60 4.02 45V15z' fill-rule='evenodd' stroke='%23ffffff' fill='none' stroke-width='0.8'/%3E%3C/svg%3E")`,
            backgroundSize: "60px",
          }}
        />

        {/* Red glow orb top-left */}
        <div
          aria-hidden
          className="absolute -top-32 -left-32 w-[500px] h-[500px] rounded-full pointer-events-none"
          style={{ background: "radial-gradient(circle, #C8102E22 0%, transparent 70%)" }}
        />
        {/* Red glow orb bottom-right */}
        <div
          aria-hidden
          className="absolute -bottom-32 -right-32 w-[400px] h-[400px] rounded-full pointer-events-none"
          style={{ background: "radial-gradient(circle, #C8102E18 0%, transparent 70%)" }}
        />

        <div className="w-full max-w-6xl relative z-10">
          <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">

            {/* Left — hero */}
            <div className="hidden lg:flex flex-col gap-8">
              {/* Big bold statement */}
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.4em] text-red-500 mb-4">
                  ⬛ Authorized Personnel Only
                </p>
                <h2 className="text-6xl font-black leading-[0.95] tracking-tighter text-brand-ink-900 dark:text-white uppercase">
                  ระบบ<br />
                  <span className="text-red-600">จัดการ</span><br />
                  คลังสินค้า
                </h2>
                <p className="mt-6 text-sm text-brand-ink-500 dark:text-white/40 leading-relaxed max-w-xs">
                  เข้าถึงได้เฉพาะทีมงานที่ได้รับอนุญาตเท่านั้น — ระบบติดตาม log การเข้าใช้งานทุกครั้ง
                </p>
              </div>

              {/* Stats row */}
              <div className="flex gap-6">
                {[
                  { label: "Platforms", value: "2" },
                  { label: "Stores Active", value: "3" },
                  { label: "Uptime", value: "99.9%" },
                ].map(({ label, value }) => (
                  <div key={label} className="flex flex-col gap-1 border-l-2 border-red-700 pl-4">
                    <span className="text-2xl font-black text-brand-ink-900 dark:text-white">{value}</span>
                    <span className="text-[9px] uppercase tracking-widest text-brand-ink-400 dark:text-white/40 font-bold">{label}</span>
                  </div>
                ))}
              </div>

              {/* Divider */}
              <div className="w-full h-px bg-gradient-to-r from-red-700 via-red-900 to-transparent" />

              {/* Warning strip */}
              <div className="flex items-center gap-3 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/50 rounded-xl px-4 py-3">
                <span className="text-red-500 text-lg">⚠</span>
                <p className="text-[10px] uppercase tracking-widest font-bold text-red-400">
                  การเข้าถึงโดยไม่ได้รับอนุญาตมีโทษตามกฎหมาย
                </p>
              </div>
            </div>

            {/* Right — login form */}
            <div className="flex flex-col items-center lg:items-start">
              <div className="max-w-md w-full">

                {/* Heading */}
                <div className="mb-8 text-center lg:text-left">
                  <div className="inline-flex items-center gap-2 mb-5">
                    <div className="w-10 h-0.5 bg-red-600" />
                    <span className="text-[10px] font-black uppercase tracking-[0.3em] text-red-500">
                      Secure Login
                    </span>
                  </div>
                  <h1 className="text-4xl lg:text-5xl font-black tracking-tighter text-brand-ink-900 dark:text-white leading-[1.05] uppercase">
                    เข้าสู่<br />
                    <span className="text-red-600">ระบบ</span>
                  </h1>
                </div>

                {/* Login card */}
                <div className="bg-brand-ink-50 dark:bg-white/[0.04] border border-brand-ink-100 dark:border-white/10 px-8 pt-8 pb-10 rounded-2xl relative overflow-hidden group"
                  style={{ boxShadow: "0 0 40px #C8102E18, inset 0 0 0 1px rgba(255,255,255,0.06)" }}
                >
                  {/* Animated top accent */}
                  <div className="absolute top-0 left-0 right-0 h-[2px] bg-brand-ink-100 dark:bg-white/5">
                    <div className="h-full bg-gradient-to-r from-red-600 to-red-800 w-1/3 group-focus-within:w-full transition-all duration-700" />
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
                    <span className="text-[9px] text-brand-ink-400 dark:text-white/30 uppercase tracking-widest font-semibold">
                      Support
                    </span>
                    <Link
                      className="text-xs font-bold text-brand-ink-600 dark:text-white/60 hover:text-red-500 transition-colors"
                      href="https://line.me"
                      target="_blank"
                    >
                      @line pshha
                    </Link>
                  </div>
                  <div className="flex flex-col gap-0.5 items-end text-right">
                    <span className="text-[9px] text-brand-ink-400 dark:text-white/30 uppercase tracking-widest font-semibold">
                      Infrastructure
                    </span>
                    <span className="text-xs font-bold text-brand-ink-600 dark:text-white/60 flex items-center gap-1.5">
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

      {/* Sponsors */}
      <section className="w-full py-8 border-t border-brand-ink-100 dark:border-white/10 bg-brand-ink-50/60 dark:bg-black/40">
        <div className="container mx-auto max-w-6xl px-8 md:px-12">
          <p className="text-[9px] font-bold uppercase tracking-widest text-brand-ink-400 dark:text-white/20 mb-5 text-center">
            Our Technology Partners
          </p>
          <div className="flex items-center justify-center gap-10 flex-wrap">
            {[
              { src: "/logo_logitech.png", alt: "Logitech" },
              { src: "/logo_xiaomi.png",   alt: "Xiaomi" },
              { src: "/logo_asus.png",     alt: "ASUS" },
              { src: "/logo_brother.png",  alt: "Brother" },
            ].map(({ src, alt }) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                key={src}
                alt={alt}
                className="h-24 w-auto object-contain opacity-20 dark:grayscale dark:invert hover:opacity-60 dark:hover:grayscale-0 dark:hover:invert-0 transition-all duration-300"
                src={src}
              />
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="w-full py-5 border-t border-brand-ink-100 dark:border-white/5 bg-brand-ink-50 dark:bg-black">
        <div className="container mx-auto max-w-6xl px-8 md:px-12 flex flex-col md:flex-row justify-between items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="text-xs font-black tracking-tight text-brand-ink-300 dark:text-white/20 uppercase">koko</span>
            <span className="text-[10px] text-brand-ink-300 dark:text-white/20">v4.2.0</span>
          </div>
          <p className="text-[10px] tracking-widest uppercase text-brand-ink-300 dark:text-white/20">
            © 2026 Sorravit Lamaijetra
          </p>
        </div>
      </footer>
    </div>
  );
}
