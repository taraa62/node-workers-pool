import {Random} from "../../utils/Random";
import {IResult} from "../../utils/IResult";
import {TAny} from "../../types/global";
import {WorkerDedicate} from "./worker-dedicate";
import {clearTimeout} from "timers";

export class WorkerTask<T = any> {
    private keyTask: string = Random.randomString(16); //key, for stop run current task;
    private readonly iRes: Promise<T>;
    private resolve!: Function;
    private reject!: Function;
    private isRun: boolean = false;
    private isStop: boolean = false;
    private timerKey?: NodeJS.Timeout;
    private worker?: WorkerDedicate;

    constructor(public data: TAny, timer: number = -1) {
        this.iRes = new Promise<T>((res) => {
            this.resolve = res;
        })

        if (timer ! > 0) {
            this.timerKey = setTimeout(() => {
                if (!this.isStop) {
                    this.worker?.closeTaskByTimer(this.key);
                }
            }, timer)
        }
    }


    public get key(): string {
        return this.keyTask;
    }

    public run(worker: WorkerDedicate): void {
        this.isRun = true;
        this.worker = worker;
    }

    public get isRunTask(): boolean {
        return this.isRun;
    }

    /**
     end of job a workers, and result throw here.
     */
    public setRunDataWorker(error?: Error, data?: T, exitCode?: number): void {
        this.isRun = false;
        if (!this.isStop) {
            if (this.timerKey) clearTimeout(this.timerKey);
            this.isStop = true;
            if (data) this.resolve(data);
            else this.reject(IResult.error(error || new Error('Internal main error'), exitCode))
        }
    }

    public getResult(): Promise<T> {
        return this.iRes;
    }
}
