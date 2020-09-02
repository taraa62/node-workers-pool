import {Random} from "../../utils/Random";
import {WorkerTask} from "./worker-task";
import {WorkerMessageRequest} from "./worker-types";

import {
    EWorkerError,
    EWorkerMessageRequest,
    EWorkerMessageResponse,
    EWorkerMode,
    EWorkerType,
    ILogger,
    IWorkerMessageResponse,
    IWorkerPoolController,
    TAny,
    TAnyObject,
    TWorkerOptions,
} from "../../../types/worker";

export class WorkerDedicated {

    public readonly key: string = Random.randomString();
    private isOnline = false;
    private isRun = false;
    private isStop = false;
    private isUp = false;
    private mapTasks: Map<string, WorkerTask> = new Map<string, WorkerTask>();
    private worker!: TAnyObject;


    constructor(private controller: IWorkerPoolController, private options: TWorkerOptions) {
        this.init();
    }

    private async init(): Promise<void> {
        this.isUp = true;
        const nodePath = 'worker_threads'
        const Worker = ((this.options.type === EWorkerType.NODE) ? await require(nodePath) : window).Worker
        this.worker = new Worker(this.options.pathJsFile, this.options.defOptions);
        this.addListenerWorker();
        this.runTask(new WorkerTask({
            data: this.options?.initData,
            type: EWorkerMessageRequest.INIT
        }))
    }

    public get isWorkerUp(): boolean {
        return this.isUp;
    }

    public get isWorkerOnline(): boolean {
        return this.isOnline;
    }

    public get isWorkerRun(): boolean {
        return this.isRun;
    }

    public get isWorkerStop(): boolean {
        return this.isStop;
    }

    public get numTasks(): number {
        return this.mapTasks.size;
    }

    public runTask(task: WorkerTask): boolean {
        if (this.options.mode === EWorkerMode.SYNC && this.numTasks) return false;
        this.mapTasks.set(task.key, task);
        task.run(this);
        this.worker.postMessage(new WorkerMessageRequest(task.key, EWorkerMessageRequest.RUN_TASK, task.data));
        this.isRun = true;
        return true;
    }

    public closeTaskByTimer(key: string): void {
        this.closeTask(key, new Error('The task closes at the end of the timer.'))
    }



    private addListenerWorker(): void {
        const listener = this.options.type ===EWorkerType.NODE? 'addListener':'addEventListener';
        this.worker[listener]("error", (error: Error) => {
            this.workerError(error);
        });
        this.worker[listener]("exit", () => {
            this.isOnline = false;
            if (this.isStop) return;
            this.destroy(EWorkerError.WORKER_EXIT);
        });
        this.worker[listener]("online", () => {
            if (this.isStop) return;
            this.isOnline = true;
            this.isUp = false;
            try {
                this.controller.checkQueueTasks();
            } catch (e) {
                this.destroy(EWorkerError.INTERNAL_HANDLER_ERROR, e);
            }
        });
        this.worker[listener]("message", (mess: IWorkerMessageResponse) => {
            if (this.isStop) return;
            try {
                if (mess.type === EWorkerMessageResponse.LOGGER) {
                    this.controller.logger[mess.key as keyof ILogger](mess.data);
                } else if (mess.type === EWorkerMessageResponse.CRITICAL) {
                    this.workerError(mess.data);
                } else {
                    this.closeTask(mess.key, mess.data);
                }
            } catch (e) {
                this.destroy(EWorkerError.INTERNAL_HANDLER_ERROR, e);
            }
        });
    }

    private closeTask(key: string, result: TAny): void {
        const task = this.mapTasks.get(key);
        if (task && task.isRunTask) {
            this.mapTasks.delete(key);
            this.isRun = this.mapTasks.size > 0;
            task.setRunDataWorker(undefined, result);
        }
        this.controller.checkQueueTasks();
    }

    private workerError(error: Error) {
        this.isOnline = false;
        if (this.isStop) return;
        this.isStop = true;
        if(this.isUp){
            this.controller.errorCloseWorker();
            this.destroy(EWorkerError.WORKER_EXIT, error);
        }
        else{
            this.controller.closeWorker(this, this.mapTasks);
            this.destroy(EWorkerError.INTERNAl_WORKER_ERROR, error);
        }

    }
    public destroy(code: EWorkerError, error?: Error): void {
        this.isStop = true;
        if (code === EWorkerError.WORKER_CLOSE) {
            this.worker.postMessage(new WorkerMessageRequest('close', EWorkerMessageRequest.CLOSE_WORKER, {code: EWorkerMessageRequest.CLOSE_WORKER}));
            this.mapTasks.forEach(v => v.setRunDataWorker(error || new Error('Worker is close')));
        }else if(code === EWorkerError.WORKER_EXIT){
            this.mapTasks.forEach(v => v.setRunDataWorker(error || new Error('Worker-dedicated is invalid')));
        }
        this.mapTasks.clear();

    }
}

