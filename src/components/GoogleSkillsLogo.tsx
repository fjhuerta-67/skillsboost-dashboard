import React from 'react';

interface GoogleSkillsLogoProps {
  showSubtitle?: boolean;
  compact?: boolean;
}

/**
 * Custom Google-inspired Educational Mark (Mortarboard + Open Book + Tassel Spark)
 * built with Google's 4-color geometric facet grammar (#4285F4, #EA4335, #FBBC04, #34A853),
 * paired with the official multicolor Google wordmark and "Skills for Organizations v1.0".
 */
export const GoogleEducationMark: React.FC<{ className?: string }> = ({
  className = 'w-10 h-10',
}) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 48 48"
    fill="none"
    className={className}
    aria-hidden="true"
  >
    {/* Left Mortarboard Wing (Google Blue) */}
    <path
      d="M23 5.2L5.8 14.1C4.1 15.0 4.1 17.0 5.8 17.9L23 26.8V5.2Z"
      fill="#4285F4"
    />
    {/* Right Mortarboard Wing (Google Red) */}
    <path
      d="M23 5.2L40.2 14.1C41.9 15.0 41.9 17.0 40.2 17.9L23 26.8V5.2Z"
      fill="#EA4335"
    />
    {/* Center Overlap Diamond Facet (Deep Google Blue) */}
    <path d="M23 11.4L28.6 16L23 20.6L17.4 16L23 11.4Z" fill="#1967D2" />
    <circle cx="23" cy="16" r="2" fill="#FFFFFF" />

    {/* Left Open Book Page (Google Green) */}
    <path
      d="M8.5 24.4C8.5 23.0 10.0 22.1 11.3 22.8L23 28.9V42.8L10.3 36.2C9.2 35.6 8.5 34.5 8.5 33.2V24.4Z"
      fill="#34A853"
    />
    {/* Right Open Book Page (Google Yellow) */}
    <path
      d="M37.5 24.4C37.5 23.0 36.0 22.1 34.7 22.8L23 28.9V42.8L35.7 36.2C36.8 35.6 37.5 34.5 37.5 33.2V24.4Z"
      fill="#FBBC04"
    />
    {/* Book Spine Overlap Fold */}
    <path d="M20.4 27.5L23 28.9V42.8L20.4 41.4V27.5Z" fill="#188038" />

    {/* Graduation Tassel Cord & Sparkle Bell */}
    <rect x="40.1" y="16.2" width="2.6" height="12.5" rx="1.3" fill="#4285F4" />
    <path
      d="M41.4 29.2L42.5 31.9L45.2 33.0L42.5 34.1L41.4 36.8L40.3 34.1L37.6 33.0L40.3 31.9L41.4 29.2Z"
      fill="#1A73E8"
    />
  </svg>
);

