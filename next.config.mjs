/** @type {import('next').NextConfig} */
const nextConfig = {
  // "standalone" 产物体积小、依赖打包好，是 Docker 部署要用的模式（见 CLAUDE.md "部署要求"）
  output: 'standalone',
  // 下面这些路由在运行时用 fs 读 data/sample（样例邮件/附件），Vercel 默认只打包
  // 静态分析到的文件，这里显式把它们包含进函数包（整个 data/sample 约 1.2MB），
  // 否则线上部署后 classify/extract 这类工具会"找不到样例文件"。
  outputFileTracingIncludes: {
    '/core/mcp-server': ['./data/sample/**'],
    '/features/classification/api': ['./data/sample/**'],
    '/features/extraction/api': ['./data/sample/**'],
    '/features/jev-lab': ['./data/sample/**'],
  },
};

export default nextConfig;
