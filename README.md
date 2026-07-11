# QONFORMA

Aplicación de control de calidad: registro diario de muestras por líneas de producción y lotes, resultados de análisis y alertas automáticas cuando un valor queda fuera de especificación.

**Stack:** React (Vite) · Express · SQLite (better-sqlite3) · JWT

## Puesta en marcha

Terminal 1 — API (puerto 3001):

```bash
cd server
npm install
npm run dev
```

Terminal 2 — Frontend (puerto 5173, con proxy a la API):

```bash
cd client
npm install
npm run dev
```

Abre http://localhost:5173

**Acceso:** en el primer arranque se crea un usuario administrador. Puedes definir sus credenciales con las variables de entorno `ADMIN_USER` y `ADMIN_PASSWORD`; si no las defines, se genera una contraseña aleatoria que se muestra una única vez en la consola del servidor. La contraseña se puede cambiar después desde la propia app (menú lateral → «Cambiar contraseña»), y también puedes crear más cuentas desde la pantalla de login.

## Cómo funciona

0. **Registro diario** (página de inicio): una hoja tipo Excel por día, con las muestras **agrupadas por producto + lote**. Cada grupo tiene una banda con el producto y el lote (ambos editables desde la banda; renombrar el lote o cambiar el producto afecta a todas sus muestras) y un botón «+ muestra» que añade la siguiente toma del lote con la hora actual. Cada fila tiene código automático (`M-AAAAMMDD-NN`), hora editable y una celda por análisis: las columnas son la unión de los análisis de los productos presentes ese día, cada celda aplica el rango del producto de su fila (visible al pasar el ratón), las grises no aplican y las rojas están fuera de especificación (generan alerta). Los valores se guardan al salir de la celda y Enter/↓/↑ se mueven por la columna. Al cambiar el producto de un lote con resultados, se conservan y re-evalúan los análisis con el mismo nombre y se eliminan los demás.
1. **Productos**: crea un producto y, dentro de él, define las especificaciones de sus análisis (parámetro, unidad, rango mínimo/máximo).
2. **Muestras**: registra muestras con código único, producto (seleccionado de la lista), lote y estado (pendiente, en análisis, aprobada, rechazada).
3. **Resultados**: dentro de cada muestra, registra el valor medido para uno de los análisis definidos en su producto. El servidor lo evalúa contra el rango:
   - Dentro de rango → resultado *conforme*.
   - Fuera de rango → resultado *fuera de especificación* y se **crea una alerta automáticamente**. Si luego corriges el resultado a un valor conforme, la alerta se elimina.
4. **Alertas**: listado de alertas abiertas/resueltas, con opción de resolver, reabrir o eliminar.

## API

Todas las rutas (salvo `/api/auth/*`) requieren cabecera `Authorization: Bearer <token>`.

| Método | Ruta | Descripción |
|---|---|---|
| POST | `/api/auth/register` | Crear usuario |
| POST | `/api/auth/login` | Iniciar sesión (devuelve JWT) |
| GET | `/api/auth/me` | Usuario actual |
| GET/POST | `/api/products` | Listar / crear productos |
| GET/PUT/DELETE | `/api/products/:id` | Detalle (incluye especificaciones) / editar / borrar |
| GET/POST | `/api/samples` | Listar (filtros `status`, `q`, `product_id`) / crear muestras |
| GET/PUT/DELETE | `/api/samples/:id` | Detalle (incluye resultados) / editar / borrar |
| GET/POST | `/api/specifications` | Listar (filtro `product_id`) / crear especificaciones |
| GET/PUT/DELETE | `/api/specifications/:id` | Detalle / editar / borrar |
| GET/POST | `/api/results` | Listar (filtros `sample_id`, `status`) / crear resultados |
| GET/PUT/DELETE | `/api/results/:id` | Detalle / editar / borrar |
| GET | `/api/alerts` | Listar alertas (filtro `status`) |
| PATCH | `/api/alerts/:id/resolve` | Resolver alerta |
| PATCH | `/api/alerts/:id/reopen` | Reabrir alerta |
| DELETE | `/api/alerts/:id` | Eliminar alerta |
| GET | `/api/daily` | Hoja diaria: productos con especificaciones y muestras del día con resultados (`date`) |

La base de datos se guarda en `server/qc.db` (se crea sola al arrancar).

En producción define la variable de entorno `JWT_SECRET` con un valor secreto propio.
