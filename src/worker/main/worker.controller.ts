import {ILogger, IPoolOptions, IWorkerPoolController} from "../../types/worker/worker";
import {TAny} from "../../types/global";
import {WorkerTask} from "./worker-task";
import {EWorkerError, EWorkerMode} from "./worker-types";
import {WorkerDedicate} from "./worker-dedicate";

export class WorkerController implements IWorkerPoolController {

    private workers: WorkerDedicate[] = [];
    private awaitQueueTasks: WorkerTask[] = [];

    constructor(private options: IPoolOptions, public logger: ILogger) {
        if (!this.options.minPoolWorkers || this.options.minPoolWorkers < 1)
            this.options.minPoolWorkers = 1;
        if (!this.options.maxPoolWorkers || this.options.maxPoolWorkers < 1)
            this.options.maxPoolWorkers = 1;
        this.options.timeRunTask = this.options.timeRunTask ?? -1;

        if (this.options.isUpWorker && typeof this.options.isUpWorker !== "function") {
            this.options.isUpWorker = undefined;
        }
        this.options.maxTaskToUpNewWorker = this.options.maxTaskToUpNewWorker ?? 50;

        for (let i = 0; i < this.options.minPoolWorkers; i++) {
            this.upWorker();
        }
    }

    public newTask<T>(data: TAny): Promise<T> {
        const task: WorkerTask = new WorkerTask(data, this.options.timeRunTask);
        this.awaitQueueTasks.push(task);
        this.checkQueueTasks();
        return task.getResult();
    }


    public workerExit(key: string, code: number, er?: Error): void {
        if (this.options.callWorkerExit) {
            this.options.callWorkerExit(key, er);
        }
    }

    public checkQueueTasks(): void {
        const [availableWorkers, up] = this.getAvailableWorkers();

        const getWorkerWithMinTasks = (): [number, WorkerDedicate] => {
            let min = Number.MAX_VALUE;
            let w = availableWorkers[0];
            availableWorkers.forEach(v => {
                if (v.numTasks < min) {
                    min = v.numTasks;
                    w = v;
                }
            });
            return [min, w];
        }
        const isAddWorker = (): boolean => {
            if (availableWorkers.length === this.options.maxPoolWorkers) return false;
            if (up.length > 0) return false;
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
                worker = availableWorkers.find(v => !v.isWorkerRun);
            }
            if (worker) {
                const task = this.awaitQueueTasks[0];
                if (worker.runTask(task)) {
                    this.awaitQueueTasks.shift();
                }
            }
        }
    }

    private upWorker(): void {
        if (this.workers.length < this.options.maxPoolWorkers!) {
            console.info(' ---- UP WORKER -----')
            this.workers.push(new WorkerDedicate(this, this.options.mode, this.options.pathJsFile, this.options.initData,));
        }
    }

    public getAvailableWorkers(): [WorkerDedicate[], WorkerDedicate[]] {
        const available = this.workers.filter(w => w.isWorkerOnline && !w.isWorkerStop);
        const up = this.workers.filter(w => w.isWorkerUp && !w.isWorkerStop);
        return [available, up]
    }


    public destroy(code: EWorkerError): void {
        this.workers.map(w => w.destroy(code));
        this.workers = [];
        this.awaitQueueTasks = [];
    }


}
