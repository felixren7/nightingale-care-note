import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  metadataBase: new URL(process.env.APP_ORIGIN ?? 'http://localhost:3000'),
  title: 'Nightingale Care Note',
  description:
    'A shared, longitudinal care note with explainable clinical priorities and source-level provenance.',
  openGraph: {
    title: 'Nightingale Care Note',
    description: 'Shared context. Clear action. Trusted provenance.',
    images: [{ url: '/og.png', width: 1200, height: 630 }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Nightingale Care Note',
    description: 'Shared context. Clear action. Trusted provenance.',
    images: ['/og.png'],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
