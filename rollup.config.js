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
  external: ['electron', 'fs', 'path', 'os', 'child_process'], // Jangan bundle built-in modules
  plugins: [
    resolve(),
    commonjs(),
    typescript({ tsconfig: './tsconfig.json', declaration: true, outDir: `./dist/${distName}` }),
  ],
});

export default [
  createConfig('src/main/index.ts', 'main'),
  createConfig('src/preload/index.ts', 'preload'),
  createConfig('src/renderer/index.ts', 'renderer'),
];