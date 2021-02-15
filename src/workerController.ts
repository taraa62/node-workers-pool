import {EWorkerMode, EWorkerType, ICommonWorkerStatus, ILogger} from "../types/common";
import {Worker} from "worker_threads";
import {IMessageResponse, IPoolController, TTaskKey, TWorkerKey} from "../types/controller";
import {MessageRequest, Task} from "./task";
import FileUtils from "./utils/FileUtils";
import {Random} from "./utils/Random";
import {ECommandType, EMessageSender, EResponseType} from "./common";

import {ChildProcess, fork, ForkOptions} from 'child_process';
import {IItemWorkerOptions} from "../types/worker";


export class CommonWorkerStatus implements ICommonWorkerStatus {
    public active = 0;
    public online = 0;
    public up = 0;
    public run = 0;
    public stop = 0;
    public tasks: Record<string, [number, boolean]> = {};
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

    private readonly mode: EWorkerMode = EWorkerMode.ASYNC;
    private readonly worker: Worker | ChildProcess;
    private readonly type: EWorkerType;
    private readonly sendMethod: 'send' | 'postMessage';

    private status: WorkerStatus = new WorkerStatus();
    private logger: ILogger;
    private tasksPool: Map<TTaskKey, Task> = new Map<TTaskKey, Task>();


    constructor(private pool: IPoolController) {
        this.status.isUp = true;
        this.logger = pool.getLogger();
        this.mode = this.pool.getPoolOptions().mode || EWorkerMode.ASYNC;
        this.type = this.pool.getPoolOptions().type || EWorkerType.THREADS;

        const path = FileUtils.resolve([__dirname, 'workers', this.type === EWorkerType.FORK ? 'fork.js' : 'worker-thread.js']);
        if (this.type === EWorkerType.THREADS) {
            this.worker = new Worker(path, this.pool.getWorkerOptions().default);
            this.sendMethod = 'postMessage';
        } else {
            this.worker = fork(path, this.pool.getWorkerOptions().default as ForkOptions);
            this.sendMethod = 'send';
        }
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
        info.tasks[this.key] = [this.tasksPool.size, this.status.isOnline];
    }

    public runTask(task: Task): boolean {
        const isAdd = (this.mode === EWorkerMode.SYNC) ? !this.isRun : this.pool.getWorkerOptions().maxTaskAsync! > this.tasksPool.size
        if (isAdd) {
            task.workerKey = this.key;
            task.run = this.taskTimeout.bind(this);
            this.tasksPool.set(task.key, task);
            (this.worker as any)[this.sendMethod](task.request);  // TODO fix any type
        }
        return isAdd;
    }

    public destroy(code: number = 0) {
        if (!this.isStop) {
            this.logger.info(`[close worker with code: ${code}]`);
            this.status.stop();
            this.tasksPool.forEach(task => this.pool.resetTask(task));
            this.sendMessage(new MessageRequest('close', EMessageSender.CONTROLLER, ECommandType.CLOSE_WORKER, 'close'));
        }
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
            this.workerOnline();
        });
        this.worker.on("message", (mess: IMessageResponse) => {
            if (!this.status.isStop) {
                const task = this.tasksPool.get(mess.key);
                if (task) {
                    if (mess.sender === EMessageSender.HANDLER) {
                        this.tasksPool.delete(mess.key)
                        if (this.mode === EWorkerMode.SYNC
                            || this.mode === EWorkerMode.ASYNC && this.tasksPool.size < 1) {
                            this.status.isRun = false;
                        }
                    }
                } else if (mess.type === EResponseType.SUCCESS && mess.command === ECommandType.INIT) {
                    this.status.online();
                    return this.pool.nextTask();
                } else if (mess.command === ECommandType.UP && mess.key === 'online' && mess.type === EResponseType.SUCCESS) {
                    return this.workerOnline();
                }
                this.pool.receiveMessage(this.key, mess, task);
            }
        })
    }

    private workerOnline(): void {
        if (!this.status.isStop) {
            const initData: IItemWorkerOptions = {
                mode: this.mode,
                type: this.type,
                handlers: this.pool.getHandles(),
                maxTaskAsync: this.pool.getWorkerOptions().maxTaskAsync!,
                timeout: this.pool.getTaskOptions().timeout!,
                controllerKey: this.key
            }
            this.sendMessage(new MessageRequest('init', EMessageSender.CONTROLLER, ECommandType.INIT, '', '', initData));
        }
    }

    private taskTimeout(task: Task): void {
        if (this.tasksPool.has(task.key)) {
            this.sendMessage(new MessageRequest(task.key, EMessageSender.CONTROLLER, ECommandType.ABORT_TASK, task.request!.handler!));
            this.tasksPool.delete(task.key);
        }
        this.pool.resetTask(task);
    }

    private sendMessage(mess: MessageRequest): void {
        (this.worker as any)[this.sendMethod](mess);

    }
}
