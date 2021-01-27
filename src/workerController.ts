import {EWorkerMode, ILogger} from "../types/common";
import {Worker} from "worker_threads";
import {IMessageResponse, IPoolController} from "../types/controller";


class WorkerStatus{
    public isUp = false;
    public isOnline = false;
    public isRun = false;
    public isStop = false;

    public stop(){
        this.isStop = true;
        this.isOnline = this.isUp = this.isRun = false;
    }
    public online(){
        this.isOnline = true;
        this.isUp = false;
    }
}

export class WorkerController {

    private mode:EWorkerMode = EWorkerMode.ASYNC;
    private status:WorkerStatus = new WorkerStatus();
    private worker:Worker;
    private logger:ILogger;

    constructor(private pool:IPoolController) {
        this.logger = pool.getLogger();

        this.status.isUp = true;
        this.worker = new Worker('./worker/worker.js', this.pool.getWorkerOptions().default);
        this.addListener();
    }

    private addListener(){
        this.worker.on('error', err => {
            this.logger.warning(err.message) // TODO потрібно надати юзеру спосіб обробляти помилки
        })
        this.worker.on("exit", code=>{
            this.status.stop();
            this.destroy(code);

        });
        this.worker.on('online', ()=>{
            if(!this.status.isStop){
                this.status.online();
                this.pool.nextTask();
            }
        });
        this.worker.on("message", (mess:IMessageResponse)=>{
            this.pool.receiveMessage(mess);
        })


    }

    public destroy(code:number){
        this.status.stop();
    }
}
