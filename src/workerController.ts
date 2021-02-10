import {EWorkerMode, ICommonWorkerStatus, ILogger} from "../types/common";
import {Worker} from "worker_threads";
import {
    IMessageResponse,
    IPoolController,
    TTaskKey,
    TWorkerKey
} from "../types/controller";
import {MessageRequest, Task} from "./task";
import FileUtils from "./utils/FileUtils";
import {Random} from "./utils/Random";
import {ECommandType, EMessageSender, EResponseType} from "./common";

export class CommonWorkerStatus implements ICommonWorkerStatus {
    public active = 0;
    public online = 0;
    public up = 0;
    public run = 0;
    public stop = 0;
    public tasks: Record<string, number> = {};
    public workerKeyMinTasks?: TWorkerKey
    public workerMinTasks: number = -1;
}

class WorkerStatus {
    public isUp = false;
    public isOnline = false;
    public isRun = false;
    public isStop = false;

    public stop(): void {
        this.isStop = true;
        this.isOnline = this.isUp = this.isRun = false;
    }

    public online() {
        this.isOnline = true;
        this.isUp = false;
    }

}

export class WorkerController {
    public readonly key: TWorkerKey = Random.randomString(16); //key, for stop run current task;
    private mode: EWorkerMode = EWorkerMode.ASYNC;
    private status: WorkerStatus = new WorkerStatus();
    private worker: Worker;
    private logger: ILogger;
    private tasksPool: Map<TTaskKey, Task> = new Map<TTaskKey, Task>();

    constructor(private pool: IPoolController) {
        this.logger = pool.getLogger();

        this.status.isUp = true;
        this.mode = this.pool.getPoolOptions().mode;

        const path = FileUtils.resolve([process.cwd(), 'src', 'worker', 'worker.js']); // TODO ??? it is ok?
        const workerOpt = {
            ...this.pool.getWorkerOptions().default,
            workerData: {
                mode: this.mode,
                handlers: this.pool.getHandles(),
                options: {
                    maxTaskAsync: this.pool.getWorkerOptions().maxTaskAsync,
                    timeout: this.pool.getTaskOptions().timeout,
                    controllerKey: this.key
                }
            }
        };

        this.worker = new Worker(path, workerOpt);
        this.addListener();
    }

    public get isActive(): boolean {
        return this.status.isOnline || this.status.isUp || this.status.isRun;
    }

    public get isUp(): boolean {
        return this.status.isUp;
    }

    public get isStop(): boolean {
        return this.status.isStop;
    }

    public get isRun(): boolean {
        return this.status.isRun
    }

    public get isFree(): boolean {
        if (this.mode === EWorkerMode.SYNC) {
            return this.status.isOnline && !this.status.isRun;
        }
        return this.status.isOnline && !this.status.isRun && this.tasksPool.size < this.pool.getWorkerOptions().maxTaskAsync!;
    }

    public giveStatus(info: CommonWorkerStatus) {
        if (this.status.isOnline) info.online++;
        if (this.status.isUp) info.up++;
        if (this.status.isRun) info.run++;
        if (this.status.isStop) info.stop++;
        if (this.isActive) info.active++;
        info.tasks[this.key] = this.tasksPool.size;
    }

    public runTask(task: Task): boolean {
        const isAdd = (this.mode === EWorkerMode.SYNC) ? !this.isRun : this.pool.getWorkerOptions().maxTaskAsync! > this.tasksPool.size
        if (isAdd) {
            task.run = this.taskTimeout.bind(this);
            this.tasksPool.set(task.key, task);
            this.worker.postMessage(task.request);
        }
        return isAdd;
    }

    public destroy(code: number = 0) {
        this.logger.info(`[close worker with code: ${code}]`);
        this.status.stop();
        this.tasksPool.forEach(task => this.pool.resetTask(task));
        this.worker.postMessage(new MessageRequest('close', EMessageSender.CONTROLLER, ECommandType.CLOSE, 'close'));
    }

    private addListener() {
        this.worker.on('error', err => {
            this.logger.error(err);
            if (this.pool.getWorkerOptions().isErrorCritical) {
                if (this.pool.getWorkerOptions().isErrorCritical!(err)) {
                    this.destroy(EResponseType.CRITICAL_ERROR);
                }
            }
        });
        this.worker.on("exit", code => {
            this.destroy(code);
        });
        this.worker.on('online', () => {
            if (!this.status.isStop) {
                this.status.online();
                this.pool.nextTask();
            }
        });
        this.worker.on("message", (mess: IMessageResponse) => {
            if (!this.status.isStop) {
                const task = this.tasksPool.get(mess.key);
                if (task) {
                    if (mess.type === EResponseType.CRITICAL_ERROR) {
                        this.destroy(mess.type);
                    } else if (mess.sender === EMessageSender.HANDLER) {
                        this.tasksPool.delete(mess.key)
                        if (this.mode === EWorkerMode.SYNC
                            || this.mode === EWorkerMode.ASYNC && this.tasksPool.size < 1) {
                            this.status.isRun = false;
                        }
                    }
                }
                this.pool.receiveMessage(mess, task);
            }
        })
    }

    private taskTimeout(task: Task): void {
        if (this.tasksPool.has(task.key)) {
            this.worker.postMessage(new MessageRequest(task.key, EMessageSender.CONTROLLER, ECommandType.ABORT, task.request!.handler!));
            this.tasksPool.delete(task.key);
        }
        this.pool.resetTask(task);
    }
}
