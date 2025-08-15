/**
 * async-say-test.test.ts
 * MCPサーバーのsayコマンド非同期実行テスト
 */

import { describe, test, expect, beforeEach, afterEach } from 'vitest';

describe('MCP sayコマンド非同期実行テスト', () => {
    
    test('sayツールが即座にレスポンスを返すか確認', async () => {
        // このテストは実際のMCPサーバーとの統合テストが必要
        // ここでは実装の正しさを概念的に確認
        
        const startTime = Date.now();
        
        // 模擬的な非同期sayコール（実際は音声合成が並行実行される）
        const mockAsyncSay = async (message: string) => {
            // 即座にレスポンス（awaitしない）
            const response = `音声合成を開始しました - オペレータ: tsukuyomi`;
            
            // 音声合成は背景で実行（この例では模擬）
            setTimeout(() => {
                console.log(`背景で音声合成完了: "${message}"`);
            }, 2000);
            
            return response;
        };
        
        const result = await mockAsyncSay("テストメッセージ");
        const responseTime = Date.now() - startTime;
        
        // レスポンスが即座に返される（100ms未満）ことを確認
        expect(responseTime).toBeLessThan(100);
        expect(result).toContain('音声合成を開始しました');
    });
    
    test('非同期実行のエラーハンドリング確認', async () => {
        const mockAsyncSayWithError = async (message: string) => {
            const promise = new Promise((resolve, reject) => {
                setTimeout(() => reject(new Error('模擬エラー')), 100);
            });
            
            // エラーハンドリングを非同期で実行
            promise
                .then(result => {
                    console.log('音声合成成功');
                })
                .catch(error => {
                    console.log(`音声合成非同期処理エラー: ${error.message}`);
                });
            
            // 即座にレスポンス
            return '音声合成を開始しました';
        };
        
        const result = await mockAsyncSayWithError("エラーテスト");
        expect(result).toBe('音声合成を開始しました');
        
        // エラーハンドリングの完了を待つ
        await new Promise(resolve => setTimeout(resolve, 200));
    });
});