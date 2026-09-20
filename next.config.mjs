/** @type {import('next').NextConfig} */
const nextConfig = {
  // "standalone" 产物体积小、依赖打包好，是 Docker 部署要用的模式（见 CLAUDE.md "部署要求"）
  output: 'standalone',
  // 只影响本地 `next dev`：① 每次启动会自动往 AGENTS.md 追加一段规则，破坏
  // "CLAUDE.md ⇄ AGENTS.md 逐字一致"的同步规则，所以关掉；② 开发角标默认在左下角，
  // 会盖住侧边栏底部的 Settings 按钮，挪到右下角。生产构建/线上不受影响。
  agentRules: false,
  devIndicators: { position: 'bottom-right' },
  // pdf-parse / pdfjs-dist 不能被打包器打进 server bundle：
  // pdfjs 运行时要按 import.meta.url 找同目录的 pdf.worker.mjs，打包后会丢失这个文件，
  // 导致服务端解析 PDF 失败（实测报 "Cannot find module .../pdf.worker.mjs"）。
  // 声明成 external 后运行时可从 node_modules 正常加载。
  serverExternalPackages: ['pdf-parse', 'pdfjs-dist'],
  // 下面这些路由在运行时用 fs 读 data/sample（样例邮件/附件），Vercel 默认只打包
  // 静态分析到的文件，这里显式把它们包含进函数包（整个 data/sample 约 1.2MB），
  // 否则线上部署后 classify/extract 这类工具会"找不到样例文件"。
  // 另外把外部化的 PDF 解析依赖显式带上：pdf-parse 依赖 pdfjs-dist（运行时按
  // import.meta.url 找 pdf.worker.mjs）和 @napi-rs/canvas（提供 DOMMatrix 等 polyfill），
  // 不显式包含的话 standalone/Docker 里会报 DOMMatrix is not defined。
  outputFileTracingIncludes: {
    '/core/mcp-server': [
      './data/sample/**',
      './node_modules/pdf-parse/**',
      './node_modules/pdfjs-dist/**',
      './node_modules/@napi-rs/**',
    ],
    '/features/classification/api': ['./data/sample/**'],
    '/features/extraction/api': [
      './data/sample/**',
      './node_modules/pdf-parse/**',
      './node_modules/pdfjs-dist/**',
      './node_modules/@napi-rs/**',
    ],
    '/features/pipeline/api': [
      './data/sample/**',
      './node_modules/pdf-parse/**',
      './node_modules/pdfjs-dist/**',
      './node_modules/@napi-rs/**',
    ],
    // 导出函数只用样例清单（inbox 文件名）做完整性分母，不需要附件本体：
    // 只带 inbox 文件名，避免把 pdfjs/@napi-rs 等解析依赖打进导出函数包
    '/features/results/api/export': ['./data/sample/inbox/**'],
    '/features/jev-lab': ['./data/sample/**'],
  },
};

export default nextConfig;
