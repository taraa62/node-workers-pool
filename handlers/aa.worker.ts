import {IaaWorker} from "./Iaa.worker";


@Handler
export class AaWorker implements IaaWorker{

    getHelloWorld(param:string):string{
        return param + 'World';
    }
}
