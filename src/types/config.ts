export interface ModerationConfig {
  port: number;
  apiKey?: string;
  enabled: boolean;
  textEnabled: boolean;
  imageEnabled: boolean;
  cpuThreads: number;
  textThreshold: number;
  imageThreshold: number;
  pornThreshold: number;
  hentaiThreshold: number;
  sexyThreshold: number;
  toxicThreshold: number;
  violenceThreshold: number;
  cacheTtlSec: number;
  imageModel: string;
  textModel: string;
}
