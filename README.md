<div align="center">

<img src="client/public/icon.png" alt="QONFORMA" width="90" />

# QONFORMA

**Control de calidad de planta, pensado para el trabajo del día a día.**

Registro diario tipo hoja de cálculo por líneas de producción y lotes · alertas automáticas
fuera de especificación · trazabilidad completa de lote · tendencias por parámetro

**[▶ Demo en vivo](https://qonforma.onrender.com)** — entra con `demo` / `demo1234`
*(plan gratuito: la primera carga puede tardar ~1 minuto en despertar)*

</div>

---

## Qué hace

QONFORMA replica el flujo real de un laboratorio de control de calidad en planta:

- **Registro diario como una hoja de cálculo**: cada día es una hoja organizada en pestañas por
  **línea de producción**, con bloques por **lote**. Cada fila es una muestra (hora + nº de envase)
  y cada columna un análisis del producto. Los valores se guardan al salir de la celda; Enter y ↓/↑
  recorren la columna como en Excel.
- **Validación instantánea contra especificaciones**: cada producto (con su código de artículo)
  define sus análisis con rangos mín/máx. Un valor fuera de rango pinta la celda en rojo y
  **genera una alerta automáticamente**; si se corrige, la alerta desaparece sola.
- **Alertas con acción correctiva**: al resolver una alerta se registra qué se hizo, y queda
  asociada al lote y nº de envase.
- **Trazabilidad de lote**: los lotes no se repiten — un buscador global lleva al día del lote
  (con su bloque resaltado) y su ficha reúne todas las muestras, medias, analistas y alertas.
- **Cierre de día**: la hoja se cierra con un candado y queda de solo lectura (el servidor rechaza
  cualquier edición); solo un administrador puede reabrirla.
- **Tendencias por parámetro**: gráficas de evolución con la zona de especificación sombreada,
  para detectar derivas antes de salirse de rango.
- **Extras de uso real**: exportación del día a CSV (Excel), medias por lote, roles
  administrador/analista, copia de seguridad de la base de datos descargable, modo oscuro,
  menú plegable y numeración automática de envases.

## Stack

| Capa | Tecnología |
|---|---|
| Frontend | React 18 + Vite, React Router, CSS propio (variables, tema claro/oscuro) |
| Backend | Node.js + Express |
| Base de datos | SQLite (better-sqlite3) con migraciones automáticas al arrancar |
| Autenticación | JWT + bcrypt, roles admin/analista |
| Despliegue | Render (blueprint `render.yaml`); el servidor Express sirve el build del cliente |

Sin ORM y sin librería de gráficas: SQL directo y SVG dibujado a mano.

## Ejecutar en local

```bash
# Terminal 1 — API (puerto 3001)
cd server && npm install && npm run dev

# Terminal 2 — Frontend con recarga (puerto 5173, proxy al API)
cd client && npm install && npm run dev
```

Abre http://localhost:5173. En el primer arranque se crea un usuario administrador:
define `ADMIN_USER` / `ADMIN_PASSWORD`, o mira la contraseña generada en la consola del servidor.

Con `DEMO_MODE=1` la base de datos vacía se puebla con datos de ejemplo (3 productos,
3 días de registros, alertas y un día cerrado).

### Modo producción (una sola pieza)

```bash
npm run build   # compila el cliente e instala dependencias del servidor
npm start       # Express sirve el API y el frontend en el mismo puerto
```

Variables de entorno: `PORT`, `JWT_SECRET`, `DB_PATH`, `ADMIN_USER`, `ADMIN_PASSWORD`, `DEMO_MODE`.

## Desplegar en Render

El repo incluye un blueprint: en Render, **New → Blueprint**, apunta a este repositorio y listo.
Compila el cliente, arranca el servidor con datos de demostración y expone la app en una URL pública.

## API

REST bajo `/api`, protegido con JWT salvo el login/registro. Recursos: `products`
(con especificaciones y tendencias), `samples`, `results`, `alerts` (resolver/reabrir con nota),
`daily` (hoja del día, días con registros, cierre de día), `lots/:batch` (trazabilidad)
y `backup` (solo admin).
