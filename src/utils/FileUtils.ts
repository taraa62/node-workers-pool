import {
    appendFileSync,
    closeSync,
    createReadStream,
    createWriteStream,
    Dirent,
    existsSync,
    openSync,
    PathLike,
    promises as fsPromises,
    Stats,
    statSync,
} from 'fs';
import * as path from 'path';
import {ParsedPath} from 'path';
import * as readline from 'readline';
import {Stream} from 'stream';

// @version:1.0.3

export interface IFindOptions {
    recursive?: boolean;
    isFolderLevel?: boolean; // for the key and the value will be for the folder
    extension?: string[];
    notExtension?: string[];
    folderHierarchy?: boolean;
    includeName?: IFilterConsist;
    excludeName?: IFilterConsist;
    indexOfPath?: string;
    inFolders?: string[];
    IFind?: (parsedPath: ParsedPath, type: 1 | 2) => Promise<boolean>;
    originFolder?: string; // ignore this param!
}

export interface IFilterConsist {
    startsWith?: IFilterNameFile;
    endsWith?: IFilterNameFile;
    equals?: IFilterNameFile;
    indexOf?: IFilterNameFile;
    '*'?: 1 | 2;
}

export interface IFilterNameFile {
    [name: string]: 0 | 1 | 2;
}

export interface IFindRes extends IReadFile {
    folders?: Map<string, IFindRes>;
    files?: IReadFile[];
}

export interface IReadFile extends ParsedPath {
    folder: string;
    path: string;
}

interface TConsist {
    start: Array<[string, 0 | 1 | 2]> | undefined;
    end: Array<[string, 0 | 1 | 2]> | undefined;
    indexOf: Array<[string, 0 | 1 | 2]> | undefined;
    equals: Array<[string, 0 | 1 | 2]> | undefined;
    '*': number | undefined;
}

export default class FileUtils {
    public static path = path;

    public static mkDirRecursive(paths: string[]): Promise<string> {
        const lPath = path.resolve(process.cwd(), ...paths);
        return fsPromises.mkdir(lPath, {recursive: true}).then(_ => lPath);
    }

    public static statFile(path: string): Promise<Stats> {
        path = this.resolve([path]);
        return fsPromises.stat(path);
    }

    public static statFileSync(path: string): Stats {
        path = this.resolve([path]);
        return statSync(path);
    }

    public static exist(path: string): boolean {
        return existsSync(path);
    }

    /**
     *
     * @param path
     * @param isFile - 0 - does it just exist?, 1 - is it a file?, 2 - is it a folder?
     */
    public static existFile(path: string[], isFile: 0 | 1 | 2 = 0): boolean {
        const file = FileUtils.resolve(path);
        if (isFile === 0) return existsSync(file);
        const stat = this.statFileSync(file);
        return isFile === 1 ? stat.isFile() : stat.isDirectory();
    }

    /*
      use it function when you use folderHierarchy: true
     */
    public static async forEachFiles(
        map: Map<string, IFindRes>,
        callback: (file: IReadFile) => void | Promise<void>
    ): Promise<void> {
        if (!callback || !map) return;
        const check = async (item: IFindRes) => {
            if (item.files?.length) {
                for (const file of item.files) {
                    await callback(file);
                }
            }
            if (item.folders) {
                // @ts-ignore
                for (const folder of item.folders.values()) {
                    await check(folder);
                }
            }
        };
        // @ts-ignore
        for (const [, folder] of map.entries()) {
            if (!folder.folders && !folder.files) {
                await callback(folder);
            } else {
                await check(folder);
            }
        }
    }

    public static async forEachFolders(
        map: Map<string, IFindRes>,
        callback: (file: IFindRes) => Promise<void>
    ): Promise<void> {
        if (!callback || !map) return;
        const check = async (item: IFindRes) => {
            await callback(item);
            if (item.folders) {
                // @ts-ignore
                for (const folder of item.folders.values()) {
                    await check(folder);
                }
            }
        };
        // @ts-ignore
        for (const folder of map.values()) {
            await check(folder);
        }
    }

