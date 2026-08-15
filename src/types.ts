export type OutputMode = 'terminal' | 'json' | 'ci';

export interface CliOptions {
  readonly help: boolean;
  readonly version: boolean;
  readonly history: boolean;
  readonly json: boolean;
  readonly ci: boolean;
  readonly largest?: number;
  readonly maxFileSize?: number;
  readonly maxRepositorySize?: number;
  readonly configPath?: string;
}

export interface RepositoryInfo {
  readonly path: string;
  readonly name: string;
  readonly branch: string;
  readonly gitDirectory: string;
  readonly hasCommits: boolean;
}

export interface TrackedFile {
  readonly path: string;
  readonly size: number;
  readonly kind: 'file' | 'symlink';
}

export interface MissingTrackedFile {
  readonly path: string;
}

export interface FileTypeStat {
  readonly category: FileCategory;
  readonly size: number;
  readonly count: number;
}

export interface ExtensionStat {
  readonly extension: string;
  readonly category: FileCategory;
  readonly size: number;
  readonly count: number;
}

export type FileCategory =
  | 'JavaScript'
  | 'TypeScript'
  | 'JSON'
  | 'HTML'
  | 'CSS'
  | 'Images'
  | 'Video'
  | 'Audio'
  | 'Fonts'
  | 'Archives'
  | 'Documents'
  | 'Binary'
  | 'Other';

export interface DirectoryStat {
  readonly path: string;
  readonly size: number;
}

export interface Warning {
  readonly path?: string;
  readonly size?: number;
  readonly message: string;
}

export interface HistoryObject {
  readonly objectId: string;
  readonly path?: string;
  readonly size: number;
  readonly type: 'blob' | 'tree' | 'commit' | 'tag' | 'unknown';
}

export interface HistoryReport {
  readonly gitDirectorySize: number;
  readonly looseObjects: number;
  readonly looseObjectsSize: number;
  readonly packedObjects: number;
  readonly packedObjectsSize: number;
  readonly objectCount: number;
  readonly largestObjects: readonly HistoryObject[];
  readonly notes: readonly string[];
}

export interface RepositoryReport {
  readonly repository: RepositoryInfo;
  readonly sizes: {
    readonly workingTree: number;
    readonly gitDirectory: number;
    readonly total: number;
  };
  readonly trackedFileCount: number;
  readonly missingTrackedFiles: readonly MissingTrackedFile[];
  readonly directoryCount: number;
  readonly largestFiles: readonly TrackedFile[];
  readonly largestDirectories: readonly DirectoryStat[];
  readonly fileTypes: readonly FileTypeStat[];
  readonly extensions: readonly ExtensionStat[];
  readonly warnings: readonly Warning[];
  readonly recommendations: readonly string[];
  readonly history?: HistoryReport;
}

export interface GitSizeConfig {
  readonly maxFileSize?: number;
  readonly maxRepositorySize?: number;
  readonly largestFiles?: number;
  readonly ignore?: readonly string[];
}

export interface AnalysisConfig {
  readonly largestFiles: number;
  readonly warningThreshold: number;
  readonly maxFileSize?: number;
  readonly maxRepositorySize?: number;
  readonly ignore: readonly string[];
}

export interface AnalysisResult {
  readonly report: RepositoryReport;
  readonly limitViolations: readonly string[];
}