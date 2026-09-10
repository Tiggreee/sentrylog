# sentrylog

Modelo de datos y andamiaje de una aplicación para registrar eventos de CCTV
—detección de movimiento y reconocimiento de vehículos— y convertirlos en
alertas con severidad y seguimiento.

> **Estado: en desarrollo.** El esquema relacional está diseñado y la
> infraestructura del proyecto está montada. La API todavía no expone rutas
> sobre las tablas: `server/index.js` tiene health check y manejo centralizado
> de errores, nada más.

## El problema

Una cámara genera eventos sin parar. La mayoría no importan. El trabajo no es
grabar, es **distinguir** qué merece una alerta, evitar duplicados, y dejar
rastro de qué pasó y cuándo.

## El modelo de datos

Es la parte resuelta del proyecto y donde están las decisiones.

```
cameras ──┬─< events >── vehicles
          └─< alerts
```

| Tabla | Qué guarda | Decisiones |
|---|---|---|
| `cameras` | Nombre, ubicación, estado | `CHECK` en `status`: solo `active`, `inactive` o `error` |
| `vehicles` | Placa, color, tipo, conteo | `UNIQUE (plate, color, type)` para no duplicar el mismo vehículo; `first_seen` / `last_seen` y `appearance_count` en vez de una fila por avistamiento |
| `events` | Movimiento o vehículo | `metadata JSONB` para lo que varía según el tipo de evento, sin romper el esquema |
| `alerts` | Severidad, resuelta o no | Referencia tanto a la cámara como al evento que la originó |

**Borrado en cascada, pero no en todo.** Si se elimina una cámara, sus eventos
y alertas se van con ella: sin la cámara no significan nada
(`ON DELETE CASCADE`). Si se elimina un vehículo, el evento **se conserva** con
`vehicle_id` en `NULL` — hubo movimiento y eso sigue siendo cierto aunque ya no
se sepa qué vehículo era (`ON DELETE SET NULL`).

Esa diferencia es deliberada: no todo lo que depende de algo deja de existir
cuando ese algo desaparece.

## Stack

- **Cliente:** React + Vite
- **Servidor:** Node.js + Express
- **Base de datos:** PostgreSQL
- **CI:** GitHub Actions — lint y build en cada push y pull request, con
  `concurrency` que cancela corridas superadas y permisos mínimos
  (`contents: read`)

## Correrlo

```bash
# cliente
cd client && npm install && npm run dev

# servidor
cd server && npm install && npm run dev

# base de datos
psql "$DATABASE_URL" -f server/db/migrate.sql
```

## Lo que sigue

- [ ] Rutas REST sobre `cameras`, `events` y `alerts`
- [ ] Ingesta de eventos y regla de severidad
- [ ] Vista de operador conectada a datos reales
- [ ] Pruebas sobre la lógica de deduplicación de vehículos

---

Proyecto personal de [Victor Salgado](https://github.com/Tiggreee) ·
[vmdev.lat](https://www.vmdev.lat)
