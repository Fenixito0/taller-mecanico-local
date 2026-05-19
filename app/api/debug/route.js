import { prisma } from "@/lib/prisma"
import { NextResponse } from "next/server"
import bcrypt from "bcryptjs"

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

export async function POST(req) {
  const steps = { step1_parse: false, step2_findUser: false, step3_userActive: false, step4_hashExists: false, step5_bcrypt: false }
  try {
    const { username, password } = await req.json()
    steps.step1_parse = true
    steps.username = username

    const usuario = await prisma.usuario.findUnique({ where: { username } })
    steps.step2_findUser = !!usuario
    if (!usuario) return NextResponse.json({ ...steps, error: "Usuario no encontrado en BD" })

    steps.step3_userActive = usuario.activo
    if (!usuario.activo) return NextResponse.json({ ...steps, error: "Usuario inactivo" })

    steps.step4_hashExists = !!usuario.password_hash
    steps.hashPrefix = usuario.password_hash?.substring(0, 7)
    steps.hashLength = usuario.password_hash?.length

    const passwordOk = await bcrypt.compare(password, usuario.password_hash)
    steps.step5_bcrypt = passwordOk

    if (!passwordOk) return NextResponse.json({ ...steps, error: "Contraseña no coincide con el hash" })

    return NextResponse.json({ ...steps, success: true })
  } catch (err) {
    return NextResponse.json({ ...steps, error: err.message }, { status: 500 })
  }
}
