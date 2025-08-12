/**
 * ESM動作確認テスト
 * import.metaやtop-level await等、ESM特有の機能が使用できるかテスト
 */

// ESM専用機能を直接テスト
describe('ESM Specific Features Test', () => {
  test('import.meta object availability', () => {
    console.log('=== import.meta Testing ===');
    
    // import.metaがReferenceErrorを出さずに評価できるかテスト
    try {
      // evalを使わずに直接アクセスして、コンパイル時の動作を確認
      const importMeta = (globalThis as any).import?.meta || null;
      console.log('globalThis.import.meta available:', !!importMeta);
    } catch (error) {
      console.log('globalThis.import.meta access failed:', (error as Error).message);
    }
    
    // Node.js environment用のimport.meta相当確認
    console.log('process.env.NODE_ENV:', process.env.NODE_ENV);
    expect(process.env.NODE_ENV).toBe('test');
  });

  test('ESM import without file extension', async () => {
    console.log('=== ESM Import Extensions ===');
    
    // .js拡張子なしでのimportが可能かテスト（ESMモードの特徴）
    try {
      // Node.js内蔵モジュールで拡張子なしimport
      const { createHash } = await import('crypto');
      console.log('ESM import without extension successful:', typeof createHash === 'function');
    } catch (error) {
      console.log('ESM import failed:', (error as Error).message);
    }
  });

  test('Module type detection via package.json', () => {
    console.log('=== Package Type Detection ===');
    
    // package.jsonの"type": "module"がランタイムで反映されているかチェック
    const processConfig = {
      env_NODE_OPTIONS: process.env.NODE_OPTIONS,
      execPath: process.execPath,
      execArgv: process.execArgv,
    };
    
    console.log('Node.js execution context:');
    Object.entries(processConfig).forEach(([key, value]) => {
      console.log(`  ${key}:`, value);
    });
    
    // --experimental-modules や --input-type=module の有無を確認
    const hasEsmFlags = process.execArgv?.some(arg => 
      arg.includes('experimental-modules') || 
      arg.includes('input-type=module') ||
      arg.includes('loader')
    );
    
    console.log('Has ESM-related flags:', hasEsmFlags);
  });

  test('Dynamic import return type structure', async () => {
    console.log('=== Dynamic Import Structure ===');
    
    try {
      const utilModule = await import('util');
      
      console.log('util module structure:');
      console.log('- typeof module:', typeof utilModule);
      console.log('- has default:', 'default' in utilModule);
      console.log('- has promisify:', 'promisify' in utilModule);
      console.log('- keys length:', Object.keys(utilModule).length);
      
      // ESMでは通常、named exportとdefault exportの関係性が異なる
      if ('default' in utilModule) {
        const isDefaultSameAsModule = utilModule.default === utilModule;
        console.log('- default === module:', isDefaultSameAsModule);
        
        if (!isDefaultSameAsModule) {
          console.log('✅ ESM-style import (default !== module)');
        } else {
          console.log('⚠️ CommonJS-style import (default === module)');
        }
      }
      
    } catch (error) {
      console.log('Dynamic import structure test failed:', (error as Error).message);
    }
  });
});