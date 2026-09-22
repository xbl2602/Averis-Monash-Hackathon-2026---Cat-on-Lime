/** @type {import('next').NextConfig} */
const nextConfig = {
  // "standalone" output is small and has dependencies pre-bundled — this is the mode required for Docker deployment (see CLAUDE.md "Deployment requirements")
  output: 'standalone',
  // Only affects local `next dev`: (1) it auto-appends a rule to AGENTS.md on every startup, which breaks
  // the "CLAUDE.md <-> AGENTS.md must match verbatim" sync rule, so it's disabled here; (2) the dev indicator badge defaults to the
  // bottom-left, which covers the Settings button at the bottom of the sidebar, so it's moved to the bottom-right. Production builds/deployment are unaffected.
  agentRules: false,
  devIndicators: { position: 'bottom-right' },
  // pdf-parse / pdfjs-dist must not be bundled into the server bundle by the bundler:
  // at runtime, pdfjs looks up pdf.worker.mjs in the same directory via import.meta.url, and bundling would lose that file,
  // causing server-side PDF parsing to fail (observed error: "Cannot find module .../pdf.worker.mjs").
  // Declaring them as external lets them load normally from node_modules at runtime.
  serverExternalPackages: ['pdf-parse', 'pdfjs-dist'],
  // The routes below read data/sample (sample emails/attachments) via fs at runtime. Vercel by default only bundles
  // statically-analyzed files, so they're explicitly included in the function bundle here (the whole data/sample dir is about 1.2MB) —
  // otherwise, after deployment, tools like classify/extract would report "sample file not found".
  // Also explicitly bring along the externalized PDF-parsing dependencies: pdf-parse depends on pdfjs-dist (which looks up
  // pdf.worker.mjs via import.meta.url at runtime) and @napi-rs/canvas (which provides polyfills like DOMMatrix) —
  // without including them explicitly, standalone/Docker builds throw "DOMMatrix is not defined".
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
    // The export function only uses the sample manifest (inbox filenames) as the completeness denominator and doesn't need the attachment bodies:
    // only bring along the inbox filenames, to avoid pulling parsing dependencies like pdfjs/@napi-rs into the export function bundle
    '/features/results/api/export': ['./data/sample/inbox/**'],
    '/features/jev-lab': ['./data/sample/**'],
  },
};

export default nextConfig;
