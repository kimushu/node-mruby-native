import { spawn, SpawnOptions } from "child_process";
import * as path from "path";
import * as chai from "chai";
import * as rimraf from "rimraf";
import * as fs from "fs-extra";
import { getCpuArchName } from "..";

chai.use(require("chai-as-promised"));
const { assert } = chai;

const CLI_PATH = path.join(__dirname, "..", "cli.js");
const TEMP_DIR = path.join(__dirname, "temp");
const TEST_ARCH = getCpuArchName(true);
const USE_32BIT = (TEST_ARCH === "ia32");
const DOWNLOAD_URL = `https://github.com/kimushu/node-mruby-native/releases/download/2.0.0-alpha.1/mrbc-2.0.0-alpha.1-${process.platform}-${TEST_ARCH}.tar.gz`;

/**
 * Spawn with promise
 * @param args Arguments passed to spawn()
 * @param options Options passed to spawn()
 */
function callCommand(args: string[], options?: SpawnOptions): Promise<string> {
    return new Promise<string>((resolve, reject) => {
        let chunks: Buffer[] = [];
        let subprocess = spawn("node", [CLI_PATH].concat(...args), options);
        let { stdout, stderr } = subprocess;
        if (stdout != null) {
            stdout.on("data", (chunk: Buffer) => chunks.push(chunk));
        }
        if (stderr != null) {
            stderr.on("data", (chunk: Buffer) => chunks.push(chunk));
        }
        subprocess.on("close", (code) => {
            let output = Buffer.concat(chunks).toString("utf8");
            if (code === 0) {
                return resolve(output);
            }
            return reject(new Error(`"<cli> ${args.join(" ")}" failed with code ${code}\n${output}`));
        });
    });
}

describe("CLI test", function(){
    let args = [
        "--mrubyVersion=1.3.x",
        `--prebuiltBaseDir=${TEMP_DIR}`,
        `--downloadUrl=${DOWNLOAD_URL}`
    ];
    if (USE_32BIT) {
        args.push("--32bit");
    }

    describe("w/o binaries", function(){
        let opt = { stdio: ["ignore", "pipe", "ignore"] };

        beforeEach(function(done){
            rimraf(TEMP_DIR, done);
        });

        after(function(done){
            rimraf(TEMP_DIR, done);
        });

        it("fails w/o --setup", function(){
            return assert.isRejected(callCommand([...args, "--version"], opt));
        });

        it("succeeds w/ --setup", function(){
            this.timeout(60000);
            return assert.isFulfilled(
                callCommand([...args, "--setup", "--version"], opt)
                .then((message) => {
                    assert.match(message, /^mruby /);
                })
            );
        });
    });

    describe("w/ binaries", function(){
        let opt = { stdio: ["ignore", "pipe", "ignore"] };
        let optErr = { stdio: ["ignore", "ignore", "pipe"] };

        before(function(done){
            this.timeout(60000);
            callCommand([...args, "--setup", "--version"]).then(() => done(), done);
        });

        after(function(done){
            rimraf(TEMP_DIR, done);
        });

        it("can select mruby version by --mrubyVersion option", function(){
            return assert.isFulfilled(
                callCommand([...args.slice(1), "--mrubyVersion=1.2.x", "--version"], opt)
                .then((result) => {
                    assert.match(result, /^mruby 1\.2\.0 /);
                })
            );
        });

        it("fails w/ invalid mruby version", function(){
            return assert.isRejected(
                callCommand([...args.slice(1), "--mrubyVersion=0.0.0", "--version"], optErr),
                "Error: No matched mruby version"
            );
        });
    });
});
