/** @type {import('next').NextConfig} */
const isExport = process.env.PDT_STATIC_EXPORT === "1";
const nextConfig = {
  reactStrictMode: true,
  ...(isExport ? { output: "export", trailingSlash: true, images: { unoptimized: true } } : {}),
  poweredByHeader: false,
};
export default nextConfig;
