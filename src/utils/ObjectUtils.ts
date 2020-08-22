import {TAnyObject} from "../types/global";

export class ObjectUtils {
    public static cloneObject(origin: TAnyObject, properties: string[] = [], fullClone = true) {
        if (fullClone) {
            origin = JSON.parse(JSON.stringify(origin));
        }
        if (!properties.length) {
            return Object.assign(origin, {});
        } else {
            let res: TAnyObject = {};
            properties.forEach(v => res[v] = origin[v]);
            return res;
        }
    }
}
