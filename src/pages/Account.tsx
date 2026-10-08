import { useState } from 'react'
import { Link } from 'react-router-dom'
import { User, Lock, LogOut, Package, Heart, Settings, ChevronRight } from 'lucide-react'
import { useTranslation } from 'react-i18next'

export default function Account() {
  const { t } = useTranslation()
  const [loggedIn, setLoggedIn] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [form, setForm] = useState({ name: '', country: '', city: '', address: '', zip: '' })
  const [saved, setSaved] = useState(false)

  const login = (e: React.FormEvent) => {
    e.preventDefault()
    setLoggedIn(true)
  }

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm((f) => ({ ...f, [k]: e.target.value }))
    setSaved(false)
  }

  const save = () => {
    setSaved(true)
  }

  return (
    <div className="mx-auto max-w-[1200px] px-4 pb-24 lg:px-8">
      <header className="border-b border-gold/15 pb-8 pt-6 text-center">
        <h1 className="font-display text-3xl font-semibold tracking-wide text-ivory md:text-5xl">{t('account.title')}</h1>
      </header>

      {!loggedIn ? (
        <div className="mx-auto mt-14 max-w-md border border-gold/15 bg-carbon/50 p-8">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full border border-gold/40 text-gold">
            <User size={20} />
          </div>
          <h2 className="mt-4 text-center font-display text-xl text-ivory">{t('account.welcome')}</h2>
          <p className="mt-1 text-center text-xs text-bone">{t('account.loginHint')}</p>
          <form onSubmit={login} className="mt-6 space-y-4">
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={t('account.email')}
              className="w-full border border-gold/25 bg-night px-4 py-3 text-sm text-ivory placeholder:text-bone/60 focus:border-gold focus:outline-none"
            />
            <input
              type="password"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={t('account.password')}
              className="w-full border border-gold/25 bg-night px-4 py-3 text-sm text-ivory placeholder:text-bone/60 focus:border-gold focus:outline-none"
            />
            <div className="flex items-center justify-between text-xs">
              <label className="flex items-center gap-1.5 text-bone">
                <input type="checkbox" className="accent-gold" /> {t('account.remember')}
              </label>
              <span className="text-gold">{t('account.forgot')}</span>
            </div>
            <button type="submit" className="flex w-full items-center justify-center gap-2 bg-gold py-3.5 text-xs font-bold uppercase tracking-[0.26em] text-night hover:bg-gold-soft">
              <Lock size={14} /> {t('account.login')}
            </button>
          </form>
          <p className="mt-4 text-center text-[0.68rem] text-bone">{t('account.mockNote')}</p>
        </div>
      ) : (
        <div className="mt-10 grid gap-8 lg:grid-cols-[260px_1fr]">
          <aside className="h-fit border border-gold/15 bg-carbon/50 p-2 lg:sticky lg:top-28">
            {[
              { icon: User, key: 'profile' },
              { icon: Package, key: 'orders' },
              { icon: Heart, key: 'favorites' },
              { icon: Settings, key: 'settings' },
            ].map(({ icon: Icon, key }) => (
              <a key={key} href={`#${key}`} className="flex items-center gap-3 border-b border-gold/10 px-4 py-3.5 text-sm text-ivory transition-colors hover:bg-gold/10 hover:text-gold">
                <Icon size={16} className="text-gold" /> {t(`account.${key}`)} <ChevronRight size={14} className="ml-auto text-bone" />
              </a>
            ))}
            <a href="#logout" onClick={(e) => { e.preventDefault(); setLoggedIn(false) }} className="flex items-center gap-3 px-4 py-3.5 text-sm text-bone transition-colors hover:text-red-400">
              <LogOut size={16} /> {t('account.logout')}
            </a>
          </aside>

          <div className="space-y-8">
            <section id="profile" className="border border-gold/15 p-6 md:p-8">
              <h2 className="font-display mb-1 text-lg text-ivory">{t('account.profile')}</h2>
              <p className="mb-5 text-xs text-bone">{email}</p>
              <div className="grid gap-4 sm:grid-cols-2">
                {([
                  ['name', t('account.fullName')],
                  ['country', t('checkout.country')],
                  ['city', t('checkout.city')],
                  ['address', t('checkout.address')],
                  ['zip', t('checkout.zip')],
                ] as const).map(([k, label]) => (
                  <div key={k} className={k === 'address' ? 'sm:col-span-2' : ''}>
                    <label className="mb-1 block text-[0.66rem] font-semibold uppercase tracking-[0.2em] text-bone">{label}</label>
                    <input
                      value={form[k]}
                      onChange={set(k)}
                      placeholder={label}
                      className="w-full border border-gold/25 bg-night px-4 py-3 text-sm text-ivory placeholder:text-bone/60 focus:border-gold focus:outline-none"
                    />
                  </div>
                ))}
              </div>
              <div className="mt-6 flex items-center gap-3">
                <button onClick={save} className="bg-gold px-8 py-3 text-xs font-bold uppercase tracking-[0.26em] text-night hover:bg-gold-soft">
                  {t('account.save')}
                </button>
                {saved && <span className="text-sm text-gold">✓ {t('account.saved')}</span>}
              </div>
            </section>

            <section id="orders" className="border border-gold/15 p-6 md:p-8">
              <h2 className="font-display mb-1 text-lg text-ivory">{t('account.orders')}</h2>
              <p className="mb-4 text-xs text-bone">{t('account.ordersHint')}</p>
              <div className="border border-dashed border-gold/30 p-6 text-center text-sm text-bone">
                {t('account.noOrders')} — <Link to="/catalogo" className="text-gold underline underline-offset-4">{t('cart.continue')}</Link>
              </div>
            </section>
          </div>
        </div>
      )}
    </div>
  )
}