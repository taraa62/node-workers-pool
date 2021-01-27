import {IWorker} from "./single-worker";
import {IPoolOptions} from "./common";

export interface IService {


    getAvailableHandlers():Record<string, string>;

    /**
     *
     * @param opt
     * @return is new pool added
     */
    addPool(opt: IPoolOptions): boolean;

    getHandler<T>(pool: string, handler: string): T;

    getSingleWorker(): IWorker;
}
