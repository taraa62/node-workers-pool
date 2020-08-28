import {IPoolOptions, IWorkerService, TAny} from "./types/worker";

export declare class WorkerService implements IWorkerService {
    constructor();

    addPool(options: IPoolOptions): void;

    addTask<T>(namePool: string, data: TAny): Promise<T>;

    close(namePool: string): void;
}
