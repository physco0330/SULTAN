import type { Language } from '@/types'

export const LANGUAGES: Language[] = [
  { code: 'en', label: 'English', native: 'English', dir: 'ltr', enabled: true },
  { code: 'zh', label: 'Chinese', native: '中文', dir: 'ltr', enabled: true },
  { code: 'hi', label: 'Hindi', native: 'हिन्दी', dir: 'ltr', enabled: true },
  { code: 'es', label: 'Spanish', native: 'Español', dir: 'ltr', enabled: true },
  { code: 'fr', label: 'French', native: 'Français', dir: 'ltr', enabled: true },
  { code: 'ar', label: 'Arabic', native: 'العربية', dir: 'rtl', enabled: true },
  { code: 'bn', label: 'Bengali', native: 'বাংলা', dir: 'ltr', enabled: true },
  { code: 'pt', label: 'Portuguese', native: 'Português', dir: 'ltr', enabled: true },
  { code: 'ru', label: 'Russian', native: 'Русский', dir: 'ltr', enabled: true },
  { code: 'ur', label: 'Urdu', native: 'اردو', dir: 'rtl', enabled: true },
  { code: 'id', label: 'Indonesian', native: 'Bahasa Indonesia', dir: 'ltr', enabled: true },
  { code: 'de', label: 'German', native: 'Deutsch', dir: 'ltr', enabled: true },
  { code: 'ja', label: 'Japanese', native: '日本語', dir: 'ltr', enabled: true },
  { code: 'pa', label: 'Punjabi', native: 'ਪੰਜਾਬੀ', dir: 'ltr', enabled: true },
  { code: 'tr', label: 'Turkish', native: 'Türkçe', dir: 'ltr', enabled: true },
]

export const DEFAULT_LANGUAGE = 'es'

export function getLanguage(code: string): Language {
  return LANGUAGES.find((l) => l.code === code) ?? LANGUAGES[3]
}