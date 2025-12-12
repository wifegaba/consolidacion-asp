// next.config.js
/** @type {import('next').NextConfig} */
const nextConfig = {
    typescript: {
        ignoreBuildErrors: true,      // si quieres compilar aunque haya errores TS
    },
    eslint: {
        ignoreDuringBuilds: true,     // evita fallar el build por ESLint
    },
};

export default nextConfig;
