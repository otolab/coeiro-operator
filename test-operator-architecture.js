#!/usr/bin/env node

/**
 * test-operator-architecture.js: 新しいキャラクター:スタイル構造のテストファイル
 */

import { OperatorManager } from './src/operator/index.js';
import { readFile } from 'fs/promises';

class OperatorArchitectureTest {
  constructor() {
    this.manager = new OperatorManager();
    this.testResults = [];
  }

  async initialize() {
    await this.manager.initialize();
    console.log('🚀 テスト開始: 新しいキャラクター:スタイル構造');
  }

  log(message, data = null) {
    console.log(message);
    if (data) {
      console.log('  ', JSON.stringify(data, null, 2));
    }
  }

  logError(message, error) {
    console.error(`❌ ${message}:`, error.message);
    this.testResults.push({ test: message, result: 'FAIL', error: error.message });
  }

  logSuccess(message, data = null) {
    console.log(`✅ ${message}`);
    this.testResults.push({ test: message, result: 'PASS', data });
  }

  // テスト1: 設定ファイル構造の確認
  async testConfigStructure() {
    try {
      const configPath = this.manager.operatorConfigFile;
      const config = JSON.parse(await readFile(configPath, 'utf8'));
      
      // 必須セクションの確認
      if (!config.characters) throw new Error('charactersセクションが存在しません');
      if (!config.operators) throw new Error('operatorsセクションが存在しません');
      
      const characterCount = Object.keys(config.characters).length;
      const operatorCount = Object.keys(config.operators).length;
      
      this.logSuccess('設定ファイル構造確認', {
        characters: characterCount,
        operators: operatorCount
      });
      
      // 各キャラクターの構造確認
      for (const [charId, char] of Object.entries(config.characters)) {
        if (!char.available_styles) throw new Error(`${charId}: available_stylesが存在しません`);
        if (!char.default_style) throw new Error(`${charId}: default_styleが存在しません`);
        if (!char.style_selection) throw new Error(`${charId}: style_selectionが存在しません`);
        
        const styleCount = Object.keys(char.available_styles).length;
        this.log(`  ${charId}: ${styleCount}スタイル, 選択方法: ${char.style_selection}`);
      }
      
    } catch (error) {
      this.logError('設定ファイル構造確認', error);
    }
  }

  // テスト2: スタイル選択ロジックの確認
  async testStyleSelection() {
    try {
      const config = JSON.parse(await readFile(this.manager.operatorConfigFile, 'utf8'));
      
      // アルマちゃんのスタイル選択テスト（random）
      const almaChar = config.characters.alma;
      const almaResults = {};
      
      console.log('\n=== アルマちゃんスタイル選択テスト（50回実行） ===');
      for (let i = 0; i < 50; i++) {
        const style = this.manager.selectStyle(almaChar);
        almaResults[style.name] = (almaResults[style.name] || 0) + 1;
      }
      
      this.logSuccess('アルマちゃんスタイル分布', almaResults);
      
      // MANAのスタイル選択テスト（random）
      const manaChar = config.characters.mana;
      const manaResults = {};
      
      console.log('\n=== MANAスタイル選択テスト（50回実行） ===');
      for (let i = 0; i < 50; i++) {
        const style = this.manager.selectStyle(manaChar);
        manaResults[style.name] = (manaResults[style.name] || 0) + 1;
      }
      
      this.logSuccess('MANAスタイル分布', manaResults);
      
      // つくよみちゃんのスタイル選択テスト（default固定）
      const tsukuyomiChar = config.characters.tsukuyomi;
      const tsukuyomiResults = {};
      
      console.log('\n=== つくよみちゃんスタイル選択テスト（10回実行） ===');
      for (let i = 0; i < 10; i++) {
        const style = this.manager.selectStyle(tsukuyomiChar);
        tsukuyomiResults[style.name] = (tsukuyomiResults[style.name] || 0) + 1;
      }
      
      this.logSuccess('つくよみちゃんスタイル分布', tsukuyomiResults);
      
    } catch (error) {
      this.logError('スタイル選択ロジック確認', error);
    }
  }

