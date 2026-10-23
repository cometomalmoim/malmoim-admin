import type {GenerationPorts} from '../../src/lib/history-activities/receipt-generations';
export function createPostgresGenerationSource(options:{connectionString:string;localTest60422?:boolean;reviewed?:boolean;ca?:string}):Pick<GenerationPorts,'state'|'issue'>&{close():Promise<void>};
