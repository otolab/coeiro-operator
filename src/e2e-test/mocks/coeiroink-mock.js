/**
 * COEIROINK API Mock
 * COEIROINK APIのモック実装
 */
import express from 'express';
/**
 * COEIROINK APIサーバーのモック
 */
export class COEIROINKMockServer {
    app;
    server = null;
    port;
    speakers;
    responseDelay;
    shouldFailSynthesis;
    synthesisCount = 0;
    lastSynthesisParams = null;
    constructor(options = {}) {
        this.port = options.port || 50032;
        this.responseDelay = options.responseDelay || 0;
        this.shouldFailSynthesis = options.shouldFailSynthesis || false;
        // デフォルトのスピーカーデータ
        this.speakers = options.speakers || this.getDefaultSpeakers();
        this.app = express();
        this.setupRoutes();
    }
    getDefaultSpeakers() {
        return [
            {
                speakerId: 'つくよみちゃん',
                speakerName: 'つくよみちゃん',
                styles: [
                    {
                        styleId: 0,
                        styleName: 'のーまる',
                        iconPath: null,
                        portraitPath: null,
                        voiceSamplePaths: [],
                    },
                    {
                        styleId: 1,
                        styleName: 'わくわく',
                        iconPath: null,
                        portraitPath: null,
                        voiceSamplePaths: [],
                    },
                    {
                        styleId: 2,
                        styleName: 'ツンツン',
                        iconPath: null,
                        portraitPath: null,
                        voiceSamplePaths: [],
                    },
                ],
                speakerUuid: 'mock-tsukuyomi-uuid',
                version: '0.0.1',
            },
            {
                speakerId: 'アンジーさん',
                speakerName: 'アンジーさん',
                styles: [
                    {
                        styleId: 10,
                        styleName: 'ふつう',
                        iconPath: null,
                        portraitPath: null,
                        voiceSamplePaths: [],
                    },
                    {
                        styleId: 11,
                        styleName: 'よろこび',
                        iconPath: null,
                        portraitPath: null,
                        voiceSamplePaths: [],
                    },
                ],
                speakerUuid: 'mock-angie-uuid',
                version: '0.0.1',
            },
            {
                speakerId: 'アルマちゃん',
                speakerName: 'アルマちゃん',
                styles: [
                    {
                        styleId: 20,
                        styleName: '表',
                        iconPath: null,
                        portraitPath: null,
                        voiceSamplePaths: [],
                    },
                    {
                        styleId: 21,
                        styleName: '裏',
                        iconPath: null,
                        portraitPath: null,
                        voiceSamplePaths: [],
                    },
                ],
                speakerUuid: 'mock-alma-uuid',
                version: '0.0.1',
            },
        ];
    }
    setupRoutes() {
        this.app.use(express.json());
        // スピーカー一覧
        this.app.get('/v1/speakers', async (req, res) => {
            await this.delay();
            res.json(this.speakers);
        });
        // 音声合成
        this.app.post('/v1/synthesis', async (req, res) => {
            await this.delay();
            if (this.shouldFailSynthesis) {
                res.status(500).json({ error: 'Synthesis failed (mock)' });
                return;
            }
            this.synthesisCount++;
            this.lastSynthesisParams = req.body;
            // ダミーのWAVデータを生成（最小限のWAVヘッダー + 無音データ）
            const wavData = this.generateDummyWav();
            res.set('Content-Type', 'audio/wav');
            res.send(wavData);
        });
        // エラーテスト用エンドポイント
        this.app.post('/v1/test/set-fail', (req, res) => {
            this.shouldFailSynthesis = req.body.fail || false;
            res.json({ shouldFailSynthesis: this.shouldFailSynthesis });
        });
        // 統計情報
        this.app.get('/v1/test/stats', (req, res) => {
            res.json({
                synthesisCount: this.synthesisCount,
                lastSynthesisParams: this.lastSynthesisParams,
            });
        });
    }
    async delay() {
        if (this.responseDelay > 0) {
            await new Promise(resolve => setTimeout(resolve, this.responseDelay));
        }
    }
    generateDummyWav() {
        // 最小限のWAVヘッダー（44バイト）+ 1秒分の無音データ
        const sampleRate = 24000;
        const channels = 1;
        const bitsPerSample = 16;
        const duration = 0.1; // 0.1秒
        const dataSize = Math.floor(sampleRate * channels * (bitsPerSample / 8) * duration);
        const buffer = Buffer.alloc(44 + dataSize);
        // RIFFヘッダー
        buffer.write('RIFF', 0);
        buffer.writeUInt32LE(36 + dataSize, 4);
        buffer.write('WAVE', 8);
        // fmtチャンク
        buffer.write('fmt ', 12);
        buffer.writeUInt32LE(16, 16); // チャンクサイズ
        buffer.writeUInt16LE(1, 20); // PCM
        buffer.writeUInt16LE(channels, 22);
        buffer.writeUInt32LE(sampleRate, 24);
        buffer.writeUInt32LE(sampleRate * channels * (bitsPerSample / 8), 28); // バイトレート
        buffer.writeUInt16LE(channels * (bitsPerSample / 8), 32); // ブロックアライン
        buffer.writeUInt16LE(bitsPerSample, 34);
        // dataチャンク
        buffer.write('data', 36);
        buffer.writeUInt32LE(dataSize, 40);
        // 無音データ（既にゼロで初期化されている）
        return buffer;
    }
    async start() {
        return new Promise((resolve, reject) => {
            this.server = this.app
                .listen(this.port, () => {
                console.log(`Mock COEIROINK server listening on port ${this.port}`);
                resolve();
            })
                .on('error', reject);
        });
    }
    async stop() {
        return new Promise(resolve => {
            if (this.server) {
                this.server.close(() => {
                    this.server = null;
                    resolve();
                });
            }
            else {
                resolve();
            }
        });
    }
    // テスト用メソッド
    getSynthesisCount() {
        return this.synthesisCount;
    }
    getLastSynthesisParams() {
        return this.lastSynthesisParams;
    }
    setShouldFailSynthesis(fail) {
        this.shouldFailSynthesis = fail;
    }
    setResponseDelay(delay) {
        this.responseDelay = delay;
    }
    reset() {
        this.synthesisCount = 0;
        this.lastSynthesisParams = null;
        this.shouldFailSynthesis = false;
    }
}
//# sourceMappingURL=coeiroink-mock.js.map