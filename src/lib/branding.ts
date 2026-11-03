// Configuração central de marca (branding).
// Ajuste aqui ou pelas variáveis de ambiente VITE_BRAND_* para cada instalação/cliente.

const env = import.meta.env;

export const branding = {
  initials: (env.VITE_BRAND_INITIALS as string) || 'ALX',
  wordmark: (env.VITE_BRAND_WORDMARK as string) || 'ENTREGAS',
  fullName: (env.VITE_BRAND_NAME as string) || 'ALX Entregas',
  appName: (env.VITE_APP_NAME as string) || 'Agendamento de Escalas',
  tagline: (env.VITE_BRAND_TAGLINE as string) || 'Agendamento de Escalas',
  footerLabel: (env.VITE_BRAND_FOOTER as string) || 'ALX Entregas · Agendamento de Escalas',
  logoSrc: '/logo-alx.png',
  bannerSrc: '/agendamento-escalas.png',
} as const;

// Funcionalidades opcionais por instalação.
export const features = {
  // Habilita a integração Gmail/MAGALOG (edge functions gmail-*).
  gmail: (env.VITE_ENABLE_GMAIL as string) === 'true',
} as const;
