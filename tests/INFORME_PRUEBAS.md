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

5. **Medio, inventario:** la venta directa validaba el saldo antes de la transacción y descontaba sin condición. Dos ventas simultáneas podían dejar el inventario en negativo. Ahora descuenta con `moverInventario`, que solo resta si el saldo alcanza. Una prueba lanza dos ventas a la vez que juntas superan el saldo: solo pasa una.
6. **Recuperación de contraseña:**
   - **Alto:** la sesión del navegador (`/api/auth/session`) incluía el token de refresco. Ese token se guarda en `password_resets` y servía como enlace de recuperación durante 24 h: quien lo viera podía cambiar la contraseña. Ya no se envía al navegador.
   - **Medio:** `recover` no tenía límite. Ahora acepta 3 solicitudes por correo y 20 por IP cada 15 minutos; después responde 429. `reset-password` acepta 20 intentos por IP.
   - **Medio:** si el envío del correo fallaba, `recover` respondía 500 solo para correos existentes, lo que revelaba qué cuentas hay. Ahora siempre responde igual y registra el error en el servidor.
   - **Bajo:** cada solicitud dejaba vigentes los enlaces anteriores, y al cambiar la contraseña solo se borraba el enlace usado. Ahora queda un solo enlace por usuario y al restablecer se borran todos.
   - **Bajo:** no había mínimo de contraseña. Ahora son 8 caracteres, en el API y en el formulario.
   - **Bajo:** cuerpos inválidos (sin JSON, objetos en lugar de texto) daban 500. Ahora dan 400.

7. **Medio, inventario:** el mismo problema de la venta directa estaba en otras tres transacciones: entregar un contrato de salida, editar esa entrega y empezar un secado. Validaban el saldo y después restaban sin condición. Ahora las tres descuentan con `moverInventario`. Con esto, todas las transacciones que restan inventario usan el descuento protegido.
   - **Inicio de secado:** dos secados a la vez en la misma secadora producían un deadlock de MySQL y respondían 500. Ahora la secadora se bloquea primero y el segundo espera su turno.
   - **Respuestas de error:** cualquier conflicto entre transacciones simultáneas (Prisma `P2034`) responde 409, "intente de nuevo". Estas rutas ya no devuelven al usuario mensajes internos de la base: el saldo insuficiente da 400 con su mensaje, y cualquier otro error da 500 con un texto genérico.

**Total después de las correcciones: 71 pruebas** (26 unitarias, 13 de integración y 32 por HTTP). En la última corrida pasaron todas menos una vez la de rendimiento: `/api/reportes` tiene un p95 de 3.3 a 4.0 s, justo en el límite de 4 s. Al repetirla pasó con 3.9 s. Es el endpoint a optimizar si el informe general se siente lento.

## Observaciones sin corregir

- **Envío real del correo: verificado el 2026-11-05.** Con las credenciales SMTP en el `.env`, el correo llegó a `jdsoportesys@gmail.com`, el enlace abrió el formulario y la contraseña nueva permitió iniciar sesión.
- **Usuario de prueba.** `jdsoportesys@gmail.com` (userId 40, "Soporte pruebas") existe en desarrollo con el rol `PRUEBAS`, que no tiene permisos. Su contraseña es aleatoria: se define con la recuperación.
- **Enlace del correo.** Se arma con `NEXT_PUBLIC_URL` (`http://localhost:3000` en el `.env`). Si el servidor de desarrollo corre en otro puerto, el enlace apunta al puerto equivocado. Si `NEXT_PUBLIC_URL` faltara, se usa el `Host` de la petición, que el cliente puede falsear: en producción debe estar definido.
- **Saldo del contrato de salida.** Se valida fuera de la transacción: dos entregas simultáneas del mismo contrato podrían pasar juntas el saldo del contrato. El inventario sí queda protegido.
- **El límite de intentos vive en la memoria del proceso.** Se reinicia al reiniciar el servidor y no se comparte si hay varias instancias.
- **Tokens de refresco y de recuperación comparten la tabla `password_resets`.** Al iniciar sesión se borran los enlaces de recuperación pendientes del usuario. Separarlos requiere un cambio de esquema.

## Limpieza de datos

Las pruebas de integración corren dentro de transacciones que se revierten. Las pruebas por HTTP crean usuarios y roles `QA_…` y transacciones con la descripción "QA prueba automática". Al terminar las borran y devuelven el inventario exactamente al saldo anterior.

Verificado después de la última corrida: 0 usuarios, roles, compras o movimientos de prueba en la base, y el inventario cuadra con el historial en los 6 productos.
