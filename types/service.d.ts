import {IWorker} from "./worker";
import {IPoolOptions} from "./common";

export interface IService {


    getAvailableHandlers():Record<string, string>;

    /**
     *
     * @param opt
     * @return is new pool added
     */
    addPool(opt: IPoolOptions): boolean;

    getHandlerObject<T extends {}>(pool:string, handler: string): T;

    getHandlerFunc<T extends Function>(pool:string, handler: string): T;

    getSingleWorker(): IWorker;

    destroyPool(pool:string):void;

    destroyService():void;
}
