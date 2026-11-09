# Taller Mecánico — versión local (XAMPP)

Sistema de gestión para taller mecánico (Next.js + Prisma + NextAuth) configurado para
correr **100 % en local** con el MySQL/MariaDB de **XAMPP**. No requiere Supabase ni Upstash Redis.

## Requisitos

- [Node.js](https://nodejs.org) 20 o superior
- [XAMPP](https://www.apachefriends.org) (solo se usa el módulo **MySQL**)

## Instalación

1. **Inicia MySQL** desde el panel de control de XAMPP (botón *Start* en MySQL).

2. **Crea la base de datos** (en phpMyAdmin → `http://localhost/phpmyadmin`, o por consola):

   ```sql
   CREATE DATABASE taller_mecanico CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
   ```

3. **Configura las variables de entorno**:

   ```bash
   cp .env.example .env
   ```

   Edita `.env` si tu usuario `root` de MySQL tiene contraseña:
   `mysql://root:TU_PASSWORD@localhost:3306/taller_mecanico`.
   Cambia `NEXTAUTH_SECRET` por un valor largo y aleatorio.

4. **Instala dependencias y crea las tablas**:

   ```bash
   npm install
   npm run db:push
   ```

5. **Crea el usuario administrador** (revisa usuario/contraseña en `scripts/crear-admin.js` antes de ejecutarlo):

   ```bash
   npm run db:admin
   ```

6. **Arranca la aplicación**:

   ```bash
   npm run dev
   ```

   Abre <http://localhost:3000> e inicia sesión.

## Scripts

| Comando | Descripción |
|---|---|
| `npm run dev` | Servidor de desarrollo |
| `npm run build` / `npm start` | Compilación y servidor de producción local |
| `npm run db:push` | Crea/actualiza las tablas en MySQL según `prisma/schema.prisma` |
| `npm run db:admin` | Crea (o reinicia la contraseña de) el usuario `admin` |
| `npm run db:empleado` | Crea un usuario empleado (`scripts/crear-empleado.js`) |
| `npm run db:studio` | Abre Prisma Studio para ver/editar datos |

## Notas

- El límite de intentos de login (5 intentos / 15 min por IP) ahora se guarda **en memoria**
  en lugar de Redis; se reinicia al reiniciar el servidor.
