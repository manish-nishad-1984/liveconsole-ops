import { defineConfig } from 'tsup';

/**
 * Production runs under IIS + iisnode on Windows shared hosting, where the app is
 * uploaded over FTP. So the API is bundled into a single CommonJS file that
 * iisnode can `require` directly, with every dependency inlined — the only thing
 * left in `node_modules` on the server is Prisma, whose query engine is a native
 * binary that cannot be bundled.
 */
export default defineConfig({
  entry: ['src/server.ts'],
  outDir: 'dist',
  format: ['cjs'],
  target: 'node20',
  platform: 'node',
  sourcemap: true,
  clean: true,
  splitting: false,
  dts: false,
  noExternal: [/^(?!@prisma\/client$|\.prisma).*/],
  external: ['@prisma/client', 'pino-pretty'],
});
