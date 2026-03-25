// Script para crear el primer usuario administrador
// Ejecutar con: node scripts/crear-admin.js

const { PrismaClient } = require("@prisma/client")
const bcrypt = require("bcryptjs")

const prisma = new PrismaClient()

async function main() {
  const username = "admin"
  const password = "T4ll3r#M3c@n1co2026!"       // Cambia esto antes de ejecutar
  const nombre   = "Administrador"

  const hash = await bcrypt.hash(password, 12)

const usuario = await prisma.usuario.upsert({
  where:  { username },
  update: { password_hash: hash },
  create: {
    username,
    password_hash: hash,
    nombre,
    rol:    "admin",
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
