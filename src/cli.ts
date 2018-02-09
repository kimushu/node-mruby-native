#!/usr/bin/env node

import { spawn, SpawnOptions } from "child_process";
import { MrubyCompiler } from "./index";
import * as path from "path";

let setup: boolean = false;
let mrubyVersion: string = undefined;

let args = process.argv.slice(2).filter((arg) => {
    let match: RegExpMatchArray;
    if (arg === "--setup") {
        setup = true;
        return false;
    } else if (match = arg.match(/^--mrubyVersion=(.*)$/)) {
        mrubyVersion = match[1];
        return false;
    } else if (match = arg.match(/^--prebuiltBaseDir=(.*)$/)) {
        MrubyCompiler.prebuiltBaseDir = match[1];
        return false;
    } else if (match = arg.match(/^--downloadUrl=(.*)$/)) {
        MrubyCompiler.downloadUrl = match[1];
        return false;
    }
    return true;
});

let compiler = new MrubyCompiler(mrubyVersion);

Promise.resolve()
.then(() => {
    if (setup) {
        return compiler.setup();
    }
    return compiler.setup(true);
})
.then(() => {
    return new Promise<number>((resolve) => {
        spawn(
            compiler.executablePath, args,
            <SpawnOptions>{
                argv0: path.basename(compiler.executablePath),
                stdio: "inherit"
            }
        ).on("exit", (code) => {
            resolve(code);
        });
    });
})
.then((code) => {
    process.exitCode = code;
}, (reason) => {
    console.error(reason.stack || reason);
    process.exitCode = 1;
});
