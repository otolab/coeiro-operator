/**
 * ts-jest設定詳細調査テスト
 * jest.config.mjsで指定している設定値がts-jestにどう渡されているかを確認
 */

describe('ts-jest Configuration Investigation', () => {
  test('Jest and ts-jest configuration inspection', () => {
    console.log('=== Jest Configuration Inspection ===');
    
    // Jest設定の確認
    const jestGlobals = (global as any);
    
    if (jestGlobals.__JEST_ENVIRONMENT__) {
      console.log('Jest environment:', jestGlobals.__JEST_ENVIRONMENT__);
    }
    
    // プロセス環境変数の確認
    console.log('NODE_ENV:', process.env.NODE_ENV);
    console.log('JEST_WORKER_ID:', process.env.JEST_WORKER_ID);
    
    // ts-jest 特有の設定確認
    console.log('=== TypeScript Compiler Options (Runtime) ===');
    
    // コンパイラオプションに関する手がかりを探す
    const tsSymbol = Symbol.for('ts-jest');
    if (jestGlobals[tsSymbol]) {
      console.log('ts-jest symbol found:', !!jestGlobals[tsSymbol]);
    }
    
    // ファイル拡張子とモジュール解決の確認
    console.log('=== Module Resolution Test ===');
    console.log('__filename available:', typeof __filename !== 'undefined');
    console.log('__dirname available:', typeof __dirname !== 'undefined');
    
    if (typeof __filename !== 'undefined') {
      console.log('Current file extension:', __filename.split('.').pop());
    }
    
    // この時点でのProcess設定確認
    console.log('=== Process Module Configuration ===');
    console.log('process.platform:', process.platform);
    console.log('process.arch:', process.arch);
    
    // ESM関連の実行時フラグ確認
    const features = {
      dynamicImport: 'Dynamic import' in globalThis,
      topLevelAwait: false, // これは構文的な特徴なので実行時に確認困難
      privateFields: (() => {
        try {
          class Test { #private = true; }
          return true;
        } catch {
          return false;
        }
      })(),
    };
    
    console.log('=== Modern JS Features ===');
    Object.entries(features).forEach(([feature, available]) => {
      console.log(`${feature}:`, available);
    });
    
    expect(true).toBe(true); // テストとしての確認
  });

  test('Module extension and transform detection', () => {
    console.log('=== File Extension and Transform ===');
    
    // 現在のファイルがどのように処理されているかを確認
    const stack = new Error().stack;
    if (stack) {
      const lines = stack.split('\n');
      const relevantLine = lines.find(line => line.includes('ts-jest-config.test'));
      if (relevantLine) {
        console.log('Stack trace file reference:', relevantLine.trim());
      }
    }
    
    // require.resolve で .js ファイルの解決確認
    try {
      const resolved = require.resolve('./ts-jest-config.test');
      console.log('require.resolve result:', resolved);
      console.log('Resolved file extension:', resolved.split('.').pop());
    } catch (error) {
      console.log('require.resolve failed:', (error as Error).message);
    }
    
    // キャッシュされたモジュールの確認
    const cache = require.cache;
    const currentFile = Object.keys(cache).find(key => key.includes('ts-jest-config.test'));
    if (currentFile) {
      console.log('Module cache entry:', currentFile);
      console.log('Cache entry extension:', currentFile.split('.').pop());
    }
  });

  test('Import syntax compatibility test', async () => {
    console.log('=== Import Syntax Compatibility ===');
    
    // named importの動作確認
    try {
      const { join, resolve } = await import('path');
      console.log('Named import successful:', !!join && !!resolve);
      console.log('Named import types:', typeof join, typeof resolve);
    } catch (error) {
      console.log('Named import failed:', (error as Error).message);
    }
    
    // default import + named import混在の確認
    try {
      const pathModule = await import('path');
      const { join } = pathModule;
      console.log('Mixed import successful:', !!join && !!pathModule.default);
      
      // default exportとnamed exportの関係性確認
      if (pathModule.default) {
        console.log('default === named:', pathModule.default === pathModule);
        console.log('default.join === join:', pathModule.default.join === join);
      }
    } catch (error) {
      console.log('Mixed import failed:', (error as Error).message);
    }
  });
});