    public static async findFiles(
        path: string,
        options: IFindOptions = {}
    ): Promise<Map<string, IReadFile>> {
        const result: Map<string, IFindRes> = new Map<string, IFindRes>();
        const root = FileUtils.resolve([path]);
        const stat = await this.statFile(root);
        // const rootFolder = this.path.parse(root).base;
        if (!options.originFolder) {
            options.originFolder = this.path.parse(root).base;
        }
        if (!stat.isDirectory() || stat.isBlockDevice()) {
            throw new Error('This file has error');
        }
        const isOpt = Object.keys(options).length;

        const getConsistObj = (param: string): TConsist => {
            const getEntries = (p: keyof IFilterConsist) => {
                return (options[param as keyof IFindOptions] as IFilterConsist)?.[p]
                    ? Object.entries(
                        (options[param as keyof IFindOptions] as IFilterConsist)[
                            p
                            ] as IFilterNameFile
                    )
                    : undefined;
            };

            return {
                start: getEntries('startsWith'),
                end: getEntries('endsWith'),
                indexOf: getEntries('indexOf'),
                equals: getEntries('equals'),
                '*': (options[param as keyof IFindOptions] as IFilterConsist)?.['*'],
            };
        };
        const include: TConsist = getConsistObj('includeName');
        const exclude: TConsist = getConsistObj('excludeName');

        const checkConsist = (
            name: string,
            type: 2 | 1,
            conf: TConsist,
            def = false
        ): undefined | boolean => {
            if (!conf.start && !conf.end && !conf.equals && !conf.indexOf) {
                return def;
            }
            if (conf['*'] && type === conf['*']) return true;
            let res = conf.start?.find(([key, val]) =>
                val === type ? name.startsWith(key) : false
            );
            if (res !== undefined) return !!res;
            res = conf.end?.find(([key, val]) =>
                val === type ? name.endsWith(key) : false
            );
            if (res !== undefined) return !!res;
            res = conf.indexOf?.find(([key, val]) =>
                val === type ? name.indexOf(key) > -1 : false
            );
            if (res !== undefined) return !!res;
            res = conf.equals?.find(([key, val]) =>
                val === type ? name === key : false
            );
            return res !== undefined ? !!res : def;
        };
        if (options.extension?.length) {
            options.extension.forEach((value, index, array) => {
                if (!value.startsWith('.')) array[index] = '.' + value;
            });
        }
        if (options.notExtension?.length) {
            options.notExtension.forEach((value, index, array) => {
                if (!value.startsWith('.')) array[index] = '.' + value;
            });
        }
        const checkName = (
            parsedPath: ParsedPath,
            type: 1 | 2
        ): Promise<boolean> => {
            let res = true;

            if (options.notExtension?.length) {
                res = !options.notExtension.find(v => parsedPath.ext === v);
            }
            if (res) {
                if (options.extension?.length) {
                    const exist = options.extension.find(v => parsedPath.ext === v);
                    res = !!exist;
                }
                if (res) {
                    if (options.excludeName) {
                        const exc = checkConsist(parsedPath.name, type, exclude);
                        res = exc !== undefined ? !exc : res;
                    }
                    if (res && options.includeName) {
                        const incl = checkConsist(parsedPath.name, type, include);
                        res = incl !== undefined ? incl : true;
                    }
                }
            }
            if (res && typeof options.IFind === 'function') {
                return options.IFind(parsedPath, type);
            }
            return Promise.resolve(res);
        };

        const checkInFolder = (folders: string[], def = true): boolean => {
            if (options.inFolders?.length) {
                let isFind = false;
                for (const folder of options.inFolders) {
                    if (folders.includes(folder)) {
                        isFind = true;
                        break;
                    }
                }
                return isFind;
            }
            return def;
        };

        const checkFile = async (file: Dirent, subPath: string): Promise<void> => {
            if (result.has(file.name)) return;
            const fullPath = this.resolve([subPath, file.name]);
            const info: IReadFile = this.path.parse(fullPath) as IReadFile;
            info.path = fullPath;
            info.folder = FileUtils.getName(info.dir);

            if (!isOpt && file.isFile()) {
                result.set(file.name, info);
                return;
            } else {
                if (options.indexOfPath) {
                    if (fullPath.indexOf(options.indexOfPath) < 0) return;
                }

                const isCluded = await checkName(info, file.isDirectory() ? 2 : 1);
                if (isCluded) {
                    const folders = subPath.split(this.path.sep).filter(Boolean);
                    const cFolder =
                        options.isFolderLevel && file.isDirectory()
                            ? [...folders, file.name]
                            : folders;
                    if (!checkInFolder(cFolder)) return;
                    if (!options.folderHierarchy) {
                        if (file.isDirectory()) {
                            if (options.isFolderLevel) {
                                result.set(file.name, info);
                            }
                        } else result.set(file.name, info);
                    } else {
                        let rootIndex = folders.findIndex(v => v === options.originFolder);
                        rootIndex++;
                        let dirInfo = result.get(folders[rootIndex]);
                        if (dirInfo) rootIndex++;
                        if (rootIndex === folders.length) {
                            if (!dirInfo) {
                                dirInfo = {
                                    ...info,
                                    folders: new Map<string, IFindRes>(),
                                    files: [],
                                };
                                result.set(file.name, dirInfo);
                            } else {
                                if (file.isDirectory()) {
                                    if (!dirInfo.folders!.has(file.name)) {
                                        const obj: IFindRes = {
                                            ...info,
                                            folders: new Map<string, IFindRes>(),
                                            files: [],
                                        };
                                        dirInfo.folders!.set(file.name, obj);
                                        dirInfo = obj;
                                    } else {
                                        dirInfo = dirInfo.folders!.get(file.name);
                                    }
                                }
                            }
                        } else {
                            for (rootIndex; rootIndex < folders.length; rootIndex++) {
                                if (!dirInfo) {
                                    dirInfo = {
                                        ...info,
                                        path: folders.join(this.path.sep),
                                        folders: new Map<string, IFindRes>(),
                                        files: [],
                                        name: folders[rootIndex],
                                    };
                                    result.set(folders[rootIndex], dirInfo);
                                } else {
                                    if (!dirInfo.folders!.has(folders[rootIndex])) {
                                        const obj: IFindRes = {
                                            ...info,
                                            path: folders.join(this.path.sep),
                                            folders: new Map<string, IFindRes>(),
                                            files: [],
                                            name: folders[rootIndex],
                                        };
                                        dirInfo.folders!.set(folders[rootIndex], obj);
                                        dirInfo = obj;
                                    } else {
                                        dirInfo = dirInfo.folders!.get(folders[rootIndex]);
                                    }
                                }
                            }
                        }
                        if (dirInfo) {
                            if (!options.isFolderLevel && file.isFile()) {
                                dirInfo.files!.push(info);
                            } else if (options.isFolderLevel && dirInfo.name !== file.name) {
                                dirInfo.folders!.set(file.name, {
                                    ...info,
                                    folders: new Map<string, IFindRes>(),
                                    files: [],
                                });
                            }
                        }
                    }
                }
            }
        };
        const readDir = async (path: string) => {
            const files = await fsPromises.readdir(path, {withFileTypes: true});
            for (const file of files) {
                if (file.isDirectory()) {
                    if (options.isFolderLevel) await checkFile(file, path);
                    if (
                        checkConsist(file.name, this.fileSymb(file), include, true) &&
                        !checkConsist(file.name, this.fileSymb(file), exclude, false)
                    ) {
                        if (options.recursive || checkInFolder([file.name], false)) {
                            await readDir(`${path}/${file.name}`);
                        }
                    }
                } else if (!options.isFolderLevel) {
                    await checkFile(file, path);
                }
            }
        };

        if (root) {
            await readDir(root);
        }
        return result;
    }

