/**
 * COEIROINK API Mock
 * COEIROINK APIのモック実装
 */
export interface MockSpeaker {
    speakerId: string;
    speakerName: string;
    styles: Array<{
        styleId: number;
        styleName: string;
        iconPath: string | null;
        portraitPath: string | null;
        voiceSamplePaths: string[];
    }>;
    speakerUuid: string;
    version: string;
}
export interface MockCOEIROINKOptions {
    port?: number;
    speakers?: MockSpeaker[];
    responseDelay?: number;
    shouldFailSynthesis?: boolean;
}
/**
 * COEIROINK APIサーバーのモック
 */
export declare class COEIROINKMockServer {
    private app;
    private server;
    private port;
    private speakers;
    private responseDelay;
    private shouldFailSynthesis;
    private synthesisCount;
    private lastSynthesisParams;
    constructor(options?: MockCOEIROINKOptions);
    private getDefaultSpeakers;
    private setupRoutes;
    private delay;
    private generateDummyWav;
    start(): Promise<void>;
    stop(): Promise<void>;
    getSynthesisCount(): number;
    getLastSynthesisParams(): any;
    setShouldFailSynthesis(fail: boolean): void;
    setResponseDelay(delay: number): void;
    reset(): void;
}
//# sourceMappingURL=coeiroink-mock.d.ts.map