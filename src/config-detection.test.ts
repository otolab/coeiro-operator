/**
 * TypeScript設定検出テスト
 * tsconfig.jsonとts-jestの設定値がどのように読み込まれているかを確認
 */

describe('TypeScript Configuration Detection', () => {
  test('Module resolution and import/export behavior', () => {
    // コンパイル時のモジュール設定を確認
    console.log('=== Module Configuration Detection ===');
    
    // __esModule プロパティの存在確認（CommonJS vs ESModules）
    const hasESModuleMarker = typeof (global as any).__esModule !== 'undefined';
    console.log('__esModule marker present:', hasESModuleMarker);
    
    // import.meta の可用性確認（ESModules特有）
    let importMetaAvailable = false;
    try {
      // import.meta はESModulesでのみ利用可能
      // TypeScriptコンパイルエラーを回避するためにeval使用
      importMetaAvailable = typeof eval('import.meta') === 'object';
    } catch (e) {
      importMetaAvailable = false;
    }
    console.log('import.meta available:', importMetaAvailable);
    
    // exports オブジェクトの確認（CommonJS特有）
    const hasExports = typeof exports !== 'undefined';
    console.log('exports object present:', hasExports);
    
    // module オブジェクトの確認（CommonJS特有）
    const hasModule = typeof module !== 'undefined';
    console.log('module object present:', hasModule);
    
    // require関数の確認（CommonJS特有）
    const hasRequire = typeof require !== 'undefined';
    console.log('require function present:', hasRequire);
    
    console.log('=== Environment Detection ===');
    console.log('Node.js version:', process.version);
    console.log('Jest environment:', process.env.NODE_ENV);
    
    // jest設定の確認
    const jestConfig = (global as any).__jest_config__;
    if (jestConfig) {
      console.log('Jest config available:', !!jestConfig);
    }
    
    console.log('=== Module System Conclusion ===');
    if (importMetaAvailable && !hasExports) {
      console.log('✅ Running in ESModules mode');
    } else if (hasExports && hasModule && !importMetaAvailable) {
      console.log('⚠️  Running in CommonJS mode');
    } else {
      console.log('❓ Mixed or hybrid module system');
    }
    
    // テストとしての確認
    expect(typeof process).toBe('object');
  });

  test('Import behavior detection', async () => {
    console.log('=== Import Behavior Test ===');
    
    // 動的importの動作確認
    try {
      // Node.js組み込みモジュールの動的import
      const pathModule = await import('path');
      console.log('Dynamic import successful:', !!pathModule.join);
      console.log('Dynamic import result type:', typeof pathModule);
      console.log('Has default export:', !!pathModule.default);
      
      // default exportの構造確認
      if (pathModule.default) {
        console.log('Default export type:', typeof pathModule.default);
        console.log('Default export has join:', !!pathModule.default.join);
      }
      
    } catch (error) {
      console.log('Dynamic import failed:', (error as Error).message);
    }
    
    // 通常のrequireの動作確認（利用可能な場合）
    if (typeof require !== 'undefined') {
      try {
        const pathModuleReq = require('path');
        console.log('Require successful:', !!pathModuleReq.join);
        console.log('Require result type:', typeof pathModuleReq);
      } catch (error) {
        console.log('Require failed:', (error as Error).message);
      }
    }
  });
});