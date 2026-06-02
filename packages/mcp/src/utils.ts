/**
 * MCP Server共通ユーティリティ関数
 */

import type { Character, OperatorManager, CharacterInfoService } from '@coeiro-operator/core';
import type { StyleInfo, AssignResult } from './types.js';

/**
 * オペレータ入力のバリデーション
 */
export function validateOperatorInput(operator?: string): void {
  if (operator !== undefined && operator !== '' && operator !== null) {
    if (/[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]/.test(operator)) {
      throw new Error(
        'オペレータ名は英語表記で指定してください（例: tsukuyomi, alma）。日本語は使用できません。'
      );
    }
  }
}

/**
 * オペレータのアサイン
 */
export async function assignOperator(
  manager: OperatorManager,
  operator?: string,
  style?: string
): Promise<AssignResult> {
  if (operator && operator !== '' && operator !== null) {
    return await manager.assignSpecificOperator(operator, style);
  } else {
    return await manager.assignRandomOperator(style);
  }
}

/**
 * キャラクターからスタイル情報を抽出
 */
export function extractStyleInfo(character: Character): StyleInfo[] {
  // character.stylesはRecord<number, StyleConfig>形式
  return Object.entries(character.styles || {})
    .filter(([_, styleConfig]) => !styleConfig.disabled)
    .map(([styleId, styleConfig]) => {
      return {
        id: styleId,
        name: styleConfig.styleName,
        personality: styleConfig.personality || character.personality,
        speakingStyle: styleConfig.speakingStyle || character.speakingStyle,
        morasPerSecond: styleConfig.morasPerSecond,
      };
    });
}

/**
 * スタイル一覧を簡潔にフォーマット（operator_status / operator_assign 共通）
 */
export function formatStyleList(availableStyles: StyleInfo[], currentStyleId?: string): string {
  if (availableStyles.length <= 1) return '';

  let text = `\n利用可能なスタイル:\n`;
  availableStyles.forEach(style => {
    const isCurrent = style.id === currentStyleId;
    const marker = isCurrent ? '→ ' : '  ';
    text += `${marker}${style.id}: ${style.name}\n`;
  });
  text += `\n💡 スタイル変更: operator_assign の styleName に名前またはIDを指定（例: styleName="おしとやか" または styleName="5"）\n`;
  return text;
}

/**
 * アサイン結果をフォーマット
 */
export function formatAssignmentResult(assignResult: AssignResult, availableStyles: StyleInfo[]): string {
  let resultText = `${assignResult.characterName} (${assignResult.characterId}) をアサインしました。\n\n`;

  if (assignResult.currentStyle) {
    resultText += `📍 現在のスタイル: ${assignResult.currentStyle.styleName} (${assignResult.currentStyle.styleId})\n`;
    resultText += `   性格: ${assignResult.currentStyle.personality}\n`;
    resultText += `   話し方: ${assignResult.currentStyle.speakingStyle}\n`;
  }

  resultText += formatStyleList(availableStyles, assignResult.currentStyle?.styleId);

  if (assignResult.greeting) {
    resultText += `\n💬 "${assignResult.greeting}"\n`;
  }

  return resultText;
}

/**
 * ターゲットキャラクターを取得
 */
export async function getTargetCharacter(
  manager: OperatorManager,
  characterInfoService: CharacterInfoService,
  characterId?: string
): Promise<{ character: Character; characterId: string }> {
  if (characterId) {
    try {
      const character = await characterInfoService.getCharacterInfo(characterId);
      if (!character) {
        throw new Error(`キャラクター '${characterId}' が見つかりません`);
      }
      return { character, characterId };
    } catch {
      throw new Error(`キャラクター '${characterId}' が見つかりません`);
    }
  } else {
    const currentOperator = await manager.showCurrentOperator();
    if (!currentOperator.characterId) {
      throw new Error(
        '現在オペレータが割り当てられていません。まず operator_assign を実行してください。'
      );
    }

    const character = await characterInfoService.getCharacterInfo(currentOperator.characterId);
    if (!character) {
      throw new Error(
        `現在のオペレータ '${currentOperator.characterId}' のキャラクター情報が見つかりません`
      );
    }

    return { character, characterId: currentOperator.characterId };
  }
}

/**
 * スタイル結果をフォーマット
 */
export function formatStylesResult(character: Character, availableStyles: StyleInfo[]): string {
  let resultText = `🎭 ${character.speakerName || character.characterId} のスタイル情報\n\n`;

  resultText += `📋 基本情報:\n`;
  resultText += `   性格: ${character.personality}\n`;
  resultText += `   話し方: ${character.speakingStyle}\n`;

  // defaultStyleIdからスタイル名を取得
  const defaultStyleInfo = character.styles?.[character.defaultStyleId];
  const defaultStyleName = defaultStyleInfo?.styleName || `ID:${character.defaultStyleId}`;
  resultText += `   デフォルトスタイル: ${defaultStyleName}\n\n`;

  if (availableStyles.length > 0) {
    resultText += `🎨 利用可能なスタイル (${availableStyles.length}種類):\n`;
    availableStyles.forEach(style => {
      const isDefault = style.name === defaultStyleName;
      const marker = isDefault ? '★ ' : '  ';
      resultText += `${marker}${style.id}: ${style.name}\n`;
      resultText += `   性格: ${style.personality}\n`;
      resultText += `   話し方: ${style.speakingStyle}\n`;
      if (style.morasPerSecond) {
        resultText += `   基準話速: ${style.morasPerSecond} モーラ/秒\n`;
      }
      if (isDefault) {
        resultText += `   (デフォルトスタイル)\n`;
      }
      resultText += `\n`;
    });
  } else {
    resultText += `⚠️  利用可能なスタイルがありません。\n`;
  }

  return resultText;
}
