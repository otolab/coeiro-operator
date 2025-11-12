/**
 * voice-resolver.ts: 音声設定の解決を担当
 */

import { OperatorManager, ConfigManager, CharacterInfoService } from '@coeiro-operator/core';
import type { Character, Speaker } from '@coeiro-operator/core';
import { AudioSynthesizer } from './audio-synthesizer.js';
import { logger } from '@coeiro-operator/common';
import type { VoiceConfig } from './types.js';

export class VoiceResolver {
  constructor(
    private configManager: ConfigManager,
    private operatorManager: OperatorManager,
    private characterInfoService: CharacterInfoService,
    private audioSynthesizer: AudioSynthesizer
  ) {}

  /**
   * 現在のオペレータの音声設定を取得
   */
  async getCurrentVoiceConfig(styleName?: string | null): Promise<VoiceConfig | null> {
    try {
      const currentStatus = await this.operatorManager.showCurrentOperator();

      if (!currentStatus.characterId) {
        return null;
      }

      const character = await this.characterInfoService.getCharacterInfo(currentStatus.characterId);

      if (character && character.speakerId) {
        // 保存されたセッション情報からスタイルを取得
        const session = await this.operatorManager.getCurrentOperatorSession();
        let selectedStyle: any;

        // デバッグ: セッション情報を確認
        logger.debug('VoiceResolver.getCurrentVoiceConfig()', {
          styleName,
          session,
          'session?.styleId': session?.styleId,
          'session?.styleId !== undefined': session?.styleId !== undefined,
        });

        if (styleName) {
          // 明示的にスタイルが指定された場合はそれを使用
          logger.debug('分岐: 明示的スタイル指定');
          selectedStyle = this.characterInfoService.selectStyle(character, styleName);
        } else if (session?.styleId !== undefined) {
          // セッションに保存されたスタイルIDがある場合はそれを使用
          logger.debug('分岐: セッションからスタイル取得');
          const savedStyle = character.styles?.[session.styleId];
          if (savedStyle) {
            selectedStyle = savedStyle;
            logger.debug(
              `保存されたスタイルを使用: ${savedStyle.styleName} (ID:${session.styleId})`
            );
          } else {
            // 保存されたスタイルが見つからない場合はデフォルトを使用
            logger.debug('保存されたスタイルが見つからない、デフォルト使用');
            selectedStyle = this.characterInfoService.selectStyle(character, null);
          }
        } else {
          // セッション情報がない場合はデフォルトスタイルを使用
          logger.debug('分岐: セッション情報なし、デフォルト使用');
          selectedStyle = this.characterInfoService.selectStyle(character, null);
        }

        // 新しいstyles構造からstyleMorasPerSecondを生成
        const styleMorasPerSecond: Record<number, number> = {};
        if (character.styles) {
          Object.entries(character.styles).forEach(([styleId, config]) => {
            if (config.morasPerSecond !== undefined) {
              styleMorasPerSecond[Number(styleId)] = config.morasPerSecond;
            }
          });
        }

        return {
          speaker: null, // 廃止予定: character.speaker は削除されたため
          selectedStyleId: selectedStyle.styleId,
          speakerId: character.speakerId,
          styleMorasPerSecond,
        };
      }

      return null;
    } catch (error) {
      logger.error(`オペレータ音声取得エラー: ${(error as Error).message}`);
      return null;
    }
  }

