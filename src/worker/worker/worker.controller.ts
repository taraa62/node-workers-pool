import {IPoolOptions, IWorkerPoolController} from "../../types/worker/worker";
import {TAny} from "../../types/global";
import {WorkerTask} from "./worker-task";
import {EWorkerMode} from "./worker-types";
import {WorkerDedicate} from "./worker-dedicate";
import { Result} from "../../utils/IResult";

export class WorkerController implements IWorkerPoolController {

    private workers: WorkerDedicate[] = [];
    private awaitQueueTasks: WorkerTask[] = [];
    private runQueueTasks: WorkerTask[] = [];

    constructor(private options: IPoolOptions) {
        if (!this.options.minPoolWorkers || this.options.minPoolWorkers < 1)
            this.options.minPoolWorkers = 1;
        if (!this.options.maxPoolWorkers || this.options.maxPoolWorkers < 1)
            this.options.maxPoolWorkers = 1;
        this.options.timeRunTask = this.options.timeRunTask ?? -1;

        if (this.options.isUpWorker && typeof this.options.isUpWorker !== "function") {
            this.options.isUpWorker = undefined;
        }
        this.options.maxTaskToUpNewWorker = this.options.maxTaskToUpNewWorker ?? 50;

        while (this.workers.length < this.options.minPoolWorkers) {
            this.upWorker();
        }
    }

    public newTask<T>(data: TAny): Promise<Result<T>> {
        const task: WorkerTask = new WorkerTask(data);
        this.awaitQueueTasks.push(task);
        this.checkQueueTasks();
        return task.getResult();
    }


    public workerExit(key: string, code: number, er?: Error): void {
        if (this.options.callWorkerExit) {
            this.options.callWorkerExit(key, er);
        }
    }

    private checkQueueTasks(): void {
        const workers = this.getAvailableWorkers();

        const getWorkerWithMinTasks = (): [number, WorkerDedicate] => {
            let min = Number.MAX_VALUE;
            let w = workers[0];
            workers.forEach(v => {
                if (v.numTasks < min) {
                    min = v.numTasks;
                    w = v;
                }

            });
            return [min, w];
        }
        const isAddWorker = (): boolean => {
            if (workers.length === this.options.maxPoolWorkers) return false;
            if (this.options.isUpWorker?.call(null, this.options, this)) {
                return true;
            } else {
                // якщо синхронний і задач які чекають на виконнання більше 5, то піднімаємо
                //якщо асинхронний і мінімальна кількість задач які обробляються на данний момент >=
                if (this.options.mode === EWorkerMode.SYNC) {
                    return this.awaitQueueTasks.length > 5
                } else {
                    const [min,] = getWorkerWithMinTasks();
                    return min >= this.options.maxTaskToUpNewWorker!;
                }
            }
        }
        if (this.awaitQueueTasks.length) {
            if (isAddWorker()) this.upWorker();
            let worker: WorkerDedicate | undefined;
            if (this.options.mode === EWorkerMode.ASYNC) {
                [, worker] = getWorkerWithMinTasks();
            } else {
                worker = workers.find(v => !v.isWorkerRun);
            }
            if (worker) {
                const task = this.awaitQueueTasks[0];
                if (worker.runTask(task)) {
                    this.runQueueTasks.push(this.awaitQueueTasks.shift()!);
                }
            }
        }
    }

    private upWorker(): void {
        if (this.workers.length < this.options.maxPoolWorkers!) {
            this.workers.push(new WorkerDedicate(this, this.options.mode, this.options.pathJsFile, this.options.initData,));
        }
    }

    public getAvailableWorkers(): WorkerDedicate[] {
        return this.workers.filter(w => w.isWorkerOnline && !w.isWorkerStop)
    }

}
