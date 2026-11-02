// Configuração central de marca (branding).
// Ajuste aqui ou pelas variáveis de ambiente VITE_BRAND_* para cada instalação/cliente.

const env = import.meta.env;

export const branding = {
  // Letras exibidas no logo (ex.: "ALX").
  initials: (env.VITE_BRAND_INITIALS as string) || 'ALX',
  // Palavra exibida junto às letras no logo (ex.: "LOGISTICS").
  wordmark: (env.VITE_BRAND_WORDMARK as string) || 'LOGISTICS',
  // Nome completo da marca (usado em cabeçalhos e chips).
  fullName: (env.VITE_BRAND_NAME as string) || 'ALX Logistics',
  // Nome do produto/aplicação (usado no título da página e rodapés).
  appName: (env.VITE_APP_NAME as string) || 'Escalas ALX',
  // Subtítulo padrão do logo.
  tagline: (env.VITE_BRAND_TAGLINE as string) || 'Sistema de Escalas',
  // Rótulo do rodapé das telas públicas.
  footerLabel: (env.VITE_BRAND_FOOTER as string) || 'Escalas ALX · Gestão de Coletas',
} as const;

// Funcionalidades opcionais por instalação.
export const features = {
  // Habilita a integração Gmail/MAGALOG (edge functions gmail-*).
  gmail: (env.VITE_ENABLE_GMAIL as string) === 'true',
} as const;
