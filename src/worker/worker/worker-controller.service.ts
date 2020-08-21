import {IPoolOptions, IWorkerPoolController, IWorkersService} from "../../types/worker/worker";
import {IResult} from "../../utils/IResult";
import {WorkerPoolController} from "./worker-pool.controller";
import {TAny} from "../../types/global";


export class WorkerControllerService implements IWorkersService {

    private listWorkerPool: Map<string, IWorkerPoolController> = new Map<string, IWorkerPoolController>();

    constructor() {
    }

    public addPool(options: IPoolOptions): void {
        if (options?.name && !this.listWorkerPool.has(options.name)) {
            this.listWorkerPool.set(options.name, new WorkerPoolController(options));
        }
        throw IResult.errorMsg("the option is invalid or the pool exists");
    }

    public addTask(namePool: string, data: TAny): string {
        if (this.listWorkerPool.has(namePool)) {
            return this.listWorkerPool.get(namePool).newTask(data);
        }
        throw IResult.errorMsg(`'${namePool}' pool not fount`);
    }
}
