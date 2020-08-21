import {TAny} from "../../types/global";
import {Random} from "../../utils/Random";

export class WorkerItemTask {
    private keyTask: string = Random.randomString(16); //key, for stop run current task;

    constructor(private initData: TAny) {

    }

    public get key(): string {
        return this.keyTask;
    }
}
