import type { Metadata } from 'next';
import { Outfit } from 'next/font/google';
import Script from 'next/script';
import './globals.css';
import { Toaster } from '@/components/ui/sonner';
import { TooltipProvider } from '@/components/ui/tooltip';

const outfit = Outfit({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'Nikki',
  description: 'Punto de Venta e Inventario',
};

const FONT_SIZE_INIT_SCRIPT = `(function(){try{var s=localStorage.getItem('nikki:font-size');var m={sm:87.5,md:100,lg:112.5,xl:125};if(s&&m[s])document.documentElement.style.fontSize=m[s]+'%';}catch(e){}})();`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body className={`${outfit.className} bg-background text-foreground antialiased min-h-screen`}>
        <Script id="font-size-init" strategy="beforeInteractive">
          {FONT_SIZE_INIT_SCRIPT}
        </Script>
        <TooltipProvider>
          {children}
        </TooltipProvider>
        <Toaster theme='light' richColors={false} />
      </body>
    </html>
  );
}
