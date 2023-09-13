import { Transform, TransformOptions } from 'readable-stream';
import { MetricLabel } from '@metrics/metric';

declare class MetricsGuard extends Transform {
    constructor(options?: MetricsGuard.MetricsGuardOptions);

    id: Readonly<string>;
    metricsThreshold: Readonly<number>;
    permutationWarnThreshold: Readonly<number>;
    permutationThreshold: Readonly<number>;
    enabled: Readonly<boolean>;
    registry: Map<string, Set<string>>;

    /**
     * Get all keys from the registry
     */
    getMetrics(): string[];
    /**
     * Get all labels for the given metric from the registry
     */
    getLabels(metric: string): MetricLabel[];
    /**
     * Clear the registry
     */
    reset(): void;
}

declare namespace MetricsGuard {
    export interface MetricsGuardOptions extends TransformOptions {
        id?: string;
        /**
         * @default true
         */
        enabled?: boolean;
        /**
         * @default 1000
         */
        permutationThreshold?: number;
        /**
         * @default 60
         */
        metricsThreshold?: number;
    }
}

export = MetricsGuard;
