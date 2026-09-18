/** @type {import('next').NextConfig} */
const nextConfig = {
  // "standalone" 产物体积小、依赖打包好，是 Docker 部署要用的模式（见 CLAUDE.md "部署要求"）
  output: 'standalone',
};

export default nextConfig;
