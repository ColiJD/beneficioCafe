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
