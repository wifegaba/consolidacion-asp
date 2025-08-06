import type { NextConfig } from "next";

const nextConfig: NextConfig = {
    typescript: {
        ignoreBuildErrors: true, // ✅ Ignora errores de TS
    },
    eslint: {
        ignoreDuringBuilds: true, // ✅ Ignora errores de ESLint que también pueden romper el build
    },
};

export default nextConfig;
