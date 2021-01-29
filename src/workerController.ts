import {EWorkerMode, ILogger} from "../types/common";
import {Worker} from "worker_threads";
import {ECommandType, EMessageSender, IMessageResponse, IPoolController, TTaskKey} from "../types/controller";
import {MessageRequest, Task} from "./task";
import FileUtils from "./utils/FileUtils";


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

    // @ts-ignore
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
            workerData:{
                mode:this.mode,
                handlers:this.pool.getHandles(),
            }
        };

        this.worker = new Worker(path, workerOpt);
        this.addListener();
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
                this.pool.receiveMessage(mess, this.tasksPool.get(mess.key));
            }
        })
    }
}
