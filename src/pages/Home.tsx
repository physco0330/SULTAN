import { Link } from 'react-router-dom'
import { ArrowRight, ArrowUpRight, MapPin } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { heroImage, categoryImage, editorialImage } from '@/utils/placeholder'
import { PRODUCTS } from '@/data/products'
import { Reveal } from '@/components/Reveal'
import { SectionTitle } from '@/components/SectionTitle'
import { ProductGrid } from '@/components/ProductGrid'
import { NewsletterForm } from '@/components/NewsletterForm'

function Hero() {
  const { t } = useTranslation()
  return (
    <section className="relative flex min-h-[92vh] items-center justify-center overflow-hidden">
      <div className="absolute inset-0">
        <img
          src={heroImage()}
          alt=""
          className="h-full w-full object-cover opacity-50 animate-slow-zoom"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-night/70 via-night/20 to-night" />
        <div className="absolute inset-0 bg-radial-fade" />
      </div>

      <div className="relative z-10 mx-auto -mt-10 max-w-4xl px-6 pb-20 text-center">
        <Reveal variant="fade-up">
          <p className="mb-5 flex items-center justify-center gap-2 text-[0.66rem] font-semibold uppercase tracking-[0.5em] text-silver">
            <MapPin size={12} aria-hidden="true" /> {t('hero.location')}
          </p>
        </Reveal>
        <Reveal variant="fade-up" delay={120}>
          <h1 className="font-display text-5xl font-semibold text-gold-gradient md:text-7xl lg:text-8xl">
            {t('hero.brand')}
          </h1>
        </Reveal>
        <Reveal variant="fade-up" delay={240}>
          <p className="font-accent mt-4 text-2xl italic tracking-wide text-ivory md:text-4xl">
            {t('hero.title')}
          </p>
        </Reveal>
        <Reveal variant="fade-up" delay={340}>
          <p className="mx-auto mt-6 max-w-xl text-sm font-light leading-relaxed text-silver md:text-base">
            {t('hero.subtitle')}
          </p>
        </Reveal>
        <Reveal variant="fade-up" delay={460}>
          <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
            <a
              href="#categories"
              className="group relative w-full overflow-hidden bg-gold px-10 py-4 text-xs font-bold uppercase tracking-[0.28em] text-night transition-all hover:bg-gold-soft sm:w-auto"
            >
              {t('hero.ctaDiscover')} <ArrowRight size={14} className="ml-1 inline transition-transform group-hover:translate-x-1" />
            </a>
            <Link
              to="/catalogo"
              className="group relative w-full overflow-hidden border border-gold/60 px-10 py-4 text-xs font-semibold uppercase tracking-[0.28em] text-gold transition-all hover:bg-gold hover:text-night sm:w-auto"
            >
              {t('hero.ctaBuy')}
            </Link>
          </div>
        </Reveal>
      </div>

      <div className="absolute bottom-8 left-1/2 z-10 -translate-x-1/2">
        <div className="flex h-10 w-6 justify-center rounded-full border border-gold/40 pt-2">
          <span className="h-2 w-1 animate-bounce rounded-full bg-gold" />
        </div>
      </div>
    </section>
  )
}

const CATEGORY_CARDS = [
  { to: '/hombre', titleKey: 'nav.men', label: 'Men', image: categoryImage('SULTAN MEN') },
  { to: '/mujer', titleKey: 'nav.women', label: 'Women', image: categoryImage('SULTAN WOMEN') },
  { to: '/nueva-coleccion', titleKey: 'nav.newCollection', label: 'New Collection', image: categoryImage('NEW COLLECTION') },
  { to: '/catalogo?collection=limited', titleKey: 'badges.limited', label: 'Premium Edition', image: categoryImage('PREMIUM EDITION') },
]

function Categories() {
  const { t } = useTranslation()
  return (
    <section id="categories" className="mx-auto max-w-[1600px] px-4 py-20 md:py-28 lg:px-8">
      <SectionTitle eyebrow={t('hero.title')} title={t('sections.categories.title')} subtitle={t('sections.categories.subtitle')} />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 md:gap-5">
        {CATEGORY_CARDS.map((c, i) => (
          <Reveal key={c.label} delay={i * 100}>
            <Link
              to={c.to}
              className="group relative block aspect-[3/4] overflow-hidden bg-ash md:aspect-[3/4.4]"
            >
              <img
                src={c.image}
                alt={c.label}
                loading="lazy"
                className="h-full w-full object-cover transition-transform duration-700 ease-out group-hover:scale-110"
              />
              <span className="absolute inset-0 bg-gradient-to-t from-night via-night/30 to-transparent transition-opacity duration-500 group-hover:opacity-90" />
              <span className="absolute inset-0 flex items-end justify-between p-5">
                <span>
                  <span className="text-[0.62rem] font-semibold uppercase tracking-[0.3em] text-gold">{c.label}</span>
                  <span className="mt-1 block font-display text-2xl text-ivory transition-colors group-hover:text-gold-soft md:text-3xl">
                    {t(c.titleKey)}
                  </span>
                </span>
                <span className="flex h-11 w-11 -translate-y-2 items-center justify-center border border-gold/50 text-gold opacity-0 transition-all duration-500 group-hover:translate-y-0 group-hover:opacity-100">
                  <ArrowUpRight size={18} />
                </span>
              </span>
            </Link>
          </Reveal>
        ))}
      </div>
    </section>
  )
}

