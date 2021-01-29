@Handler
export class AaWorker{

    getHelloWorld(param:string):string{
        return param + 'World';
    }
}
