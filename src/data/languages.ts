import type { Language } from '@/types'

export const LANGUAGES: Language[] = [
  { code: 'en', label: 'English', native: 'English', flag: '🇬🇧', dir: 'ltr', enabled: true },
  { code: 'zh', label: 'Chinese', native: '中文', flag: '🇨🇳', dir: 'ltr', enabled: true },
  { code: 'hi', label: 'Hindi', native: 'हिन्दी', flag: '🇮🇳', dir: 'ltr', enabled: true },
  { code: 'es', label: 'Spanish', native: 'Español', flag: '🇪🇸', dir: 'ltr', enabled: true },
  { code: 'fr', label: 'French', native: 'Français', flag: '🇫🇷', dir: 'ltr', enabled: true },
  { code: 'ar', label: 'Arabic', native: 'العربية', flag: '🇸🇦', dir: 'rtl', enabled: true },
  { code: 'bn', label: 'Bengali', native: 'বাংলা', flag: '🇧🇩', dir: 'ltr', enabled: true },
  { code: 'pt', label: 'Portuguese', native: 'Português', flag: '🇵🇹', dir: 'ltr', enabled: true },
  { code: 'ru', label: 'Russian', native: 'Русский', flag: '🇷🇺', dir: 'ltr', enabled: true },
  { code: 'ur', label: 'Urdu', native: 'اردو', flag: '🇵🇰', dir: 'rtl', enabled: true },
  { code: 'id', label: 'Indonesian', native: 'Bahasa Indonesia', flag: '🇮🇩', dir: 'ltr', enabled: true },
  { code: 'de', label: 'German', native: 'Deutsch', flag: '🇩🇪', dir: 'ltr', enabled: true },
  { code: 'ja', label: 'Japanese', native: '日本語', flag: '🇯🇵', dir: 'ltr', enabled: true },
  { code: 'pa', label: 'Punjabi', native: 'ਪੰਜਾਬੀ', flag: '🇮🇳', dir: 'ltr', enabled: true },
  { code: 'tr', label: 'Turkish', native: 'Türkçe', flag: '🇹🇷', dir: 'ltr', enabled: true },
]

export const DEFAULT_LANGUAGE = 'es'

export function getLanguage(code: string): Language {
  return LANGUAGES.find((l) => l.code === code) ?? LANGUAGES[3]
}