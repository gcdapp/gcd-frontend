import '@/styles/globals.css'
import { AuthProvider } from '@/lib/auth'
import { Inter } from 'next/font/google'

// Inter — "Minimal Swiss" pairing for dashboards/admin (ui-ux-pro-max). Large
// x-height keeps the app's many 12–13px labels readable; variable font, so
// every weight below ships as one file.
const inter = Inter({
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
    <html lang="en" dir="ltr" className={inter.variable} suppressHydrationWarning>
      <body suppressHydrationWarning>
        <script dangerouslySetInnerHTML={{ __html: `(function(){try{var t=localStorage.getItem('gcd_theme');if(t==='dark')document.documentElement.setAttribute('data-theme','dark')}catch(e){}})()` }} />
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  )
}
