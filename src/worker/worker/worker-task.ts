import {Random} from "../../utils/Random";
import {IResult} from "../../utils/IResult";
import {TAny} from "../../types/global";

export class WorkerTask {
    private keyTask: string = Random.randomString(16); //key, for stop run current task;
    private readonly iRes: Promise<IResult>;
    private resolve!: Function;
    private isRun: boolean = false;

    constructor(public data: TAny) {
        this.iRes = new Promise<IResult>((res) => {
            this.resolve = res;
        })
    }

    public get key(): string {
        return this.keyTask;
    }

    public run(): void {
        this.isRun = true;
    }

    public get isRunTask(): boolean {
        return this.isRun;
    }

    /**
     end of job a workers, and result throw here.
     */
    public setRunDataWorker(error: any = null, data: any = null): void {
        this.isRun = false;
        if (data) this.resolve(IResult.successData(data));
        else this.resolve(IResult.error(error))
    }

    public getResult(): Promise<IResult> {
        return this.iRes;
    }
}
