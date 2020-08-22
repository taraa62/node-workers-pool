import {IPoolOptions, IWorkerPoolController, IWorkersService} from "../../types/worker/worker";
import {IResult, Result} from "../../utils/IResult";
import {WorkerController} from "./worker.controller";
import {TAny} from "../../types/global";


export class WorkerService implements IWorkersService {

    private listWorkerPool: Map<string, IWorkerPoolController> = new Map<string, IWorkerPoolController>();

    constructor() {
    }

    public addPool(options: IPoolOptions): void {
        if (options?.name && !this.listWorkerPool.has(options.name)) {
            this.listWorkerPool.set(options.name, new WorkerController(options));
        } else
            throw IResult.errorMsg("The option is invalid or the pool exists");
    }

    public addTask<T>(namePool: string, data: TAny): Promise<Result<T>> {
        if (this.listWorkerPool.has(namePool)) {
            return this.listWorkerPool.get(namePool)!.newTask(data);
        }
        throw IResult.errorMsg(`'${namePool}' pool not fount`);
    }
}
