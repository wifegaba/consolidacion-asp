// next.config.js
import path from 'node:path'

/** @type {import('next').NextConfig} */
const nextConfig = {
    transpilePackages: ['@kids/liquid-glass-ui'],
    turbopack: {
        // La librería local vive como proyecto hermano de Consolidacion-asp.
        root: path.resolve(process.cwd(), '..'),
    },
    typescript: {
        ignoreBuildErrors: true,
    },
    experimental: {
        serverActions: {
            bodySizeLimit: '4mb',   // permite fotos comprimidas sin cortar el request
        },
    },
};

export default nextConfig;
