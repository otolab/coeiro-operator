/**
 * Vitest 4.0 グローバルセットアップ
 */

import { beforeEach } from 'vitest';
import { resetSpeakerProvider } from './packages/core/src/environment/speaker-provider.js';

// Vitest 4では各ワーカーがモジュールを分離するため、
// 明示的なvi.resetModules()は不要

// グローバルシングルトンのクリーンアップ
// IMPORTANT: beforeEachの最初で実行して、各テストが新しいインスタンスを取得できるようにする
beforeEach(() => {
  resetSpeakerProvider();
});
