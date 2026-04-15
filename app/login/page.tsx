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

            {/* Left — Product Showcase */}
            <div className="hidden lg:flex flex-col gap-6">

              {/* Label */}
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.4em] text-red-600 dark:text-red-500 mb-2">
                  ⬛ Premium Tech Products
                </p>
                <h2 className="text-3xl font-black leading-tight tracking-tighter text-brand-ink-900 dark:text-white">
                  สินค้า IT คุณภาพสูง<br />
                  <span className="text-red-600">Logitech · ASUS</span>
                </h2>
              </div>

              {/* Product grid */}
              <div className="grid grid-cols-2 gap-3">

                {/* ASUS Notebook — spans full width */}
                <div className="col-span-2 relative rounded-2xl overflow-hidden border border-red-100 dark:border-white/10 bg-brand-ink-50 dark:bg-white/[0.03] shadow-lg group">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    alt="ASUS Notebook"
                    className="w-full h-44 object-cover object-center group-hover:scale-[1.03] transition-transform duration-500"
                    src="/asus_notebook.png"
                  />
                  <div className="absolute bottom-0 left-0 right-0 px-4 py-3 bg-gradient-to-t from-black/70 to-transparent flex items-center gap-2">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img alt="ASUS" className="h-5 w-auto object-contain invert" src="/logo_asus.png" />
                    <span className="text-white text-xs font-bold">Notebook & Accessories</span>
                  </div>
                  <div className="absolute top-3 right-3 bg-red-600 text-white text-[9px] font-black uppercase tracking-widest px-2 py-1 rounded-md">
                    Partner
                  </div>
                </div>

                {/* Logitech Mouse */}
                <div className="relative rounded-xl overflow-hidden border border-red-100 dark:border-white/10 bg-brand-ink-50 dark:bg-white/[0.03] shadow group">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    alt="Logitech Mouse"
                    className="w-full h-32 object-cover object-center group-hover:scale-[1.05] transition-transform duration-500"
                    src="/logitech_mouse.png"
                  />
                  <div className="absolute bottom-0 left-0 right-0 px-3 py-2 bg-gradient-to-t from-black/60 to-transparent">
                    <span className="text-white text-[10px] font-bold">Mouse</span>
                  </div>
                </div>

                {/* Logitech Keyboard */}
                <div className="relative rounded-xl overflow-hidden border border-red-100 dark:border-white/10 bg-brand-ink-50 dark:bg-white/[0.03] shadow group">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    alt="Logitech Keyboard"
                    className="w-full h-32 object-cover object-center group-hover:scale-[1.05] transition-transform duration-500"
                    src="/logitech_keyboard.png"
                  />
                  <div className="absolute bottom-0 left-0 right-0 px-3 py-2 bg-gradient-to-t from-black/60 to-transparent">
                    <span className="text-white text-[10px] font-bold">Keyboard</span>
                  </div>
                </div>

                {/* Logitech Webcam */}
                <div className="relative rounded-xl overflow-hidden border border-red-100 dark:border-white/10 bg-brand-ink-50 dark:bg-white/[0.03] shadow group">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    alt="Logitech Webcam"
                    className="w-full h-28 object-cover object-center group-hover:scale-[1.05] transition-transform duration-500"
                    src="/logitech_webcam.png"
                  />
                  <div className="absolute bottom-0 left-0 right-0 px-3 py-2 bg-gradient-to-t from-black/60 to-transparent">
                    <span className="text-white text-[10px] font-bold">Webcam</span>
                  </div>
                </div>

                {/* Logitech Headset */}
                <div className="relative rounded-xl overflow-hidden border border-red-100 dark:border-white/10 bg-brand-ink-50 dark:bg-white/[0.03] shadow group">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    alt="Logitech Headset"
                    className="w-full h-28 object-cover object-center group-hover:scale-[1.05] transition-transform duration-500"
                    src="/logitech_headset.png"
                  />
                  <div className="absolute bottom-0 left-0 right-0 px-3 py-2 bg-gradient-to-t from-black/60 to-transparent">
                    <span className="text-white text-[10px] font-bold">Headset</span>
                  </div>
                </div>

              </div>

              {/* Brand logos row */}
              <div className="flex items-center gap-4 pt-1">
                <span className="text-[9px] uppercase tracking-widest font-bold text-brand-ink-400 dark:text-white/30">
                  Authorized Reseller
                </span>
                <div className="flex items-center gap-4">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img alt="Logitech" className="h-6 w-auto object-contain opacity-60 dark:opacity-40 dark:invert hover:opacity-100 transition-opacity" src="/logo_logitech.png" />
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img alt="ASUS" className="h-6 w-auto object-contain opacity-60 dark:opacity-40 dark:invert hover:opacity-100 transition-opacity" src="/logo_asus.png" />
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
