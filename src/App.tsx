import { lazy, Suspense } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { Layout } from '@/components/Layout'
import { Loader } from '@/components/Loader'
import { Toaster } from '@/components/Toaster'

const Home = lazy(() => import('@/pages/Home'))
const Men = lazy(() => import('@/pages/Men'))
const Women = lazy(() => import('@/pages/Women'))
const NewCollection = lazy(() => import('@/pages/NewCollection'))
const Offers = lazy(() => import('@/pages/Offers'))
const Catalog = lazy(() => import('@/pages/Catalog'))
const Product = lazy(() => import('@/pages/Product'))
const Cart = lazy(() => import('@/pages/Cart'))
const Checkout = lazy(() => import('@/pages/Checkout'))
const Favorites = lazy(() => import('@/pages/Favorites'))
const Contact = lazy(() => import('@/pages/Contact'))
const About = lazy(() => import('@/pages/About'))
const FAQ = lazy(() => import('@/pages/FAQ'))
const Legal = lazy(() => import('@/pages/Legal'))
const Admin = lazy(() => import('@/pages/Admin'))

export default function App() {
  return (
    <Suspense fallback={<Loader />}>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<Home />} />
          <Route path="/hombre" element={<Men />} />
          <Route path="/mujer" element={<Women />} />
          <Route path="/nueva-coleccion" element={<NewCollection />} />
          <Route path="/ofertas" element={<Offers />} />
          <Route path="/catalogo" element={<Catalog />} />
          <Route path="/producto/:slug" element={<Product />} />
          <Route path="/carrito" element={<Cart />} />
          <Route path="/checkout" element={<Checkout />} />
          <Route path="/favoritos" element={<Favorites />} />
          <Route path="/contacto" element={<Contact />} />
          <Route path="/sobre-nosotros" element={<About />} />
          <Route path="/faq" element={<FAQ />} />
          <Route path="/legal/*" element={<Legal />} />
          <Route path="/mi-cuenta" element={<Navigate to="/admin" replace />} />
          <Route path="*" element={<Home />} />
        </Route>
        <Route path="/admin/*" element={<Admin />} />
      </Routes>
      <Toaster />
    </Suspense>
  )
}