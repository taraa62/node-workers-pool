import {IService} from "../types/service";
import {IWorker} from "../types/worker";
import {ILogger, IPoolOptions, IServiceOptions} from "../types/common";
import FileUtils from "./utils/FileUtils";
import {PoolController} from "./poolController";

export class WorkerService implements IService {

    private logger: ILogger | undefined = undefined;
    private readonly options: IServiceOptions;
    private readonly poolControllers: Map<string, PoolController> = new Map<string, PoolController>();
    private readonly handlers: Record<string, string> = {};


    constructor(options?: IServiceOptions) {
        this.options = options ?? {};
        this.logger = options?.logger;
        this.logger?.verbose('Initialization service')
        this.scanWorkerFiles().catch(er => {
            this.options.logger?.error(er);
        })
    }


    public addPool(options: IPoolOptions): boolean {
        if (!this.poolControllers.has(options.name)) {
            let handlers: Record<string, string> = {};
            if (options.handlers?.length) {
                options.handlers.forEach(v => {
                    if (this.handlers[v]) {
                        handlers[v] = this.handlers[v];
                    } else this.logger?.warning(`Handler ${v} not found.`)
                });
            } else {
                handlers = this.handlers;
            }

            this.poolControllers.set(options.name, new PoolController(options, handlers, this.logger!))
        }
        return false;
    };

    public getHandlerObject<T extends {}>(pool: string, handler: string): T {
        if (this.poolControllers.has(pool) && this.handlers[handler]) {
            return this.poolControllers.get(pool)!.getHandlerObject(handler);
        }
        throw new Error('Pool or handler not found');
    }

    public getHandlerFunc<T extends Function>(pool: string, handler: string): T {
        if (this.poolControllers.has(pool) && this.handlers[handler]) {
            return this.poolControllers.get(pool)!.getHandlerFunc(handler);
        }
        throw new Error('Pool or handler not found');
    }

    public getSingleWorker(): IWorker {
        return {};
    }

    public getAvailableHandlers(): Record<string, string> {
        return this.handlers;
    }

    private async scanWorkerFiles() {
        const files = await FileUtils.findFiles(this.options.pathToFolderWorkerFiles || process.cwd(), {
            extension: ['js'],
            excludeName: {
                equals: {
                    node_modules: 2,
                    test: 2,
                    '.idea': 2,
                    '.git': 2
                }
            },
            recursive: true,
            includeName: {
                endsWith: {
                    '.worker': 1
                }
            }
        });
        files.forEach(v => this.handlers[v.name] = v.path);
    }
}


