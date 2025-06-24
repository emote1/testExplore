
import type { CodegenConfig } from '@graphql-codegen/cli';

const config: CodegenConfig = {
  overwrite: true,
  schema: 'https://squid.subsquid.io/reef-explorer/graphql',
    documents: ['src/**/*.ts', '!src/types/graphql-generated.ts'],
  generates: {
    'src/types/graphql-generated.ts': {
      plugins: [
        'typescript',
        'typescript-operations',
        'typescript-react-apollo'
      ],
      config: {
        withHooks: true,
        withComponent: false,
        withHOC: false,
        enumsAsTypes: true,
      },
    },
  },
};

export default config;
