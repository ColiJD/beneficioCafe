# Reglas del proyecto

## Base beneficioCafe (producción): solo lectura

- La base `beneficioCafe` (mismo servidor y credenciales del `.env`) se usa **solo en modo consulta**.
- Solo se permiten `SELECT`, `SHOW`, `DESCRIBE` y `EXPLAIN`.
- Prohibido modificar o eliminar nada: nada de `INSERT`, `UPDATE`, `DELETE`, `DROP`, `ALTER`, `TRUNCATE`, `CREATE`, migraciones ni `prisma db push`/`migrate`.

## Base beneficioCafe_copia (desarrollo): lectura y escritura permitidas

- Se puede escribir **solo** en `beneficioCafe_copia`, y únicamente cuando el usuario lo pida.
- Antes de cada comando que escriba, verificar que la URL apunta a `beneficioCafe_copia` y nunca a `beneficioCafe` ni a `cafehenola2026`.
- Copiar datos de producción a desarrollo es solo lectura sobre producción: nunca escribir en `beneficioCafe`.

## Otras bases del servidor (`cafehenola2026`, etc.)

- Pertenecen a otros proyectos: no son origen ni destino de datos de belagos y no se escribe en ellas.

## General

- No modificar el `.env`; la URL de cada base se pasa solo en el comando (variable `DATABASE_URL` puntual).

## Pruebas

- Ejecutar pruebas **solo cuando el usuario lo pida**, y entonces correr **solo las de las áreas con cambios** (según `git status`/`git diff`), nunca toda la suite por defecto.
- Correr la suite completa (`npm test`) únicamente si el usuario pide expresamente "todas" o antes de un despliegue que él mismo solicite.
- Qué correr según lo que cambió (scripts de `package.json`; para un archivo suelto: `node --env-file=.env --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --import ./tests/setup/alias.mjs --test <archivo>`):
  - `src/lib/inventarioMov.js`, APIs de compras, ventas, transferencias, secado, contratos, entregas → `tests/unit/inventario`, `tests/integracion/inventario`, `tests/e2e/funcionales` y `concurrencia`.
  - `src/lib/permisos.js`, `modulos.js`, `checkRole.js`, `auth.js`, `middleware.js`, APIs de `auth/login` y `auth/roles` → `tests/unit/permisos`, `tests/integracion/permisos`, `tests/e2e/no-funcionales`.
  - `auth/recover`, `auth/reset-password`, `limiteIntentos.js` → `tests/e2e/recuperacion`.
  - `src/lib/empresa*.js`, tabla `empresa` → `tests/unit/empresa` y `tests/integracion/empresa`.
  - `src/lib/cosecha*.js`, `src/lib/prisma.js` (guarda de fechas), tablas `cosecha` → `tests/integracion/cosechas`.
  - Cálculos (`calculos`) → `tests/unit/calculos`.
  - Solo pantallas, PDFs, estilos o textos → no hay prueba automática: verificarlo a mano y decirlo.
- Las pruebas HTTP (`tests/e2e`) tardan minutos y usan el servidor de desarrollo; si se cortan a la mitad quedan datos `QA_*` en `beneficioCafe_copia`: revisar y limpiar por ID exacto antes de repetir.
