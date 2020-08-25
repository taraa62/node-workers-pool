import {ILogger, IPoolOptions, IWorkerPoolController, IWorkersService} from "../../types/worker/worker";
import {TAny} from "../../types/global";
import {WorkerTask} from "./worker-task";
import {EWorkerError, EWorkerMode} from "./worker-types";
import {WorkerDedicated} from "./worker-dedicated";

export class WorkerController implements IWorkerPoolController {

    private workers: WorkerDedicated[] = [];
    private awaitQueueTasks: WorkerTask[] = [];

    constructor(private service: IWorkersService, private options: IPoolOptions, public logger: ILogger) {
        if (!this.options.minPoolWorkers || this.options.minPoolWorkers < 1)
            this.options.minPoolWorkers = 1;
        if (!this.options.maxPoolWorkers || this.options.maxPoolWorkers < 1)
            this.options.maxPoolWorkers = 1;
        this.options.timeRunTask = this.options.timeRunTask ?? -1;

        if (this.options.isUpWorker && typeof this.options.isUpWorker !== "function") {
            this.options.isUpWorker = undefined;
        }
        this.options.maxTaskToUpNewWorker = this.options.maxTaskToUpNewWorker ?? 50;

        this.options.isResetWorker = this.options.isResetWorker === undefined ? true : this.options.isResetWorker;

        this.options.maxResetTask = this.options.maxResetTask === undefined ? -1 : this.options.maxResetTask;

        for (let i = 0; i < this.options.minPoolWorkers; i++) {
            this.upWorker();
        }
    }

    public newTask<T>(data: TAny): Promise<T> {
        const task: WorkerTask = new WorkerTask(data, this.options.timeRunTask, this.options.maxResetTask);
        this.awaitQueueTasks.push(task);
        this.checkQueueTasks();
        return task.getResult();
    }

    public checkQueueTasks(): void {
        const [numAvailable, numUp, numRun, numStop] = this.getAvailableWorkers();


        if (numStop === this.options.maxPoolWorkers) {
            try {
                this.options.dropPool?.call(null);
            } finally {
                this.service.close(this.options.name);
            }
        } else {
            const availableWorkers = this.workers.filter(w => w.isWorkerOnline && !w.isWorkerStop);
            const getWorkerWithMinTasks = (): [number, WorkerDedicated] => {
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
                if (this.workers.length < this.options.minPoolWorkers!) return true;
                else if (numAvailable > 0) return false;
                else {
                    if (numUp > 0) return false;
                    if (this.workers.length === this.options.maxPoolWorkers!) return false;
                    if ((numRun + numStop) >= this.options.maxPoolWorkers!) return false;
                    if (numAvailable === this.options.maxPoolWorkers) return false;
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
            }
            if (this.awaitQueueTasks.length) {
                const isAdd = isAddWorker();
                if (isAdd || !isAdd && this.workers.length < this.options.maxPoolWorkers!) this.upWorker();

                let worker: WorkerDedicated | undefined;
                if (this.options.mode === EWorkerMode.ASYNC) {
                    [, worker] = getWorkerWithMinTasks();
                } else {
                    worker = availableWorkers.find(v => !v.isWorkerRun);
                }
                if (worker) {
                    const task = this.awaitQueueTasks.shift();

                    if (task && !worker.runTask(task)) {
                        this.awaitQueueTasks.unshift(task);
                    }
                }
            }
        }
    }

    public getAvailableWorkers(): [available: number, up: number, run: number, stop: number] {
        let list: [available: number, up: number, run: number, stop: number] = [0, 0, 0, 0];
        for (const item of this.workers) {
            if (item.isWorkerStop) list[3]++;
            else if (item.isWorkerUp) list[1]++;
            else if (item.isWorkerRun) list[2]++;
            else list[0]++;
        }
        return list;
    }

    public closeWorker(worker: WorkerDedicated, tasks: Map<string, WorkerTask>): void {
        console.info('--close worker and wake up new')
        tasks?.forEach(t => {
            if (t.reset()) this.awaitQueueTasks.push(t)
        });
        if (this.options.isResetWorker) {
            this.workers.splice(this.workers.findIndex(w => w.key === worker.key), 1);
        }
        this.checkQueueTasks();
    }

    public destroy(code: EWorkerError): void {
        this.workers.map(w => w.destroy(code));
        this.workers = [];
        this.awaitQueueTasks = [];
    }

    private upWorker(): void {
        console.info('== up worker!')
        if (this.workers.length < this.options.maxPoolWorkers!) {
            this.workers.push(new WorkerDedicated(this, this.options.mode, this.options.pathJsFile, this.options.initData,));
        }
    }


}
