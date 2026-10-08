import { Link, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'

const SLUGS = ['privacidad', 'terminos', 'cookies', 'envios', 'devoluciones'] as const

type Slug = (typeof SLUGS)[number]

const NAV: { slug: Slug; key: string }[] = [
  { slug: 'privacidad', key: 'legal.privacidad' },
  { slug: 'terminos', key: 'legal.terminos' },
  { slug: 'cookies', key: 'legal.cookies' },
  { slug: 'envios', key: 'legal.envios' },
  { slug: 'devoluciones', key: 'legal.devoluciones' },
]

export default function Legal() {
  const { t } = useTranslation()
  const params = useParams()
  const slug: Slug = (params['*'] as Slug) ?? 'privacidad'
  const active = SLUGS.includes(slug) ? slug : 'privacidad'

  return (
    <div className="mx-auto max-w-[1100px] px-4 pb-24 lg:px-8">
      <header className="border-b border-gold/15 pb-8 pt-6 text-center">
        <h1 className="font-display text-3xl font-semibold tracking-wide text-ivory md:text-5xl">{t(`legal.${active}`)}</h1>
        <p className="mt-3 text-xs uppercase tracking-[0.3em] text-gold">{t('footer.policies')}</p>
      </header>

      <nav className="mt-8 flex flex-wrap justify-center gap-2">
        {NAV.map(({ slug: s, key }) => (
          <Link
            key={s}
            to={`/legal/${s}`}
            className={
              s === active
                ? 'border border-gold bg-gold px-5 py-2.5 text-xs font-semibold uppercase tracking-[0.2em] text-night'
                : 'border border-gold/40 px-5 py-2.5 text-xs font-semibold uppercase tracking-[0.2em] text-gold hover:bg-gold/10'
            }
          >
            {t(key)}
          </Link>
        ))}
      </nav>

      <div className="mt-10 border border-gold/15 bg-carbon/30 p-6 md:p-10">
        <section>
          <h2 className="font-display text-xl text-gold">{t(`legal.${active}IntroTitle`)}</h2>
          <p className="mt-3 text-sm font-light leading-relaxed text-bone">{t(`legal.${active}Intro`)}</p>
        </section>

        <div className="mt-8 grid gap-8 md:grid-cols-2">
          {[1, 2, 3, 4].map((n) => (
            <section key={n}>
              <h3 className="flex items-start gap-2 font-display text-base text-ivory">
                <span className="mt-1 block font-accent text-lg italic text-gold">{String(n).padStart(2, '0')}.</span>
                {t(`legal.${active}H${n}`)}
              </h3>
              <p className="mt-2 text-sm font-light leading-relaxed text-bone">{t(`legal.${active}P${n}`)}</p>
            </section>
          ))}
        </div>

        <section className="mt-8 border-t border-gold/15 pt-6">
          <h3 className="font-display text-base text-ivory">{t('contact.title')}</h3>
          <p className="mt-2 text-sm font-light leading-relaxed text-bone">{t('legal.contactNote')}</p>
        </section>
      </div>
    </div>
  )
}