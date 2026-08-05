/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // The pipeline touches Node-only APIs (Neon driver, RSS fetching); keep it
  // out of the edge runtime unless a route opts in explicitly.
  serverExternalPackages: ["@neondatabase/serverless"],
};

export default nextConfig;
