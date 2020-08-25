import {ILogger, IPoolOptions, IWorkerPoolController, IWorkersService} from "../../types/worker/worker";
import {IResult} from "../../utils/IResult";
import {WorkerController} from "./worker.controller";
import {TAny} from "../../types/global";
import {EWorkerError} from "./worker-types";


export class WorkerService implements IWorkersService {

    private listWorkerPool: Map<string, IWorkerPoolController> = new Map<string, IWorkerPoolController>();

    constructor(private logger: ILogger = console) {
    }

    public addPool(options: IPoolOptions): void {
        if (options?.name && !this.listWorkerPool.has(options.name)) {
            this.listWorkerPool.set(options.name, new WorkerController(this, options, this.logger));
        } else
            throw IResult.errorMsg("The option is invalid or the pool exists");
    }

    public addTask<T>(namePool: string, data: TAny): Promise<T> {
        console.debug('--- ADD new Task - ' , data)
        if (this.listWorkerPool.has(namePool)) {
            return this.listWorkerPool.get(namePool)!.newTask<T>(data);
        }
        throw IResult.errorMsg(`'${namePool}' pool not found`);
    }

    public close(namePool: string): void {
        const controller = this.listWorkerPool.get(namePool);
        if (controller) {
            controller?.destroy(EWorkerError.WORKER_CLOSE);
            this.listWorkerPool.delete(namePool);
        }
    }
}
