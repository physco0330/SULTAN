import { Link } from 'react-router-dom'
import { Instagram, Mail, Send } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Logo } from '@/components/Logo'
import { config, brandConfig } from '@/config/brand'
import { NewsletterForm } from '@/components/NewsletterForm'

function Column({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h4 className="mb-4 text-[0.66rem] font-semibold uppercase tracking-[0.32em] text-gold">{title}</h4>
      <ul className="space-y-2.5">{children}</ul>
    </div>
  )
}

const shopLinks = [
  { to: '/hombre', key: 'nav.men' },
  { to: '/mujer', key: 'nav.women' },
  { to: '/nueva-coleccion', key: 'nav.newCollection' },
  { to: '/ofertas', key: 'nav.offers' },
]

const helpLinks = [
  { to: '/contacto', key: 'footer.contactTitle' },
  { to: '/faq', key: 'faq.title' },
  { to: '/legal/envios', key: 'footer.envios' },
  { to: '/legal/devoluciones', key: 'footer.devoluciones' },
]

const legalLinks = [
  { to: '/legal/privacidad', key: 'footer.privacidad' },
  { to: '/legal/terminos', key: 'footer.terminos' },
  { to: '/legal/cookies', key: 'footer.cookies' },
]

export function Footer() {
  const { t } = useTranslation()
  const year = new Date().getFullYear()

  return (
    <footer className="border-t border-gold/20 bg-night">
      <div className="mx-auto max-w-[1600px] px-4 py-14 lg:px-8">
        <div className="grid gap-10 md:grid-cols-2 lg:grid-cols-6">
          <div className="lg:col-span-2">
            <Logo />
            <p className="mt-5 max-w-xs text-sm font-light leading-relaxed text-bone">{t('footer.tagline')}</p>
            <div className="mt-6 flex items-center gap-2">
              {config.WHATSAPP_NUMBER && (
                <Link
                  to={`https://wa.me/${config.WHATSAPP_NUMBER}`}
                  target="_blank"
                  rel="noreferrer"
                  aria-label="WhatsApp"
                  className="flex h-10 w-10 items-center justify-center border border-gold/30 text-silver transition-colors hover:border-gold hover:text-gold"
                >
                  <Send size={15} />
                </Link>
              )}
              {config.INSTAGRAM_URL && (
                <Link
                  to={config.INSTAGRAM_URL}
                  target="_blank"
                  rel="noreferrer"
                  aria-label="Instagram"
                  className="flex h-10 w-10 items-center justify-center border border-gold/30 text-silver transition-colors hover:border-gold hover:text-gold"
                >
                  <Instagram size={15} />
                </Link>
              )}
              {config.EMAIL && (
                <Link
                  to={`mailto:${config.EMAIL}`}
                  aria-label={t('footer.contactTitle')}
                  className="flex h-10 w-10 items-center justify-center border border-gold/30 text-silver transition-colors hover:border-gold hover:text-gold"
                >
                  <Mail size={15} />
                </Link>
              )}
            </div>
          </div>

          <Column title={t('footer.shop')}>
            {shopLinks.map((l) => (
              <li key={l.to}>
                <Link to={l.to} className="text-sm text-silver transition-colors hover:text-gold">
                  {t(l.key)}
                </Link>
              </li>
            ))}
          </Column>

          <Column title={t('footer.help')}>
            {helpLinks.map((l) => (
              <li key={l.to}>
                <Link to={l.to} className="text-sm text-silver transition-colors hover:text-gold">
                  {t(l.key)}
                </Link>
              </li>
            ))}
          </Column>

          <Column title={t('footer.legal')}>
            {legalLinks.map((l) => (
              <li key={l.to}>
                <Link to={l.to} className="text-sm text-silver transition-colors hover:text-gold">
                  {t(l.key)}
                </Link>
              </li>
            ))}
            <li>
              <Link to="/admin" className="text-sm text-bone transition-colors hover:text-gold">
                Admin
              </Link>
            </li>
          </Column>

          <div className="lg:col-span-2">
            <h4 className="mb-4 font-display text-sm uppercase tracking-[0.24em] text-gold">
              {t('footer.newsletterTitle')}
            </h4>
            <p className="mb-4 text-sm font-light text-bone">{t('sections.newsletter.subtitle')}</p>
            <NewsletterForm />
            <p className="mt-3 text-[0.62rem] text-bone">{t('sections.newsletter.privacy')}</p>
          </div>
        </div>

        <div className="mt-12 flex flex-col items-center justify-between gap-3 border-t border-gold/10 pt-6 text-[0.68rem] uppercase tracking-[0.24em] text-bone md:flex-row">
          <p>
            © {year} {brandConfig.name}. {t('footer.rights')}
          </p>
          <p>{t('footer.madeIn')} — {brandConfig.address}</p>
        </div>
      </div>
    </footer>
  )
}