// Script para crear el primer usuario administrador
// Ejecutar con: node scripts/crear-admin.js

const { PrismaClient } = require("@prisma/client")
const bcrypt = require("bcryptjs")

const prisma = new PrismaClient()

async function main() {
  const username = "empleado1"
const password = "Empl3ado#2026!"
const nombre   = "Nombre Empleado"

  const hash = await bcrypt.hash(password, 12)

  const usuario = await prisma.usuario.upsert({
    where:  { username },
    update: {},
    create: {
      username,
      password_hash: hash,
      nombre,
      rol:    "empleado",
      activo: true,
    },
  })

  console.log("✅ Usuario creado:", usuario.username)
  console.log("🔑 Contraseña:    ", password)
  console.log("👤 Rol:           ", usuario.rol)
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())