/** @type {import('next').NextConfig} */
const nextConfig = {
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          // Evita que el sitio sea embebido en un iframe (clickjacking)
          {
            key: "X-Frame-Options",
            value: "DENY",
          },
          // Evita que el navegador adivine el tipo de contenido
          {
            key: "X-Content-Type-Options",
            value: "nosniff",
          },
          // Fuerza HTTPS en producción
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains; preload",
          },
          // Controla qué información se envía en el header Referer
          {
            key: "Referrer-Policy",
            value: "strict-origin-when-cross-origin",
          },
          // Restringe acceso a funciones del navegador
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
          // Protección básica contra XSS en navegadores antiguos
          {
            key: "X-XSS-Protection",
            value: "1; mode=block",
          },
        ],
      },
    ]
  },
}

export default nextConfig
