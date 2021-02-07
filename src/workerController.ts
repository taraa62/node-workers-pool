import {EWorkerMode, ICommonWorkerStatus, ILogger} from "../types/common";
import {Worker} from "worker_threads";
import {
    ECommandType,
    EMessageSender,
    EResponseType,
    IMessageResponse,
    IPoolController,
    TTaskKey,
    TWorkerKey
} from "../types/controller";
import {MessageRequest, Task} from "./task";
import FileUtils from "./utils/FileUtils";
import {Random} from "./utils/Random";

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

    public stop() {
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
        const path = FileUtils.resolve([process.cwd(), 'src', 'worker', 'worker.js']);
        const workerOpt = {
            ...this.pool.getWorkerOptions().default,
            workerData: {
                mode: this.mode,
                handlers: this.pool.getHandles(),
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

    public runTask(task: Task): void {
        this.tasksPool.set(task.key, task);
        task.isRun = true;
        this.worker.postMessage(task.request);
    }

    public abortTask(key: TTaskKey): Task | void {
        if (this.tasksPool.has(key)) {
            const task = this.tasksPool.get(key)!;
            this.worker.postMessage(new MessageRequest(key, EMessageSender.CONTROLLER, ECommandType.ABORT, task.request?.handler!));
            return task
        }
        return;
    }

    public destroy(code: number) {
        this.status.stop();
    }

    private addListener() {
        this.worker.on('error', err => {
            this.logger.warning(err.message) // TODO потрібно надати юзеру спосіб обробляти помилки
        })
        this.worker.on("exit", code => {
            this.status.stop();
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
                if (mess.type === EResponseType.CRITICAL_ERROR) {
                    this.destroy(mess.type);
                }
                this.pool.receiveMessage(mess, this.tasksPool.get(mess.key));
            }
        })
    }
}
