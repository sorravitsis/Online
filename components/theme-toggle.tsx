"use client";

import { useTheme } from "./theme-provider";

type Props = {
  className?: string;
};

export function ThemeToggle({ className = "" }: Props) {
  const { theme, toggle } = useTheme();

  return (
    <button
      aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
      className={`p-2 rounded-md transition-colors hover:bg-brand-ink-100 dark:hover:bg-white/10 text-brand-ink-500 dark:text-white/60 ${className}`}
      title={theme === "dark" ? "Light mode" : "Dark mode"}
      type="button"
      onClick={toggle}
    >
      {theme === "dark" ? (
        /* Sun icon */
        <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} viewBox="0 0 24 24">
          <path d="M12 3v2.25m6.364.386-1.591 1.591M21 12h-2.25m-.386 6.364-1.591-1.591M12 18.75V21m-4.773-4.227-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M15.75 12a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0Z" />
        </svg>
      ) : (
        /* Moon icon */
        <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} viewBox="0 0 24 24">
          <path d="M21.752 15.002A9.72 9.72 0 0 1 18 15.75c-5.385 0-9.75-4.365-9.75-9.75 0-1.33.266-2.597.748-3.752A9.753 9.753 0 0 0 3 11.25C3 16.635 7.365 21 12.75 21a9.753 9.753 0 0 0 9.002-5.998Z" />
        </svg>
      )}
    </button>
  );
}
