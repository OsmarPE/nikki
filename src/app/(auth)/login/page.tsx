/* eslint-disable @next/next/no-img-element -- recursos decorativos estáticos del diseño (Figma "nikki" › login) */
import localFont from 'next/font/local';
import LoginForm from './login-form';

// Lora va en el proyecto (fuente variable, subconjunto latin) en vez de next/font/google:
// el servidor de build de Hostinger fallaba al descargarla de Google Fonts.
const lora = localFont({
  src: [{ path: './fonts/lora-latin.woff2', weight: '400 700', style: 'normal' }],
  display: 'swap',
});

// Colores de la marca Nikky (diseño de Figma).
// Panel: #855c80 · Botón: #92678e (ver login-form.tsx).

// Logo "NB": el PNG trae margen alrededor; se recorta igual que en el diseño.
function Logo() {
  return (
    <div className="flex items-center gap-[22px]">
      <div className="relative h-[50px] w-[54px] overflow-hidden">
        <img
          src="/login/logo-nb.png"
          alt="Nikky"
          className="absolute max-w-none h-[254.42%] w-[237.24%] left-[-69.48%] top-[-63.03%]"
        />
      </div>
      <span className="text-xs font-medium tracking-[2.4px] text-[#855c80]">NIKKY</span>
    </div>
  );
}

// Panel morado decorativo (solo en pantallas ≥ lg). Posiciones en % del panel
// (608×758 en el diseño) para que escale con la pantalla.
function PanelMarca() {
  return (
    <aside aria-hidden className="relative hidden lg:block overflow-hidden bg-[#855c80]">
      <img src="/login/espiral.svg" alt="" width={38} height={45} className="absolute left-[10.4%] top-[9.1%]" />
      <img src="/login/punto-chico.svg" alt="" width={5} height={5} className="absolute left-[58.4%] top-[10.7%]" />
      <img src="/login/icono-bolsa.svg" alt="" width={24} height={24} className="absolute left-[75%] top-[15%]" />
      <img src="/login/icono-bolsa.svg" alt="" width={24} height={24} className="absolute left-[39.6%] top-[41.6%]" />
      <img src="/login/punto-grande.svg" alt="" width={10} height={10} className="absolute left-[15.8%] top-[56.6%]" />

      {/* Flecha: el SVG va girado -68° y reflejado, centrado en su caja del diseño (160.5×140.4) */}
      <div className="absolute left-[67.8%] top-[24.7%] flex h-[140px] w-[160px] items-center justify-center">
        <img src="/login/flecha.svg" alt="" width={97} height={134} className="-rotate-68 -scale-x-100" />
      </div>

      <p className={`${lora.className} absolute left-[10.4%] w-[70%] top-[22%] text-[clamp(28px,2.5vw,36px)] font-bold leading-tight text-white`}>
        Bolsas que te enamoran a primera vista
      </p>

      <p className={`${lora.className} pointer-events-none absolute -bottom-[0.2em] left-[3%] select-none whitespace-nowrap text-[clamp(260px,27.8vw,400px)] font-semibold leading-none text-white/20`}>
        NB
      </p>
    </aside>
  );
}

export default function LoginPage() {
  return (
    <div className="grid min-h-dvh bg-white lg:grid-cols-[1fr_42.22%]">
      {/* Celular/tablet: logo arriba y formulario centrado. Escritorio (lg): logo fijo en la
          esquina y formulario centrado en la pantalla, alineado a x=202 como en el diseño. */}
      <main className="relative flex flex-col px-6 py-8 sm:px-12 lg:p-0">
        <div className="lg:absolute lg:left-[66px] lg:top-[52px]">
          <Logo />
        </div>
        <div className="flex flex-1 items-center justify-center py-10 lg:justify-start lg:py-0 lg:pb-7 lg:pl-[202px]">
          <div className="w-full max-w-[388px]">
            <h1 className={`${lora.className} text-[30px] font-semibold leading-tight text-black sm:text-[36px]`}>
              Bienvenida
            </h1>
            <p className="mt-0.5 mb-[38px] text-sm text-black/50">
              Ingresa tu cuenta para poder ingresar al sistema.
            </p>
            <LoginForm />
          </div>
        </div>
      </main>
      <PanelMarca />
    </div>
  );
}
