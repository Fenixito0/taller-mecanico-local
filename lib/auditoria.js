import { prisma } from "@/lib/prisma"
import { getServerSession } from "next-auth"
import { authOptions } from "@/app/api/auth/[...nextauth]/route"

/**
 * Registra una acción en la bitácora de auditoría
 * @param {string} accion - Descripción de la acción (ej. "Creó cliente")
 * @param {string} modulo - Módulo donde ocurrió (ej. "clientes")
 */
export async function registrarAuditoria(accion, modulo) {
  try {
    const session = await getServerSession(authOptions)
    await prisma.auditoria.create({
      data: {
        id_usuario: session?.user?.id ? Number(session.user.id) : null,
        username:   session?.user?.username || "desconocido",
        accion,
        modulo,
      },
    })
  } catch {
    // Si falla la auditoría no interrumpimos la operación principal
    console.error("Error al registrar auditoría")
  }
}
