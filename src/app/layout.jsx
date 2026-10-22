import '@/styles/globals.css'
import { AuthProvider } from '@/lib/auth'
import { Poppins } from 'next/font/google'

// Poppins is the brand typeface — used across the whole app (print templates
// load it themselves).
const poppins = Poppins({
  weight: ['300', '400', '500', '600', '700', '800', '900'],
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-sans',
})

export const metadata = {
  title: { default: 'GCD Dashboard', template: '%s | GCD' },
  description: 'Golden Crescent Delivery — Internal Operations Dashboard',
  icons: {
    icon: '/logo.webp',
    apple: '/logo.webp',
  },
  manifest: '/manifest.json',
}

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
}

export default function RootLayout({ children }) {
  return (
    <html lang="en" dir="ltr" className={poppins.variable} suppressHydrationWarning>
      <body suppressHydrationWarning>
        <script dangerouslySetInnerHTML={{ __html: `(function(){try{var t=localStorage.getItem('gcd_theme');if(t==='dark')document.documentElement.setAttribute('data-theme','dark')}catch(e){}})()` }} />
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  )
}
