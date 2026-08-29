export * from './common-commerce-object.js';
export type SupportedProtocol = 'ACP' | 'UCP' | 'AP2' | 'mock-UAP' | 'simulator';
export interface AdapterResult {
    protocol: SupportedProtocol;
    normalized: boolean;
}
export declare function placeholderNormalize(protocol: SupportedProtocol): AdapterResult;
//# sourceMappingURL=index.d.ts.map