function Featured() {
  const { t } = useTranslation()
  const featured = PRODUCTS.filter((p) => p.featured && p.collection !== 'offers').slice(0, 8)
  return (
    <section className="border-y border-gold/10 bg-carbon/40 py-20 md:py-28">
      <div className="mx-auto max-w-[1600px] px-4 lg:px-8">
        <SectionTitle eyebrow={t('badges.limited')} title={t('sections.featured.title')} subtitle={t('sections.featured.subtitle')} />
        <ProductGrid products={featured} />
        <div className="mt-14 text-center">
          <Link
            to="/catalogo"
            className="group inline-flex items-center gap-2 border border-gold/50 px-10 py-4 text-xs font-semibold uppercase tracking-[0.28em] text-gold transition-all hover:bg-gold hover:text-night"
          >
            {t('nav.viewAll')} <ArrowRight size={14} className="transition-transform group-hover:translate-x-1" />
          </Link>
        </div>
      </div>
    </section>
  )
}

const PILLARS = [
  { key: 'quality', icon: '✦' },
  { key: 'design', icon: '❖' },
  { key: 'materials', icon: '◈' },
  { key: 'detail', icon: '✧' },
  { key: 'exclusive', icon: '➤' },
  { key: 'produccion', icon: '◆' },
]

function Philosophy() {
  const { t } = useTranslation()
  return (
    <section className="mx-auto max-w-[1600px] px-4 py-20 md:py-28 lg:px-8">
      <div className="grid items-center gap-12 lg:grid-cols-2">
        <Reveal variant="fade-in">
          <div className="grid grid-cols-2 gap-3">
            <img src={editorialImage('ATELIER I')} alt="" loading="lazy" className="aspect-[3/4] w-full object-cover border border-gold/10" />
            <img src={editorialImage('ATELIER II')} alt="" loading="lazy" className="mt-10 aspect-[3/4] w-full object-cover border border-gold/10" />
          </div>
        </Reveal>
        <div>
          <SectionTitle align="left" eyebrow={t('about.kicker')} title={t('sections.philosophy.title')} subtitle={t('sections.philosophy.subtitle')} />
          <div className="grid gap-x-6 gap-y-6 sm:grid-cols-2">
            {PILLARS.map((p, i) => (
              <Reveal key={p.key} delay={i * 70}>
                <div className="group border border-gold/15 p-5 transition-colors hover:border-gold/50">
                  <span className="text-lg text-gold">{p.icon}</span>
                  <h3 className="mt-2 font-display text-lg text-ivory transition-colors group-hover:text-gold-soft">
                    {t(`sections.philosophy.${p.key}`)}
                  </h3>
                  <p className="mt-1 text-sm font-light leading-relaxed text-bone">
                    {t(`sections.philosophy.${p.key}Desc`)}
                  </p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}

function TurkishExperience() {
  const { t } = useTranslation()
  return (
    <section className="relative overflow-hidden border-y border-gold/10 py-24 md:py-32">
      <div className="absolute inset-0">
        <img src={editorialImage('ISTANBUL NIGHT')} alt="" loading="lazy" className="h-full w-full object-cover opacity-35" />
        <div className="absolute inset-0 bg-gradient-to-r from-night via-night/85 to-night/40" />
      </div>
      <div className="relative mx-auto max-w-[1600px] px-4 lg:px-8">
        <div className="max-w-xl">
          <Reveal>
            <p className="mb-3 text-[0.68rem] font-semibold uppercase tracking-[0.42em] text-gold">
              — <MapPin size={12} className="inline" /> Istanbul —
            </p>
            <h2 className="font-display text-3xl font-semibold text-ivory md:text-5xl">{t('sections.turkey.title')}</h2>
            <p className="mt-5 text-sm font-light leading-relaxed text-silver md:text-base">{t('sections.turkey.subtitle')}</p>
            <p className="mt-4 font-accent text-lg italic leading-relaxed text-bone md:text-xl">{t('sections.turkey.para')}</p>
            <div className="mt-8 grid grid-cols-2 gap-4">
              {['istanbul', 'ottoman', 'marble', 'night'].map((k) => (
                <div key={k} className="border border-gold/20 px-4 py-3">
                  <p className="text-[0.62rem] font-semibold uppercase tracking-[0.24em] text-gold">{t(`sections.turkey.${k}`)}</p>
                </div>
              ))}
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  )
}

function NewsletterCta() {
  const { t } = useTranslation()
  return (
    <section className="mx-auto max-w-[1600px] px-4 py-24 lg:px-8">
      <Reveal variant="scale-in">
        <div className="relative overflow-hidden border border-gold/20 bg-[radial-gradient(120%_120%_at_50%_0%,rgba(201,162,39,0.14)_0%,rgba(13,13,13,0)_50%)] bg-carbon px-6 py-16 text-center md:py-24">
          <div className="absolute left-1/2 top-0 h-px w-2/3 -translate-x-1/2 bg-gold-gradient" />
          <p className="text-[0.66rem] font-semibold uppercase tracking-[0.5em] text-gold">— {t('misc.freeShippingBadge')} $300+ —</p>
          <h2 className="font-display mx-auto mt-4 max-w-2xl text-3xl font-semibold text-ivory md:text-5xl">
            {t('sections.newsletter.title')}
          </h2>
          <p className="mx-auto mt-4 max-w-lg text-sm font-light text-bone md:text-base">
            {t('sections.newsletter.subtitle')}
          </p>
          <div className="mt-8 flex justify-center">
            <NewsletterForm />
          </div>
        </div>
      </Reveal>
    </section>
  )
}

export default function Home() {
  return (
    <>
      <Hero />
      <Categories />
      <Featured />
      <Philosophy />
      <TurkishExperience />
      <NewsletterCta />
    </>
  )
}