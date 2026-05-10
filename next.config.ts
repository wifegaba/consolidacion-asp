// next.config.js
/** @type {import('next').NextConfig} */
const nextConfig = {
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
