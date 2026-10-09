import type { Language } from '@/types'

export const LANGUAGES: Language[] = [
  { code: 'en', label: 'English', native: 'English', flag: 'GB', dir: 'ltr', enabled: true },
  { code: 'zh', label: 'Chinese', native: '中文', flag: 'CN', dir: 'ltr', enabled: true },
  { code: 'hi', label: 'Hindi', native: 'हिन्दी', flag: 'IN', dir: 'ltr', enabled: true },
  { code: 'es', label: 'Spanish', native: 'Español', flag: 'ES', dir: 'ltr', enabled: true },
  { code: 'fr', label: 'French', native: 'Français', flag: 'FR', dir: 'ltr', enabled: true },
  { code: 'ar', label: 'Arabic', native: 'العربية', flag: 'SA', dir: 'rtl', enabled: true },
  { code: 'bn', label: 'Bengali', native: 'বাংলা', flag: 'BD', dir: 'ltr', enabled: true },
  { code: 'pt', label: 'Portuguese', native: 'Português', flag: 'PT', dir: 'ltr', enabled: true },
  { code: 'ru', label: 'Russian', native: 'Русский', flag: 'RU', dir: 'ltr', enabled: true },
  { code: 'ur', label: 'Urdu', native: 'اردو', flag: 'PK', dir: 'rtl', enabled: true },
  { code: 'id', label: 'Indonesian', native: 'Bahasa Indonesia', flag: 'ID', dir: 'ltr', enabled: true },
  { code: 'de', label: 'German', native: 'Deutsch', flag: 'DE', dir: 'ltr', enabled: true },
  { code: 'ja', label: 'Japanese', native: '日本語', flag: 'JP', dir: 'ltr', enabled: true },
  { code: 'pa', label: 'Punjabi', native: 'ਪੰਜਾਬੀ', flag: 'IN', dir: 'ltr', enabled: true },
  { code: 'tr', label: 'Turkish', native: 'Türkçe', flag: 'TR', dir: 'ltr', enabled: true },
]

export const DEFAULT_LANGUAGE = 'es'

export function getLanguage(code: string): Language {
  return LANGUAGES.find((l) => l.code === code) ?? LANGUAGES[3]
}
