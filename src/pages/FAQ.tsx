import { AccordionItem } from '@/components/Accordion'
import { useTranslation } from 'react-i18next'

const FAQ_GROUPS = ['orders', 'shipping', 'returns', 'products', 'payment'] as const

export default function FAQ() {
  const { t } = useTranslation()

  return (
    <div className="mx-auto max-w-[960px] px-4 pb-24 lg:px-8">
      <header className="border-b border-gold/15 pb-8 pt-6 text-center">
        <h1 className="font-display text-3xl font-semibold tracking-wide text-ivory md:text-5xl">{t('faq.title')}</h1>
        <p className="mt-3 text-sm text-bone">{t('faq.subtitle')}</p>
      </header>

      <div className="mt-12 space-y-10">
        {FAQ_GROUPS.map((group) => (
          <section key={group}>
            <h2 className="mb-4 flex items-center gap-3 font-display text-xl text-ivory">
              <span className="h-px w-8 bg-gold" /> {t(`faq.${group}Title`)}
            </h2>
            <div className="border border-gold/15 bg-carbon/30">
              {[1, 2, 3, 4].map((n) => (
                <AccordionItem key={n} title={t(`faq.${group}Q${n}`)} defaultOpen={group === 'orders' && n === 1}>
                  <p className="font-light leading-relaxed">{t(`faq.${group}A${n}`)}</p>
                </AccordionItem>
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  )
}