    public static async findFileDuplicates(
        paths: string[],
        options: IFindOptions,
        checkDuplicateFolder = false
    ): Promise<Map<string, string[]>> {
        const map: Map<string, string> = new Map<string, string>();
        const duplicate: Map<string, string[]> = new Map<string, string[]>();

        const checkDupl = (name: string, path: string) => {
            if (!map.has(name)) {
                map.set(name, path);
            } else {
                if (!duplicate.has(name)) {
                    duplicate.set(name, [map.get(name)!]);
                }
                duplicate.get(name)!.push(path);
            }
        };
        const checkPath = (folders: Map<string, IFindRes>) => {
            const check = (key: string, item: IFindRes) => {
                if (checkDuplicateFolder) {
                    checkDupl(key, item.path);
                }
                if (item.files && !checkDuplicateFolder) {
                    for (const file of item.files) {
                        checkDupl(file.name, file.path);
                    }
                }
                if (item.folders) {
                    // @ts-ignore
                    for (const folder of item.folders.values()) {
                        check(folder.name, folder);
                    }
                }
            };
            // @ts-ignore
            for (const [key, folder] of folders.entries()) {
                check(key, folder);
            }
        };
        for (const path of paths) {
            checkPath(await this.findFiles(path, options));
        }
        return duplicate;
    }

