/**
 * 実際のTypeScript Compiler設定確認テスト
 * ts-jestが使用している実際のコンパイラオプションを確認
 */

// TypeScript Compiler APIを使用して実際の設定を確認
import * as ts from 'typescript';
import * as path from 'path';

describe('Actual TypeScript Configuration Used by ts-jest', () => {
  test('TypeScript compiler options detection', () => {
    console.log('=== TypeScript Compiler API Investigation ===');
    
    // プロジェクトのtsconfig.jsonを読み込み
    const configPath = path.resolve(process.cwd(), 'tsconfig.json');
    console.log('Looking for tsconfig at:', configPath);
    
    try {
      const configFile = ts.readConfigFile(configPath, ts.sys.readFile);
      if (configFile.error) {
        console.log('Config file error:', configFile.error.messageText);
      } else {
        console.log('Config file loaded successfully');
        
        const parsedConfig = ts.parseJsonConfigFileContent(
          configFile.config,
          ts.sys,
          path.dirname(configPath)
        );
        
        if (parsedConfig.errors.length > 0) {
          console.log('Config parse errors:', parsedConfig.errors.map(e => e.messageText));
        }
        
        const options = parsedConfig.options;
        console.log('=== Parsed TypeScript Compiler Options ===');
        console.log('target:', ts.ScriptTarget[options.target || 0]);
        console.log('module:', ts.ModuleKind[options.module || 0]);
        console.log('moduleResolution:', ts.ModuleResolutionKind[options.moduleResolution || 0]);
        console.log('esModuleInterop:', options.esModuleInterop);
        console.log('allowSyntheticDefaultImports:', options.allowSyntheticDefaultImports);
        console.log('strict:', options.strict);
      }
    } catch (error) {
      console.log('Failed to read tsconfig:', (error as Error).message);
    }
  });

  test('Runtime compilation check', () => {
    console.log('=== Runtime Compilation Environment ===');
    
    // TypeScript compiler情報
    console.log('TypeScript version:', ts.version);
    
    // 現在のスクリプトがどのように処理されているかの確認
    const moduleInfo = {
      nodeModulesResolution: typeof require.resolve === 'function',
      extensionsToTreatAsEsm: process.env.NODE_OPTIONS?.includes('--experimental-loader'),
      jestTransform: process.env.NODE_ENV === 'test',
    };
    
    console.log('=== Module Processing Environment ===');
    Object.entries(moduleInfo).forEach(([key, value]) => {
      console.log(`${key}:`, value);
    });
    
    // Jest transform設定の痕跡を探す
    const transformerTraces = {
      hasJestGlobals: typeof jest !== 'undefined',
      hasJestConfig: typeof (global as any).__JEST_CONFIG__ !== 'undefined',
      hasTsJestGlobals: typeof (global as any).__TS_CONFIG__ !== 'undefined',
    };
    
    console.log('=== Jest/ts-jest Detection ===');
    Object.entries(transformerTraces).forEach(([key, value]) => {
      console.log(`${key}:`, value);
    });
  });

  test('Module format verification with actual import', async () => {
    console.log('=== Module Format Verification ===');
    
    // 実際のモジュールImportで形式を確認
    try {
      const fsModule = await import('fs');
      console.log('fs module structure:');
      console.log('- has default:', !!fsModule.default);
      console.log('- has readFileSync:', !!fsModule.readFileSync);
      console.log('- default === module:', fsModule.default === fsModule);
      
      if (fsModule.default) {
        console.log('- default.readFileSync === readFileSync:', 
          fsModule.default.readFileSync === fsModule.readFileSync);
      }
      
      // fs/promises の確認（ESM特有の構造）
      const fsPromises = await import('fs/promises');
      console.log('fs/promises module structure:');
      console.log('- has default:', !!fsPromises.default);
      console.log('- has readFile:', !!fsPromises.readFile);
      
    } catch (error) {
      console.log('Module import verification failed:', (error as Error).message);
    }
  });

  test('Check for .js extension rewriting', () => {
    console.log('=== Extension Rewriting Check ===');
    
    // Jest設定のmoduleNameMapperの動作確認
    try {
      // 相対importで.js拡張子を使った場合の動作確認
      console.log('Testing .js extension mapping...');
      
      // 実際には存在しない.jsファイルをrequire.resolveで確認
      // これによりmoduleNameMapperが動作しているかわかる
      try {
        const resolved = require.resolve('./non-existent-file.js');
        console.log('Unexpected resolve success:', resolved);
      } catch (error) {
        console.log('Expected resolve failure (no mapping):', (error as Error).message.includes('Cannot find module'));
      }
      
    } catch (error) {
      console.log('Extension rewriting check failed:', (error as Error).message);
    }
  });
});