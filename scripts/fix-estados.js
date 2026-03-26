const { PrismaClient } = require("@prisma/client")
const prisma = new PrismaClient()

async function main() {
  const result = await prisma.ordenServicio.updateMany({
    where:  { estado: "en_proceso" },
    data:   { estado: "pendiente" },
  })
  console.log(`✅ ${result.count} órdenes actualizadas a pendiente`)
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())