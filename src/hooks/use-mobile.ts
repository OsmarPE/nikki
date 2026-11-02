import * as React from "react"

// 1024 (lg) y no 768: en tablet vertical (~820px) el menú fijo de 256px dejaba
// muy poco espacio al contenido; ahí se usa el menú desplegable como en celular.
// Debe coincidir con los `lg:` de components/ui/sidebar.tsx.
const MOBILE_BREAKPOINT = 1024

export function useIsMobile() {
  const [isMobile, setIsMobile] = React.useState<boolean | undefined>(undefined)

  React.useEffect(() => {
    const mql = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`)
    const onChange = () => {
      setIsMobile(window.innerWidth < MOBILE_BREAKPOINT)
    }
    mql.addEventListener("change", onChange)
    setIsMobile(window.innerWidth < MOBILE_BREAKPOINT)
    return () => mql.removeEventListener("change", onChange)
  }, [])

  return !!isMobile
}