  // テスト3: オペレータアサインメントテスト
  async testOperatorAssignment() {
    try {
      console.log('\n=== オペレータアサインメントテスト ===');
      
      // 各キャラクターのアサインテスト
      const testCharacters = ['tsukuyomi', 'alma', 'mana', 'angie'];
      
      for (const charId of testCharacters) {
        const assigned = await this.manager.assignSpecificOperator(charId);
        
        this.log(`${charId} アサイン結果:`, {
          character: assigned.characterName,
          style: assigned.currentStyle.styleName,
          personality: assigned.currentStyle.personality,
          voiceConfig: assigned.voiceConfig
        });
        
        await this.manager.releaseOperator();
      }
      
      this.logSuccess('オペレータアサインメントテスト完了');
      
    } catch (error) {
      this.logError('オペレータアサインメントテスト', error);
    }
  }

  // テスト4: エラーハンドリングテスト
  async testErrorHandling() {
    try {
      console.log('\n=== エラーハンドリングテスト ===');
      
      // 存在しないキャラクターのテスト
      try {
        await this.manager.assignSpecificOperator('nonexistent');
        this.logError('存在しないキャラクターテスト', new Error('エラーが発生しませんでした'));
      } catch (error) {
        this.logSuccess('存在しないキャラクターエラー正常検出', { error: error.message });
      }
      
      // スタイルが無効化されたキャラクターのテスト
      const testChar = {
        name: 'テストキャラ',
        available_styles: {
          'disabled': { enabled: false }
        },
        style_selection: 'default'
      };
      
      try {
        this.manager.selectStyle(testChar);
        this.logError('無効スタイルテスト', new Error('エラーが発生しませんでした'));
      } catch (error) {
        this.logSuccess('無効スタイルエラー正常検出', { error: error.message });
      }
      
    } catch (error) {
      this.logError('エラーハンドリングテスト', error);
    }
  }

  // テスト5: MCP情報提供テスト
  async testMCPInformation() {
    try {
      console.log('\n=== MCP情報提供テスト ===');
      
      const assigned = await this.manager.assignSpecificOperator('alma');
      
      // MCPで期待される情報が含まれているかチェック
      const expectedFields = ['operatorId', 'characterName', 'currentStyle', 'voiceConfig', 'greeting'];
      const missingFields = expectedFields.filter(field => !assigned.hasOwnProperty(field));
      
      if (missingFields.length > 0) {
        throw new Error(`不足している情報: ${missingFields.join(', ')}`);
      }
      
      // スタイル詳細情報の確認
      const styleFields = ['styleId', 'styleName', 'personality', 'speakingStyle'];
      const missingStyleFields = styleFields.filter(field => !assigned.currentStyle.hasOwnProperty(field));
      
      if (missingStyleFields.length > 0) {
        throw new Error(`不足しているスタイル情報: ${missingStyleFields.join(', ')}`);
      }
      
      this.logSuccess('MCP情報提供テスト', {
        提供情報: Object.keys(assigned),
        スタイル情報: Object.keys(assigned.currentStyle)
      });
      
      await this.manager.releaseOperator();
      
    } catch (error) {
      this.logError('MCP情報提供テスト', error);
    }
  }

  // 全テスト実行
  async runAllTests() {
    await this.initialize();
    
    await this.testConfigStructure();
    await this.testStyleSelection();
    await this.testOperatorAssignment();
    await this.testErrorHandling();
    await this.testMCPInformation();
    
    // 結果サマリー
    console.log('\n=== テスト結果サマリー ===');
    const passed = this.testResults.filter(r => r.result === 'PASS').length;
    const failed = this.testResults.filter(r => r.result === 'FAIL').length;
    
    console.log(`✅ 成功: ${passed}`);
    console.log(`❌ 失敗: ${failed}`);
    
    if (failed > 0) {
      console.log('\n失敗したテスト:');
      this.testResults.filter(r => r.result === 'FAIL').forEach(r => {
        console.log(`  - ${r.test}: ${r.error}`);
      });
    }
    
    return failed === 0;
  }
}

// テスト実行
const test = new OperatorArchitectureTest();
test.runAllTests().then(success => {
  process.exit(success ? 0 : 1);
}).catch(error => {
  console.error('テスト実行エラー:', error);
  process.exit(1);
});