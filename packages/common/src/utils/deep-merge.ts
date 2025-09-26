/**
 * オブジェクトを再帰的にマージするユーティリティ
 *
 * @param target マージ先のオブジェクト
 * @param source マージ元のオブジェクト
 * @returns マージされた新しいオブジェクト
 */
export function deepMerge<T extends Record<string, any>>(
  target: T,
  source: any
): T {
  if (!source) {
    return target;
  }

  const result: any = { ...target };

  for (const key in source) {
    if (source.hasOwnProperty(key)) {
      const sourceValue = source[key];
      const targetValue = target[key];

      if (
        sourceValue !== null &&
        sourceValue !== undefined &&
        typeof sourceValue === 'object' &&
        !Array.isArray(sourceValue) &&
        typeof targetValue === 'object' &&
        !Array.isArray(targetValue)
      ) {
        // 両方がオブジェクトの場合は再帰的にマージ
        result[key] = deepMerge(targetValue, sourceValue);
      } else if (sourceValue !== undefined) {
        // それ以外の場合はsourceの値で上書き
        result[key] = sourceValue;
      }
    }
  }

  return result as T;
}