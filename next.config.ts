/** @type {import('next').NextConfig} */
const nextConfig = {
    transpilePackages: ['@kids/liquid-glass-ui'],
    typescript: {
        ignoreBuildErrors: true,
    },
    experimental: {
        serverActions: {
            bodySizeLimit: '4mb', // permite fotos comprimidas sin cortar el request
        },
    },
};

export default nextConfig;
