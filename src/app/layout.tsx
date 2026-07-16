import type { Metadata } from 'next';
import { Outfit } from 'next/font/google';
import './globals.css';
import { Toaster } from '@/components/ui/sonner';
import { TooltipProvider } from '@/components/ui/tooltip';

const outfit = Outfit({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'Nikki',
  description: 'Punto de Venta e Inventario',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body className={`${outfit.className} bg-background text-foreground antialiased min-h-screen`}>
        <TooltipProvider>
          {children}
        </TooltipProvider>
        <Toaster theme='light' richColors={false} />
      </body>
    </html>
  );
}
