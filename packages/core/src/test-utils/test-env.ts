/**
 * テスト環境用の共通環境変数設定
 */

export const getTestEnvironment = () => {
  return {
    ...process.env,
    NODE_ENV: 'test',
    CI: 'true',
    // デバッグログを有効化（必要に応じて）
    COEIRO_LOG_LEVEL: process.env.COEIRO_LOG_LEVEL || 'info',
  };
};