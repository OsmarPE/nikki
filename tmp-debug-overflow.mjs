import { chromium } from 'playwright';

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  await page.goto('http://localhost:3000/login');
  await page.fill('#email', 'admin@pos.local');
  await page.fill('#password', 'Admin1234');
  await page.click('button[type="submit"]');
  await page.waitForURL(/dashboard/, { timeout: 15000 });
  await page.goto('http://localhost:3000/cuentas-por-cobrar');
  await page.waitForTimeout(1000);

  const btn = page.getByRole('button', { name: 'Cliente', exact: true });
  const btnBox = await btn.boundingBox();
  await btn.click();
  await page.waitForTimeout(400);

  // Dibujar un contorno rojo de 2px alrededor del elemento REAL (el que
  // contiene el input "Filtrar cliente"), usando su propio bounding rect,
  // para ver exactamente donde terminan sus limites reales.
  const rect = await page.evaluate(() => {
    const input = document.querySelector('input[placeholder="Filtrar cliente…"]');
    // Subir hasta el div con overflow-hidden (el contenedor visual real)
    const contenedor = input.closest('div.overflow-hidden');
    const r = contenedor.getBoundingClientRect();
    contenedor.style.outline = '3px solid red';
    contenedor.style.outlineOffset = '0px';
    return { x: r.x, y: r.y, width: r.width, height: r.height };
  });

  console.log('Bounding rect real del contenedor:', JSON.stringify(rect));

  await page.screenshot({
    path: 'C:/Users/osmar/AppData/Local/Temp/claude/c--Users-osmar-Downloads-nikki/c4c25da4-211f-4115-b4e5-2b89e80e4d51/scratchpad/30-debug-outline.png',
    clip: { x: Math.max(0, btnBox.x - 40), y: Math.max(0, btnBox.y - 10), width: 400, height: 300 }
  });

  await browser.close();
})();
