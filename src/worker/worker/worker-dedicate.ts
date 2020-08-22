import {Random} from "../../utils/Random";
import {TAny} from "../../types/global";
import {WorkerTask} from "./worker-task";
import {EWorkerMessageType, EWorkerMode, TListenerEvent, WorkerMessage} from "./worker-types";
import {FileUtils} from "../../utils/FileUtils";
import {Worker} from "worker_threads";
import {WorkerController} from "./worker.controller";

export class WorkerDedicate {

    public readonly key: string = Random.randomString();
    private isOnline = false;
    private isRun = false;
    private isStop = false;
    private tasks: WorkerTask[] = [];
    private worker: Worker;
    private listenersWorker: Map<string, Set<Function>> = new Map<string, Set<Function>>();


    constructor(private controller: WorkerController, private mode: EWorkerMode, js: string, initData?: TAny) {
        const exist = FileUtils.exit([js]);
        if (exist.error) throw new Error(`file is not exist! by path: ${exist.message}`)
        console.info(`Up worker: key=${this.key}, path=${js}`);
        this.worker = new Worker(js, {workerData: {data: initData}});
        this.addListenersToWorker();
    }

    public addListenerWorkerEvent(event: TListenerEvent, callback: Function): void {
        if (this.isStop) return;
        if (!this.listenersWorker.has(event)) {
            this.listenersWorker.set(event, new Set<Function>().add(callback));
        } else {
            const _set: Set<Function> | undefined = this.listenersWorker.get(event);
            if (_set && !_set.has(callback)) _set.add(callback);
        }
    }

    private addListenersToWorker(): void {
        const dispatch = (list: Set<Function> | undefined, data: TAny | null = null) => {
            if (list) Array.from(list).map(v => v(data));
        };

        this.worker.on("error", (er: Error) => {
            this.isOnline = false;
            if (this.isStop) return;
            dispatch(this.listenersWorker.get("error"), er);
            this.destroy(2, er);
        });
        this.worker.on("exit", (ex: number) => {
            this.isOnline = false;
            if (this.isStop) return;
            dispatch(this.listenersWorker.get("exit"), ex);
            this.destroy(ex);
        });
        this.worker.on("online", () => {
            if (this.isStop) return;
            this.isOnline = true;
            dispatch(this.listenersWorker.get("online"));

        });
        this.worker.on("message", (val: WorkerMessage) => {
            if (this.isStop) return;
            dispatch(this.listenersWorker.get("message"), val);
        });
    }


    public runTask(task: WorkerTask): boolean {
        if (this.mode === EWorkerMode.SYNC && this.numTasks) return false;
        this.tasks.push(task);
        this.run(task);
        return true;
    }

    private run(task: WorkerTask) {
        task.run();
        this.worker.postMessage(new WorkerMessage(task.key, EWorkerMessageType.INIT, task.data));
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
        return this.tasks.length;
    }

    public destroy(code: number, error?: Error): void {
        this.isStop = true;

        this.tasks = [];

        this.controller.workerExit(this.key, code, error);
    }
}

