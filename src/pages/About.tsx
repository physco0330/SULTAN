import { Link } from 'react-router-dom'
import { ArrowRight } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { editorialImage } from '@/utils/placeholder'
import { Reveal } from '@/components/Reveal'
import { SectionTitle } from '@/components/SectionTitle'

const STATS = [
  { key: 'years', value: '25+' },
  { key: 'atelier', value: '15K+' },
  { key: 'countries', value: '40+' },
  { key: 'handmade', value: '100%' },
]

export default function About() {
  const { t } = useTranslation()

  return (
    <>
      <section className="relative flex min-h-[60vh] items-end overflow-hidden">
        <div className="absolute inset-0">
          <img src={editorialImage('SULTAN BLACK ATELIER')} alt="" className="h-full w-full object-cover opacity-45" />
          <div className="absolute inset-0 bg-gradient-to-t from-night via-night/50 to-night/30" />
        </div>
        <div className="relative z-10 mx-auto w-full max-w-[1600px] px-4 pb-16 lg:px-8">
          <Reveal>
            <p className="text-[0.68rem] font-semibold uppercase tracking-[0.42em] text-gold">— {t('about.kicker')} —</p>
            <h1 className="font-display mt-3 max-w-3xl text-4xl font-semibold leading-tight text-ivory md:text-6xl">
              {t('about.title')}
            </h1>
          </Reveal>
        </div>
      </section>

      <section className="mx-auto max-w-[1600px] px-4 py-20 lg:px-8">
        <div className="mx-auto max-w-3xl text-center">
          <SectionTitle align="center" eyebrow={t('sections.philosophy.title')} title={t('about.mission')} />
        </div>
        <div className="mx-auto mt-8 grid max-w-2xl gap-8 text-center">
          {[t('about.para1'), t('about.para2'), t('about.para3')].map((p, i) => (
            <Reveal key={i} delay={i * 80}>
              <p className="font-accent text-xl italic leading-relaxed text-bone">{p}</p>
            </Reveal>
          ))}
        </div>
      </section>

      <section className="border-y border-gold/10 bg-carbon/40 py-16">
        <div className="mx-auto grid max-w-[1400px] grid-cols-2 gap-8 px-4 lg:grid-cols-4 lg:px-8">
          {STATS.map((s, i) => (
            <Reveal key={s.key} delay={i * 90} variant="fade-up">
              <div className="text-center">
                <p className="font-display text-4xl font-semibold text-gold md:text-5xl">{s.value}</p>
                <p className="mt-2 text-[0.64rem] font-semibold uppercase tracking-[0.28em] text-silver">{t(`about.${s.key}`)}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-[1600px] px-4 py-20 lg:px-8">
        <div className="grid items-center gap-10 lg:grid-cols-2">
          <Reveal variant="fade-in">
            <img src={editorialImage('HANDCRAFT HERITAGE')} alt="" className="aspect-[4/3] w-full border border-gold/15 object-cover" />
          </Reveal>
          <Reveal variant="fade-up">
            <SectionTitle align="left" eyebrow={`— ${t('about.voyageKicker')} —`} title={t('about.voyage')} subtitle={t('about.voyageBody')} />
            <div className="mt-8 grid gap-x-8 gap-y-6 sm:grid-cols-3">
              {['1699', '1960', '2025'].map((yr, i) => (
                <div key={yr} className="border-t border-gold/40 pt-4">
                  <p className="font-display text-2xl text-gold">{yr}</p>
                  <p className="mt-1 text-xs leading-relaxed text-bone">{t(`about.year${i + 1}`)}</p>
                </div>
              ))}
            </div>
            <Link to="/nueva-coleccion" className="group mt-10 inline-flex items-center gap-2 border-b border-gold/50 pb-1 text-xs font-semibold uppercase tracking-[0.26em] text-gold hover:text-gold-soft">
              {t('contact.send')} →<ArrowRight size={13} className="transition-transform group-hover:translate-x-1" />
            </Link>
          </Reveal>
        </div>
      </section>

      <section className="mx-auto max-w-[1600px] px-4 pb-20 lg:px-8">
        <div className="border border-gold/20 bg-[radial-gradient(100%_100%_at_50%_100%,rgba(201,162,39,0.1)_0%,rgba(13,13,13,0)_60%)] bg-carbon px-6 py-16 text-center md:py-20">
          <Reveal>
            <p className="font-display text-2xl font-semibold tracking-wide text-ivory md:text-4xl">{t('about.cta')}</p>
            <Link to="/catalogo" className="mt-8 inline-block border border-gold/50 px-10 py-4 text-xs font-bold uppercase tracking-[0.3em] text-gold transition-all hover:bg-gold hover:text-night">
              {t('hero.ctaDiscover')} →
            </Link>
          </Reveal>
        </div>
      </section>
    </>
  )
}