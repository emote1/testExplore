import type { CodegenConfig } from '@graphql-codegen/cli';

const config: CodegenConfig = {
  overwrite: true,
  schema: 'https://squid.subsquid.io/reef-explorer/graphql',
  documents: ['src/**/*.{ts,tsx}', '!src/gql/**/*'],
  generates: {
    'src/gql/': {
      preset: 'client',
      presetConfig: {
        gqlTagName: 'graphql',
      },
      config: {
        enumsAsTypes: true,
        useTypeImports: true,
      },
    },
  },
  ignoreNoDocuments: true,
};

export default config;
