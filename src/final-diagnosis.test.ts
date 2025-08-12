/**
 * 最終診断テスト
 * tsconfig.jsonのmodule設定がts-jest実行時に効いていない問題の総合確認
 */

describe('Final Diagnosis: tsconfig module setting vs ts-jest runtime', () => {
  test('Summary of configuration mismatch', () => {
    console.log('=== FINAL DIAGNOSIS ===');
    console.log('');
    
    console.log('📋 Configuration Files:');
    console.log('- tsconfig.json: module: "esnext"');
    console.log('- package.json: "type": "module"');
    console.log('- jest.config.mjs: preset: "ts-jest/presets/default-esm"');
    console.log('');
    
    console.log('🔍 Runtime Detection Results:');
    
    // 実際の環境確認
    const runtimeEnvironment = {
      hasCommonJSObjects: typeof exports !== 'undefined' && typeof module !== 'undefined',
      hasRequire: typeof require !== 'undefined',
      importMetaAvailable: false,
      dynamicImportWorks: true,
    };
    
    try {
      runtimeEnvironment.importMetaAvailable = typeof eval('import.meta') === 'object';
    } catch (e) {
      runtimeEnvironment.importMetaAvailable = false;
    }
    
    Object.entries(runtimeEnvironment).forEach(([key, value]) => {
      const status = value ? '✅' : '❌';
      console.log(`- ${key}: ${status} ${value}`);
    });
    
    console.log('');
    console.log('🎯 Conclusion:');
    if (runtimeEnvironment.hasCommonJSObjects && !runtimeEnvironment.importMetaAvailable) {
      console.log('❌ ISSUE CONFIRMED: ts-jest is NOT respecting tsconfig.json module setting');
      console.log('   Despite module: "esnext" in tsconfig.json, running in CommonJS mode');
    } else {
      console.log('✅ ts-jest is correctly using ESM mode');
    }
    
    console.log('');
    console.log('💡 Recommendations:');
    console.log('1. Consider using different jest presets or configuration');
    console.log('2. Check ts-jest version compatibility with Jest version');
    console.log('3. Investigate Node.js execution context for Jest');
    console.log('4. Evaluate if the current setup requires CommonJS compatibility');
    
    // テストとしての確認
    expect(typeof process).toBe('object');
  });

  test('Import/export behavior comparison', async () => {
    console.log('=== IMPORT/EXPORT BEHAVIOR ANALYSIS ===');
    
    // 異なるimport方法での動作比較
    const testResults = {
      namedImport: null as any,
      dynamicImport: null as any,
      requireImport: null as any,
    };
    
    try {
      // 1. Named import (静的)
      // (これは既にファイル先頭で評価されている)
      testResults.namedImport = 'already evaluated';
    } catch (e) {
      testResults.namedImport = (e as Error).message;
    }
    
    try {
      // 2. Dynamic import
      const pathModule = await import('path');
      testResults.dynamicImport = {
        hasDefault: !!pathModule.default,
        hasJoin: !!pathModule.join,
        defaultEqualsModule: pathModule.default === pathModule,
        keysCount: Object.keys(pathModule).length
      };
    } catch (e) {
      testResults.dynamicImport = (e as Error).message;
    }
    
    try {
      // 3. require (CommonJS)
      if (typeof require !== 'undefined') {
        const pathModuleReq = require('path');
        testResults.requireImport = {
          hasJoin: !!pathModuleReq.join,
          type: typeof pathModuleReq,
          keysCount: Object.keys(pathModuleReq).length
        };
      }
    } catch (e) {
      testResults.requireImport = (e as Error).message;
    }
    
    console.log('Import method comparison:');
    Object.entries(testResults).forEach(([method, result]) => {
      console.log(`${method}:`, JSON.stringify(result, null, 2));
    });
    
    console.log('');
    console.log('Analysis:');
    if (testResults.dynamicImport?.defaultEqualsModule === false) {
      console.log('✅ Dynamic import shows ESM characteristics (default !== module)');
    }
    if (testResults.requireImport && typeof testResults.requireImport === 'object') {
      console.log('⚠️  require() still available (CommonJS compatibility)');
    }
  });
});