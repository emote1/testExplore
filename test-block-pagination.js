#!/usr/bin/env node

// Simple script to run only block pagination tests
const { execSync } = require('child_process');

console.log('🧪 Running Block Pagination Tests...\n');

try {
  // Run specific test files
  const testFiles = [
    'src/utils/block-pagination.test.ts',
    'src/hooks/use-transaction-data-with-blocks.test.ts'
  ];
  
  console.log('Running tests for:');
  testFiles.forEach(file => console.log(`  - ${file}`));
  console.log('');
  
  // Run the tests
  execSync(`npx vitest run ${testFiles.join(' ')}`, { 
    stdio: 'inherit',
    cwd: process.cwd()
  });
  
  console.log('\n✅ All block pagination tests passed!');
  
} catch (error) {
  console.error('\n❌ Some tests failed');
  console.error(error.message);
  process.exit(1);
}
