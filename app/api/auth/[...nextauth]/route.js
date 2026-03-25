import NextAuth from "next-auth"
import CredentialsProvider from "next-auth/providers/credentials"
import { prisma } from "@/lib/prisma"
import { ratelimit } from "@/lib/ratelimit"
import bcrypt from "bcryptjs"
import { headers } from "next/headers"

export const authOptions = {
  providers: [
    CredentialsProvider({
      name: "credentials",
      credentials: {
        username: { label: "Usuario", type: "text" },
        password: { label: "Contraseña", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.username || !credentials?.password) return null

        // Obtener IP del usuario para el rate limiting
        const headersList = await headers()
        const ip =
          headersList.get("x-forwarded-for")?.split(",")[0] ||
          headersList.get("x-real-ip") ||
          "anonymous"

        // Verificar rate limit
        const { success, remaining, reset } = await ratelimit.limit(ip)

        if (!success) {
          const resetDate = new Date(reset)
          const minutos = Math.ceil((resetDate - new Date()) / 1000 / 60)
          throw new Error(`Demasiados intentos. Intenta de nuevo en ${minutos} minuto${minutos !== 1 ? "s" : ""}.`)
        }

        // Buscar usuario en la BD
        const usuario = await prisma.usuario.findUnique({
          where: { username: credentials.username },
        })

        if (!usuario || !usuario.activo) return null

        const passwordOk = await bcrypt.compare(
          credentials.password,
          usuario.password_hash
        )

        if (!passwordOk) return null

        return {
          id:       String(usuario.id_usuario),
          name:     usuario.nombre || usuario.username,
          username: usuario.username,
          rol:      usuario.rol,
        }
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id       = user.id
        token.username = user.username
        token.rol      = user.rol
      }
      return token
    },
    async session({ session, token }) {
      session.user.id       = token.id
      session.user.username = token.username
      session.user.rol      = token.rol
      return session
    },
  },
  pages: {
    signIn: "/login",
  },
  session: {
    strategy: "jwt",
    maxAge:   8 * 60 * 60,
  },
  secret: process.env.NEXTAUTH_SECRET,
}

const handler = NextAuth(authOptions)
export { handler as GET, handler as POST }
