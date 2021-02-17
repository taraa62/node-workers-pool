import * as fs from "fs";
import {Readable} from "stream";

export const write = async (file: string, stream: Readable) => {
    // const read = fs.createReadStream('/home/taraa62/Загрузки/Vox Pops Video.mp4');
    const write = fs.createWriteStream(file);
    stream.pipe(write);

    // @ts-ignore
    // stream.pipe((p: any) => {
    //     console.log(p)
    // })
}



export const read = (file: string): fs.ReadStream => {
    return fs.createReadStream(file)

}
