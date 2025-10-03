#!/usr/bin/env node

/**
 * Changesetを作成するヘルパースクリプト
 *
 * 使用例:
 * node scripts/create-changeset.js \
 *   --packages @coeiro-operator/audio:minor,@coeiro-operator/cli:patch \
 *   --message "Add voice speed control feature"
 */

import { writeFileSync } from 'fs';
import { randomBytes } from 'crypto';
import { join } from 'path';
import { parseArgs } from 'util';

const { values } = parseArgs({
  options: {
    packages: {
      type: 'string',
      short: 'p',
    },
    message: {
      type: 'string',
      short: 'm',
    },
  },
});

if (!values.packages || !values.message) {
  console.error('Usage: create-changeset.js --packages <pkg:version,...> --message <message>');
  console.error('Example: --packages @coeiro-operator/audio:minor,@coeiro-operator/cli:patch');
  process.exit(1);
}

// パッケージとバージョンをパース
const packages = values.packages.split(',').map(p => {
  const [pkg, version] = p.trim().split(':');
  return { pkg, version };
});

// ランダムなファイル名を生成
const id = randomBytes(3).toString('hex');
const filename = `changeset-${id}.md`;

// Changesetファイルの内容を生成
let content = '---\n';
packages.forEach(({ pkg, version }) => {
  content += `"${pkg}": ${version}\n`;
});
content += '---\n\n';
content += values.message;

// ファイルを書き込み
const filepath = join(process.cwd(), '.changeset', filename);
writeFileSync(filepath, content);

console.log(`✅ Created changeset: .changeset/${filename}`);
console.log('\nContent:');
console.log(content);