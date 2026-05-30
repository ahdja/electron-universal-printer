import resolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import typescript from '@rollup/plugin-typescript';

const createConfig = (input, distName) => ({
  input: input,
  output: [
    {
      file: `dist/${distName}/index.js`,
      format: 'cjs',
      sourcemap: true,
    },
    {
      file: `dist/${distName}/index.esm.js`,
      format: 'esm',
      sourcemap: true,
    },
  ],
  external: ['electron', 'fs', 'path', 'os', 'child_process', 'crypto'], // Jangan bundle built-in modules
  plugins: [
    resolve(),
    commonjs(),
    typescript({
      tsconfig: './tsconfig.json',
      // Emit ES modules so Rollup can inline local imports into a single bundle.
      // (NodeNext from tsconfig would emit bare require("./core") that Rollup
      //  leaves unbundled, breaking the published file at runtime.)
      // Declarations are produced separately via `npm run build:types`.
      compilerOptions: {
        module: 'ESNext',
        moduleResolution: 'Bundler',
        declaration: false,
        declarationMap: false,
      },
    }),
  ],
});

export default [
  createConfig('src/main/index.ts', 'main'),
  createConfig('src/preload/index.ts', 'preload'),
  createConfig('src/renderer/index.ts', 'renderer'),
];
