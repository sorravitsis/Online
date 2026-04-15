import Link from "next/link";
import { ClientErrorBoundary } from "@/components/client-error-boundary";
import { LoginForm } from "@/components/login-form";
import { ThemeToggle } from "@/components/theme-toggle";

export default function LoginPage() {
  return (
    <div className="min-h-screen flex flex-col bg-white dark:bg-[#080808]">
      {/* Nav */}
      <nav className="sticky top-0 z-50 bg-white/90 dark:bg-black/80 backdrop-blur-xl border-b border-red-100 dark:border-white/10 flex justify-between items-center px-8 md:px-12 py-5">
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

        {/* Light mode: subtle red tint corners */}
        <div
          aria-hidden
          className="absolute inset-0 pointer-events-none dark:hidden"
          style={{
            background: "radial-gradient(ellipse 60% 50% at 0% 0%, rgba(200,16,46,0.06) 0%, transparent 70%), radial-gradient(ellipse 50% 40% at 100% 100%, rgba(200,16,46,0.04) 0%, transparent 70%)",
          }}
        />

        {/* Dark mode: red glow orbs */}
        <div
          aria-hidden
          className="absolute inset-0 pointer-events-none hidden dark:block"
          style={{
            background: "radial-gradient(ellipse 60% 50% at 0% 0%, rgba(200,16,46,0.18) 0%, transparent 70%), radial-gradient(ellipse 50% 40% at 100% 100%, rgba(200,16,46,0.12) 0%, transparent 70%)",
          }}
        />

        {/* Hex grid */}
        <div
          aria-hidden
          className="absolute inset-0 pointer-events-none opacity-[0.04] dark:opacity-[0.07]"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M30 0l25.98 15v30L30 60 4.02 45V15z' fill-rule='evenodd' stroke='%23C8102E' fill='none' stroke-width='0.8'/%3E%3C/svg%3E")`,
            backgroundSize: "60px",
          }}
        />

        <div className="w-full max-w-6xl relative z-10">
          <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">

            {/* Left — Product Collage */}
            <div className="hidden lg:block relative" style={{ height: "520px" }}>

              {/* ASUS Notebook — large, anchored top-left, slight tilt */}
              <div className="absolute top-0 left-0 w-[68%] rounded-2xl overflow-hidden shadow-2xl border border-red-100 dark:border-white/10 group"
                style={{ transform: "rotate(-2deg)", zIndex: 10 }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img alt="ASUS Notebook" className="w-full h-52 object-cover object-center group-hover:scale-[1.04] transition-transform duration-500" src="/asus_notebook.png" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
                <div className="absolute bottom-3 left-4 flex items-center gap-2">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img alt="ASUS" className="h-4 w-auto object-contain invert" src="/logo_asus.png" />
                  <span className="text-white text-[10px] font-bold">Notebook</span>
                </div>
                <div className="absolute top-3 right-3 bg-red-600 text-white text-[8px] font-black uppercase tracking-widest px-2 py-1 rounded-md">Partner</div>
              </div>

              {/* Logitech Keyboard — mid-right, overlapping, counter-tilt */}
              <div className="absolute top-28 right-0 w-[52%] rounded-xl overflow-hidden shadow-xl border border-red-100 dark:border-white/10 group"
                style={{ transform: "rotate(2.5deg)", zIndex: 20 }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img alt="Logitech Keyboard" className="w-full h-36 object-cover group-hover:scale-[1.05] transition-transform duration-500" src="/logitech_keyboard.png" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent" />
                <div className="absolute bottom-2 left-3">
                  <span className="text-white text-[10px] font-bold">Keyboard</span>
                </div>
              </div>

              {/* Logitech Mouse — bottom-left, pops forward */}
              <div className="absolute bottom-12 left-4 w-[38%] rounded-xl overflow-hidden shadow-2xl border-2 border-red-500/30 dark:border-red-700/40 group"
                style={{ transform: "rotate(1.5deg)", zIndex: 30 }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img alt="Logitech Mouse" className="w-full h-36 object-cover group-hover:scale-[1.06] transition-transform duration-500" src="/logitech_mouse.png" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
                <div className="absolute bottom-2 left-3 flex items-center gap-1.5">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img alt="Logitech" className="h-3 w-auto object-contain invert" src="/logo_logitech.png" />
                  <span className="text-white text-[10px] font-bold">Mouse</span>
                </div>
              </div>

              {/* Logitech Headset — bottom-right, slightly raised */}
              <div className="absolute bottom-0 right-8 w-[42%] rounded-xl overflow-hidden shadow-xl border border-red-100 dark:border-white/10 group"
                style={{ transform: "rotate(-1.5deg)", zIndex: 25 }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img alt="Logitech Headset" className="w-full h-40 object-cover group-hover:scale-[1.05] transition-transform duration-500" src="/logitech_headset.png" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-transparent to-transparent" />
                <div className="absolute bottom-2 left-3">
                  <span className="text-white text-[10px] font-bold">Headset</span>
                </div>
              </div>

              {/* Logitech Webcam — mid-center, small accent card */}
              <div className="absolute top-[46%] left-[30%] w-[28%] rounded-xl overflow-hidden shadow-lg border border-red-200 dark:border-white/10 group"
                style={{ transform: "rotate(-3deg)", zIndex: 35 }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img alt="Logitech Webcam" className="w-full h-28 object-cover group-hover:scale-[1.07] transition-transform duration-500" src="/logitech_webcam.png" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent" />
                <div className="absolute bottom-2 left-3">
                  <span className="text-white text-[10px] font-bold">Webcam</span>
                </div>
              </div>

              {/* Floating brand badge */}
              <div className="absolute top-2 right-2 flex flex-col gap-1.5 z-40">
                <div className="bg-white/90 dark:bg-black/70 backdrop-blur-md border border-red-100 dark:border-white/10 rounded-xl px-3 py-2 flex items-center gap-2 shadow-md">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img alt="Logitech" className="h-4 w-auto dark:invert" src="/logo_logitech.png" />
                </div>
                <div className="bg-white/90 dark:bg-black/70 backdrop-blur-md border border-red-100 dark:border-white/10 rounded-xl px-3 py-2 flex items-center gap-2 shadow-md">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img alt="ASUS" className="h-4 w-auto dark:invert" src="/logo_asus.png" />
                </div>
              </div>

            </div>

            {/* Right — login form */}
            <div className="flex flex-col items-center lg:items-start">
              <div className="max-w-md w-full">

                {/* Heading */}
                <div className="mb-8 text-center lg:text-left">
                  <div className="inline-flex items-center gap-2 mb-5">
                    <div className="w-10 h-0.5 bg-red-600" />
                    <span className="text-[10px] font-black uppercase tracking-[0.3em] text-red-600 dark:text-red-500">
                      Secure Login
                    </span>
                  </div>
                  <h1 className="text-4xl lg:text-5xl font-black tracking-tighter text-brand-ink-900 dark:text-white leading-[1.05] uppercase">
                    เข้าสู่<br />
                    <span className="text-red-600">ระบบ</span>
                  </h1>
                </div>

                {/* Login card */}
                <div
                  className="bg-brand-ink-50 dark:bg-white/[0.04] border border-red-100 dark:border-white/10 px-8 pt-8 pb-10 rounded-2xl relative overflow-hidden group shadow-xl shadow-red-100/60 dark:shadow-none"
                  style={{ boxShadow: undefined }}
                >
                  {/* Animated top accent */}
                  <div className="absolute top-0 left-0 right-0 h-[3px] bg-red-100 dark:bg-white/5">
                    <div className="h-full bg-gradient-to-r from-red-500 to-red-700 w-1/3 group-focus-within:w-full transition-all duration-700" />
                  </div>
                  <ClientErrorBoundary
                    description="The login form hit an unexpected runtime issue."
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
                      className="text-xs font-bold text-brand-ink-600 dark:text-white/60 hover:text-red-600 transition-colors"
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
      <section className="w-full py-8 border-t border-red-100 dark:border-white/10 bg-brand-ink-50/60 dark:bg-black/40">
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
                className="h-24 w-auto object-contain opacity-30 grayscale dark:invert hover:opacity-70 hover:grayscale-0 dark:hover:invert-0 transition-all duration-300"
                src={src}
              />
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="w-full py-5 border-t border-red-100 dark:border-white/5 bg-white dark:bg-black">
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
