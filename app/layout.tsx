import { ClerkProvider } from '@clerk/nextjs'
import './globals.css'

// app/layout.tsx

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <ClerkProvider>
      <html lang="en">
       <body suppressHydrationWarning>
          {children}
        </body>
      </html>
    </ClerkProvider>
  )
}