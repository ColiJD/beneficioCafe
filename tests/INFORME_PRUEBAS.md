# Informe de pruebas — belagos

**Fecha:** 2026-11-05
**Base:** `beneficioCafe_copia` (desarrollo). Las pruebas abortan si `DATABASE_URL` apunta a otra base (`tests/setup/db.mjs`).
**Herramienta:** el runner de pruebas que trae Node (`node --test`). No se agregó ninguna dependencia.

## Cómo correrlas

```bash
npm run test:unit
```
```bash
npm run test:integracion
```
```bash
npm run dev
```
Las pruebas por HTTP necesitan el servidor de desarrollo encendido. `TEST_URL` toma `http://localhost:3000` por defecto; si el servidor usa otro puerto, se pasa en el comando:
```bash
TEST_URL=http://localhost:3001 npm run test:e2e
```

## Resultado final: 58 de 58 pruebas pasan

| Tipo | Archivo | Pruebas | Qué comprueba |
|---|---|---|---|
| Unitarias | `unit/calculos.test.mjs` | 9 | Cálculo de oro, peso bruto y secado; validaciones de cédula, RTN, teléfono, correo y números |
| Unitarias | `unit/inventario.test.mjs` | 8 | Redondeo, estado anulado, `moverInventario` (que no deje el saldo en negativo), errores, pendientes y reparto FIFO de liquidaciones |
| Unitarias | `unit/permisos.test.mjs` | 9 | 41 módulos, dependencias, de qué módulo es cada API y cada ruta, ADMIN solo en Administración, limpieza de permisos |
| Integración | `integracion/inventario.int.test.mjs` | 9 | Movimientos reales en la base dentro de una transacción que se revierte; las 10 vistas responden |
| Integración | `integracion/permisos.int.test.mjs` | 4 | Suma de rol principal, roles extra y permisos directos; las dependencias solo dan acceso a datos; el rol ADMIN no da otros módulos |
| Funcionales | `e2e/funcionales.e2e.test.mjs` | 5 | Inicio de sesión; compra, venta y transferencia completas (crear, editar y anular) con sus efectos en el inventario; informe general |
| Regresión | `e2e/funcionales.e2e.test.mjs` y `integracion/` | 5 + 4 | No se anula dos veces; no se edita lo anulado; no se vende ni transfiere más del saldo; la transferencia guarda Salida/Entrada; el inventario cuadra con el historial y con la vista |
| No funcionales | `e2e/no-funcionales.e2e.test.mjs` | 9 | Seguridad (sin sesión, sin permisos, solo lectura, ADMIN, inyección SQL) y rendimiento (p95 y 20 peticiones simultáneas) |

### Rendimiento medido (servidor de desarrollo, base remota)

| Endpoint | p50 | p95 | Límite |
|---|---|---|---|
| `GET /api/compras` | 1231 ms | 1357 ms | 3000 ms |
| `GET /api/reportes` | 3164 ms | 3289 ms | 4000 ms |
| `GET /api/auth/permisos` | 1104 ms | 1228 ms | 2000 ms |
| 20 × `GET /api/compras` simultáneas | — | 4510 ms en total | 15000 ms |

`/api/reportes` es el más lento: unos 3 s.

## Defectos que encontraron las pruebas (ya corregidos)

1. **Crítico, regresión:** registrar una compra directa, un contrato de entrada, un contrato de salida o una confirmación de venta, y consultar los contratos pendientes, daba **error 500**. Esos 6 handlers le pasaban a `checkRole` el segundo argumento (el contexto de Next) en lugar de la petición. Corrección: `checkRole(request, …)` en
   `api/compras`, `api/contratos`, `api/contratoSalida`, `api/salidas`, `api/contratos/pendientes/[clienteID]` y `api/contratoSalida/pendientes/[clienteID]`.
2. **Crítico, seguridad:** `/api/auth/login` (la administración de usuarios) no pedía sesión, y el middleware excluye `/api/auth`. Sin iniciar sesión cualquiera podía **listar los 14 usuarios con el hash de su contraseña**, crear usuarios (incluso ADMIN), cambiar contraseñas y borrar usuarios. Corrección: `requireAdmin()` en GET, POST, PUT y DELETE, y las respuestas ya no incluyen `userPassword`.
3. **Menor, seguridad:** `GET /api/auth/roles` mostraba la matriz de permisos a cualquier usuario con sesión. Ahora solo a ADMIN; únicamente lo usan las pantallas de Administración.

4. **Medio, seguridad:** 8 endpoints no validaban permisos; cualquier usuario con sesión podía usarlos. Ahora sí validan:
   - `POST /api/fix-statuses` y `GET /api/test_view`: solo ADMIN. Ninguna pantalla los usa; son de mantenimiento y diagnóstico.
   - `GET /api/liqDeposito/RedDeLiquidacion`
   - `GET /api/prestamos/[clienteId]`: vale con permiso de préstamos o de anticipos, porque es la misma pantalla.
   - `GET /api/salidas/pendientes/[compradorID]`
   - `GET /api/salidas/[salidaID]`
   - `GET /api/secado/[id]`
   - `GET /api/secadoras/[id]`

   Los módulos que consultan esos datos siguen entrando gracias a las dependencias, y hay una prueba que lo comprueba. De paso, `salidas/pendientes` y `secadoras/[id]` ahora esperan `params` (`await`), como pide Next 15. `GET /api/liqDeposito` ya estaba protegido.

**Total después de las correcciones: 60 de 60 pruebas pasan** (26 unitarias, 13 de integración y 21 por HTTP).

## Observaciones sin corregir

- **Rutas de recuperación de contraseña.** `auth/recover`, `auth/reset-password` y `auth/validate-token` son públicas por diseño. No se probaron el envío de correos ni el límite de intentos.
- **Venta directa.** Valida el saldo antes de abrir la transacción. Dos ventas simultáneas podrían pasar la validación a la vez.

## Limpieza de datos

Las pruebas de integración corren dentro de transacciones que se revierten. Las pruebas por HTTP crean usuarios y roles `QA_…` y transacciones con la descripción "QA prueba automática". Al terminar las borran y devuelven el inventario exactamente al saldo anterior.

Verificado después de la última corrida: 0 usuarios, roles, compras o movimientos de prueba en la base, y el inventario cuadra con el historial en los 6 productos.
