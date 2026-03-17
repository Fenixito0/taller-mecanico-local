import { getServerSession } from "next-auth"
import { authOptions } from "@/app/api/auth/[...nextauth]/route"
import { NextResponse } from "next/server"

/**
 * Verifica que la petición tiene una sesión válida.
 * Uso: const check = await requireAuth(); if (check) return check;
 */
export async function requireAuth() {
  const session = await getServerSession(authOptions)
  if (!session) {
    return NextResponse.json(
      { error: "No autorizado. Inicia sesión para continuar." },
      { status: 401 }
    )
  }
  return null
}