    public static resolve(files: string[]): string {
        return path.resolve(process.cwd(), ...files);
    }

    public static read(filePath: PathLike): Promise<string> {
        return fsPromises.readFile(filePath).then(v => v.toString());
    }

    public static getName(path: string): string {
        return this.path.parse(path).name;
    }

    public static async readLine(
        file: string,
        callback: (er: Error | null, line: string | null) => void
    ): Promise<void> {
        if (callback) {
            const fileStream = createReadStream(file);
            try {
                const rl = readline.createInterface({
                    input: fileStream,
                    crlfDelay: Infinity,
                });
                for await (const line of rl) {
                    callback(null, line);
                }
            } catch (er) {
                callback(er, null);
            } finally {
                await fileStream.close();
                callback(null, null);
            }
        }
    }

    // To check the equality of lines
    public static cleanString(str?: string): string | undefined {
        if (!str) return str;
        str = str.replace(/[\n\r ]/g, '');
        if (str.length > 2 && str.startsWith("'") && str.endsWith("'")) {
            str = str.substr(1, str.length - 2);
        }
        return str;
    }

    public static normalizeString(str: string): string {
        if (str) {
            str = str
                // .trim()
                .replace(/[\n|\r]/g, ' ')
                .replace(/\s* /g, ' ');
        }
        return str;
    }

    public static write(path: string, data: string | string[]): Promise<void> {
        if (Array.isArray(data)) data = data.join('');
        return fsPromises.writeFile(path, data);
    }

    public static writeStreamToFile(path: string, stream: Stream): Promise<void> {
        return new Promise((res, rej) => {
            const writeable = createWriteStream(path);
            writeable.on('error', rej);
            writeable.on('end', res);
            writeable.on('close', res);
            stream.pipe(writeable);
        });
    }

    public static addPrefixToFileName(file: string, prefix: string): string {
        const parse = path.parse(file);
        const name = prefix + parse.base;
        return path.resolve(parse.dir, name);
    }

    public static writeChunkToFileSync(
        path: string
    ): {
        writeTo?: (str: string | string[], separator?: string) => Error | void;
        writeEnd?: () => Error | void;
        error?: Error;
    } {
        try {
            const fd = openSync(path, 'a');
            const writeTo = (str: string | string[], separator?: string) => {
                try {
                    if (str instanceof Array) {
                        str = str.join(separator || '');
                    }
                    appendFileSync(fd, str);
                } catch (error) {
                    return error;
                }
            };
            const writeEnd = (): Error | void => {
                try {
                    closeSync(fd);
                } catch (error) {
                    return error;
                }
            };
            if (!writeTo || !writeEnd) {
                return {error: new Error('Error opened file')};
            }
            return {writeTo, writeEnd};
        } catch (error) {
            return {error};
        }
    }

    private static fileSymb(file: Dirent): 1 | 2 {
        return file.isDirectory() ? 2 : 1;
    }
}
