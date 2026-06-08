// PWA deshabilitado temporalmente para desarrollo
// const withPWA = require('next-pwa')({...});

const withPWA = (config) => config; // bypass

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  output: 'standalone',
  images: {
    unoptimized: true
  },
  env: {
    API_URL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api'
  }
};

module.exports = withPWA(nextConfig);
