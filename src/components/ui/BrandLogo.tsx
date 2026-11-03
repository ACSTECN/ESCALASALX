import { branding } from '@/lib/branding';

interface BrandLogoProps {
  compact?: boolean;
  light?: boolean;
  subtitle?: string;
  className?: string;
}

export function BrandLogo({
  compact = false,
  light = false,
  subtitle = branding.tagline,
  className = '',
}: BrandLogoProps) {
  if (compact) {
    return (
      <div className={`flex items-center ${className}`}>
        <img
          src={branding.logoSrc}
          alt={branding.fullName}
          className="h-12 w-auto object-contain sm:h-14"
        />
      </div>
    );
  }

  return (
    <div className={`flex flex-col items-start gap-3 ${className}`}>
      <img
        src={branding.bannerSrc}
        alt={branding.appName}
        className="h-auto w-full max-w-[680px] object-contain"
      />
      {subtitle ? (
        <span className={`text-sm font-semibold ${light ? 'text-slate-200' : 'text-slate-600'}`}>
          {subtitle}
        </span>
      ) : null}
    </div>
  );
}
