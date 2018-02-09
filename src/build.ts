import * as fs from "fs-extra";
import * as path from "path";
import * as tar from "tar";
import * as pify from "pify";
import { spawn, SpawnOptions } from "child_process";
import { getMrbcPath, getCpuArchName, getArchiveName,MRBC_BASE_DIR, DIST_BASE_DIR, PKG_VERSION,  PREBUILT_MRUBY_VERSIONS } from "./index";

if ((process.platform === "win32") && (process.env.VCINSTALLDIR != null)) {
    // Patch for Visual C++ compiler
    // - Use "/MT" instead of "/MD" to avoid linking to runtime library
    // - Disable warnings for deprecated POSIX names ("/D_CRT_NONSTDC_NO_WARNINGS")
    process.env.CFLAGS = "/c /nologo /W3 /we4013 /Zi /MT /O2 /D_CRT_SECURE_NO_WARNINGS /D_CRT_NONSTDC_NO_WARNINGS";
}

/**
 * Spawn with promise
 * @param command Command passed to spawn()
 * @param args Arguments passed to spawn()
 * @param options Options passed to spawn()
 */
function promisifiedSpawn(command: string, args: string[], options: SpawnOptions): Promise<string> {
    return new Promise<string>((resolve, reject) => {
        let chunks: Buffer[] = [];
        let subprocess = spawn(command, args, options);
        let { stdout } = subprocess;
        if (stdout != null) {
            stdout.on("data", (chunk: Buffer) => chunks.push(chunk));
        }
        subprocess.on("close", (code) => {
            if (code === 0) {
                return resolve(Buffer.from(chunks).toString("utf8"));
            }
            return reject(new Error(`"${[command, ...args].join(" ")}" failed with code ${code}`));
        });
    });
}

let mrubyDir = path.join(__dirname, "..", "mruby");

const spawnOpt = {
    cwd: mrubyDir,
    stdio: ["ignore", process.stdout, process.stderr],
};
let outputs: string[] = [];

promisifiedSpawn("git", ["show", "-s", "--pretty=%D"], {cwd: __dirname})
.then((output) => {
    console.log(`==== Build information ====`);
    console.log(`- Platform: ${process.platform}`);
    console.log(`- Architecture: ${getCpuArchName(true)}`);
    console.log(`- Package version: ${PKG_VERSION}`);
})
.then(() => PREBUILT_MRUBY_VERSIONS.reduce((promise, mrubyVersion) => {
    let output = getMrbcPath(mrubyVersion, true);
    let target = path.join(mrubyDir, "build", "host", "bin", path.basename(output));
    outputs.push(path.relative(MRBC_BASE_DIR, output));
    if (process.env.SKIP_REBUILD != null) {
        return promise;
    }
    return promise
    .then(() => {
        console.log(`==== Building mruby ${mrubyVersion} ====`);

        // Switch tag
        console.log("- Checking out");
        return promisifiedSpawn("git", ["checkout", "-q", mrubyVersion], spawnOpt);
    })
    .then(() => {
        // Clean
        console.log("- Cleaning");
        return promisifiedSpawn("ruby", ["./minirake", "clean"], spawnOpt);
    })
    .then(() => {
        // Build
        console.log("- Building");
        return promisifiedSpawn("ruby", [
            "./minirake", target.replace(/\\/g, "/")
        ], spawnOpt);
    })
    .then(() => {
        // Copy
        console.log(`- Copying artifact (${output})`);
        return fs.ensureDir(path.dirname(output))
        .then(() => {
            return fs.copy(target, output);
        });
    });
}, Promise.resolve()))
.then(() => {
    // Archive
    console.log("==== Packaging ====");
    let dest = path.join(DIST_BASE_DIR, getArchiveName(true));
    return fs.ensureDir(path.dirname(dest))
    .then(() => {
        console.log(`- Generating archive (${path.basename(dest)})`);
        return pify(tar.c)(
            { gzip: true, file: dest, cwd: MRBC_BASE_DIR },
            outputs
        );
    });
})
.then(() => {
    // Cleanup
    console.log("==== Cleaning up ====");
    return promisifiedSpawn("git", ["checkout", "master"], spawnOpt);
})
.catch((reason) => {
    console.error(reason.stack || reason);
    process.exitCode = 1;
});
