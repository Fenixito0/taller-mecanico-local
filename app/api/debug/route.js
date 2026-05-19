import { prisma } from "@/lib/prisma"
import { NextResponse } from "next/server"

export async function GET() {
  const checks = { db: false, users: 0, env: {} }
  try {
    checks.env = {
      DATABASE_URL: process.env.DATABASE_URL ? "set (" + process.env.DATABASE_URL.split("@")[1]?.split("/")[0] + ")" : "MISSING",
      DIRECT_URL: process.env.DIRECT_URL ? "set" : "MISSING",
      NEXTAUTH_SECRET: process.env.NEXTAUTH_SECRET ? "set" : "MISSING",
      NEXTAUTH_URL: process.env.NEXTAUTH_URL || "MISSING",
    }
    const usuarios = await prisma.usuario.findMany({ select: { username: true, activo: true } })
    checks.db = true
    checks.users = usuarios.length
    checks.usernames = usuarios.map(u => u.username)
    return NextResponse.json(checks)
  } catch (err) {
    checks.error = err.message
    return NextResponse.json(checks, { status: 500 })
  }
}
