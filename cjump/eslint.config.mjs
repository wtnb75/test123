import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import createConfig from '../scaffold/eslint.base.mjs';

export default createConfig({ js, tseslint });
