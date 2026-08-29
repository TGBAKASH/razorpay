import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Razorpay DealFlow Dashboard',
  description: 'The negotiation layer for agentic commerce',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-slate-50 text-slate-900 antialiased">
        {children}
      </body>
    </html>
  );
}
