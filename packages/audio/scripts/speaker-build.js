#!/usr/bin/env node

/**
 * Speaker module build script
 * CI環境では音声デバイスがないため、ビルドをスキップする
 * 本番環境では実行時にフォールバックされるので問題なし
 */

const { execSync } = require('child_process');
const path = require('path');

// CI環境チェック
const isCI = process.env.CI === 'true';
const isTest = process.env.NODE_ENV === 'test';

if (isCI || isTest) {
  console.log('⚠️  Skipping speaker native module build in CI/test environment');
  console.log('   The module will use fallback at runtime');
  process.exit(0);
}

// 本番環境ではspeakerをビルド
try {
  console.log('🔨 Building speaker native module...');

  const speakerPath = path.join(__dirname, '..', 'node_modules', 'speaker');

  // node-gypでビルド
  execSync('npm run install', {
    cwd: speakerPath,
    stdio: 'inherit'
  });

  console.log('✅ Speaker module built successfully');
} catch (error) {
  console.warn('⚠️  Speaker build failed, will use fallback at runtime');
  console.warn('   Error:', error.message);
  // ビルド失敗してもインストールは成功扱い（実行時フォールバック）
  process.exit(0);
}