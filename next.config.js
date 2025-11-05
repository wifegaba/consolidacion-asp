/** @type {import('next').NextConfig} */
const nextConfig = {
  // ...otras configuraciones que puedas tener...

  devIndicators: {
    // Añade aquí la URL base desde la que accedes
    // (asegúrate de incluir http:// y el puerto si es necesario)
    allowedDevOrigins: [
      'http://localhost:3000', 
      'http://100.115.67.13:3000' // Ajusta el puerto (ej. :3000) si es el que usas
    ],
  },
};

module.exports = nextConfig;