  /**
   * CharacterIdからVoiceConfigを生成
   */
  async resolveCharacterToConfig(
    characterId: string,
    styleName?: string | null
  ): Promise<VoiceConfig> {
    try {
      // ConfigManagerからCharacter設定を取得
      const characterConfig = await this.configManager.getCharacterConfig(characterId);
      if (!characterConfig) {
        throw new Error(`Character not found: ${characterId}`);
      }

      // speakerIdからspeaker情報を取得（COEIROINKサーバーから）
      const speakers = await this.audioSynthesizer.getSpeakers();
      const speaker = speakers.find(s => s.speakerUuid === characterConfig.speakerId);
      if (!speaker) {
        throw new Error(`Speaker '${characterConfig.speakerId}' not found for character '${characterId}'`);
      }

      // スタイル選択
      let selectedStyle;
      if (styleName) {
        // スタイル名が指定された場合、characterConfig.stylesから対応するstyleIdを探す
        const styleEntry = Object.entries(characterConfig.styles).find(
          ([_, config]) => config.styleName === styleName
        );
        if (styleEntry) {
          const styleId = Number(styleEntry[0]);
          selectedStyle = speaker.styles.find(s => s.styleId === styleId);
        }
      }

      // デフォルトスタイルを使用
      if (!selectedStyle) {
        selectedStyle = speaker.styles.find(s => s.styleId === characterConfig.defaultStyleId);
      }

      // それでも見つからない場合は最初のスタイルを使用
      if (!selectedStyle) {
        selectedStyle = speaker.styles[0];
      }

      // スタイルが見つからない場合はエラー
      if (!selectedStyle) {
        throw new Error(
          `No valid style found for character '${characterId}'${styleName ? ` with style '${styleName}'` : ''}`
        );
      }

      // speaker-provider.Speakerからoperator.Speakerへ変換
      const operatorSpeaker: Speaker = {
        speakerId: speaker.speakerUuid,
        speakerName: speaker.speakerName,
        styles: speaker.styles,
      };

      // 新しいstyles構造からstyleMorasPerSecondを生成
      const styleMorasPerSecond: Record<number, number> = {};
      if (characterConfig.styles) {
        Object.entries(characterConfig.styles).forEach(([styleId, config]) => {
          if (config.morasPerSecond !== undefined) {
            styleMorasPerSecond[Number(styleId)] = config.morasPerSecond;
          }
        });
      }

      return {
        speaker: operatorSpeaker,
        selectedStyleId: selectedStyle.styleId,
        speakerId: characterConfig.speakerId,
        styleMorasPerSecond,
      };
    } catch (error) {
      logger.error(`Character解決エラー: ${(error as Error).message}`);
      throw new Error(`Failed to resolve character '${characterId}': ${(error as Error).message}`);
    }
  }

  /**
   * 音声設定を解決
   */
  async resolveVoiceConfig(
    voice: string | VoiceConfig | null | undefined,
    style?: string,
    allowFallback: boolean = true
  ): Promise<VoiceConfig> {
    if (!voice) {
      // オペレータから音声を取得（スタイル指定も渡す）
      const operatorVoice = await this.getCurrentVoiceConfig(style);
      if (operatorVoice) {
        // ログ出力（speakerがnullの場合はspeakerIdを使用）
        if (operatorVoice.speaker) {
          const selectedStyle = operatorVoice.speaker.styles.find(
            s => s.styleId === operatorVoice.selectedStyleId
          );
          const styleName = selectedStyle?.styleName || `ID:${operatorVoice.selectedStyleId}`;
          logger.info(
            `オペレータ音声を使用: ${operatorVoice.speaker.speakerName} (スタイル: ${styleName})`
          );
        } else {
          logger.info(
            `オペレータ音声を使用: ${operatorVoice.speakerId} (スタイルID: ${operatorVoice.selectedStyleId})`
          );
        }
        return operatorVoice;
      } else if (allowFallback) {
        // CLIのみ: デフォルトキャラクターを使用（つくよみちゃん）
        const defaultCharacterId = 'tsukuyomi';
        logger.info(`デフォルトキャラクターを使用: ${defaultCharacterId}`);
        return await this.resolveCharacterToConfig(defaultCharacterId, style);
      } else {
        // MCP: オペレータが必須
        throw new Error(
          'オペレータが割り当てられていません。まず operator_assign を実行してください。'
        );
      }
    } else if (typeof voice === 'string') {
      // string型の場合はCharacterIdとして解決
      logger.info(`キャラクター解決: ${voice}`);
      const voiceConfig = await this.resolveCharacterToConfig(voice, style);
      if (voiceConfig.speaker) {
        const selectedStyle = voiceConfig.speaker.styles.find(
          s => s.styleId === voiceConfig.selectedStyleId
        );
        const styleName = selectedStyle?.styleName || `ID:${voiceConfig.selectedStyleId}`;
        logger.info(`  → ${voiceConfig.speaker.speakerName} (スタイル: ${styleName})`);
      }
      return voiceConfig;
    } else {
      // すでにVoiceConfig型の場合はそのまま使用
      if (voice.speaker) {
        const selectedStyle = voice.speaker.styles.find(
          s => s.styleId === voice.selectedStyleId
        );
        const styleName = selectedStyle?.styleName || `ID:${voice.selectedStyleId}`;
        logger.info(`VoiceConfig使用: ${voice.speaker.speakerName} (スタイル: ${styleName})`);
      }
      return voice;
    }
  }
}