export const GoogleWordmark: React.FC<{ className?: string }> = ({
  className = 'h-[22px] w-auto',
}) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 74 24"
    className={className}
    role="img"
    aria-label="Google"
  >
    <path
      fill="#4285F4"
      d="M9.24 8.19v2.46h5.88c-.18 1.38-.64 2.39-1.34 3.1-.86.86-2.2 1.8-4.54 1.8-3.62 0-6.45-2.92-6.45-6.54s2.83-6.54 6.45-6.54c1.95 0 3.38.77 4.43 1.76L15.4 2.5C13.94 1.08 11.98 0 9.24 0 4.28 0 .11 4.04.11 9s4.17 9 9.13 9c2.68 0 4.7-.88 6.28-2.52 1.62-1.62 2.13-3.91 2.13-5.75 0-.57-.04-1.1-.13-1.54H9.24z"
    />
    <path
      fill="#EA4335"
      d="M25 6.19c-3.21 0-5.83 2.44-5.83 5.81 0 3.34 2.62 5.81 5.83 5.81s5.83-2.46 5.83-5.81c0-3.37-2.62-5.81-5.83-5.81zm0 9.33c-1.76 0-3.28-1.45-3.28-3.52 0-2.09 1.52-3.52 3.28-3.52s3.28 1.43 3.28 3.52c0 2.07-1.52 3.52-3.28 3.52z"
    />
    <path
      fill="#4285F4"
      d="M53.58 7.49h-.09c-.57-.68-1.67-1.3-3.06-1.3C47.53 6.19 45 8.72 45 12c0 3.26 2.53 5.81 5.43 5.81 1.39 0 2.49-.62 3.06-1.32h.09v.81c0 2.22-1.19 3.41-3.1 3.41-1.56 0-2.53-1.12-2.93-2.07l-2.22.92c.64 1.54 2.33 3.43 5.15 3.43 2.99 0 5.52-1.76 5.52-6.05V6.49h-2.42v1zm-2.93 8.03c-1.76 0-3.1-1.5-3.1-3.52 0-2.05 1.34-3.52 3.1-3.52 1.74 0 3.1 1.5 3.1 3.54.01 2.03-1.36 3.5-3.1 3.5z"
    />
    <path
      fill="#FBBC05"
      d="M38 6.19c-3.21 0-5.83 2.44-5.83 5.81 0 3.34 2.62 5.81 5.83 5.81s5.83-2.46 5.83-5.81c0-3.37-2.62-5.81-5.83-5.81zm0 9.33c-1.76 0-3.28-1.45-3.28-3.52 0-2.09 1.52-3.52 3.28-3.52s3.28 1.43 3.28 3.52c0 2.07-1.52 3.52-3.28 3.52z"
    />
    <path fill="#34A853" d="M58 .24h2.51v17.57H58z" />
    <path
      fill="#EA4335"
      d="M68.26 15.52c-1.3 0-2.22-.59-2.82-1.76l7.77-3.21-.26-.66c-.48-1.3-1.96-3.7-4.97-3.7-2.99 0-5.48 2.35-5.48 5.81 0 3.26 2.46 5.81 5.76 5.81 2.66 0 4.2-1.63 4.84-2.57l-1.98-1.32c-.66.96-1.56 1.6-2.86 1.6zm-.18-7.15c1.03 0 1.91.53 2.2 1.28l-5.25 2.17c0-2.44 1.73-3.45 3.05-3.45z"
    />
  </svg>
);

export const GoogleSkillsLogo: React.FC<GoogleSkillsLogoProps> = ({
  showSubtitle = true,
  compact = false,
}) => {
  return (
    <div className="flex items-center gap-3.5 select-none">
      {/* Custom 4-Color Google Education Emblem */}
      <div
        className={`${
          compact ? 'h-9 w-9 rounded-xl' : 'h-11 w-11 rounded-2xl'
        } bg-white border border-[#DADCE0] shadow-xs flex items-center justify-center shrink-0 relative overflow-hidden`}
      >
        <div className="absolute inset-x-0 top-0 h-0.5 google-rainbow-bar" />
        <GoogleEducationMark className={compact ? 'w-6 h-6' : 'w-8 h-8'} />
      </div>

      {/* Official Google Lockup + Skills for Organizations v1.0 */}
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <h1
            className={`${
              compact ? 'text-base' : 'text-lg sm:text-[21px]'
            } font-medium tracking-tight text-[#202124] flex items-center gap-1.5 leading-none`}
          >
            <GoogleWordmark
              className={
                compact
                  ? 'h-[17px] w-auto translate-y-[1px]'
                  : 'h-[21px] sm:h-[23px] w-auto translate-y-[1.5px]'
              }
            />
            <span className="font-semibold text-[#3C4043] tracking-[-0.01em]">
              Skills for Organizations
            </span>
          </h1>

          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold bg-[#E8F0FE] text-[#1967D2] border border-[#D2E3FC]">
            v1.1
          </span>
        </div>

        {showSubtitle && (
          <p className="text-xs text-[#5F6368] mt-0.5">
            Inteligencia de Capacitación, Analítica de Equipos y Desarrollo de Talento
          </p>
        )}
      </div>
    </div>
  );
};
