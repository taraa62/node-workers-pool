import {existsSync} from 'fs'
import * as _path from 'path'
import {IResult, Result} from "./IResult";

export class FileUtils {


    public static exit(path: string[]): Result {
        const file = _path.resolve(process.cwd(), ...path);
        const exist = existsSync(file);
        return exist ? IResult.success : IResult.errorMsg(file);
    }
}
