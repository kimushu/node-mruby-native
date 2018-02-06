import * as fs from "fs-extra";
import * as path from "path";
import * as tar from "tar";
import * as pify from "pify";
import { spawn, SpawnOptions } from "child_process";
import { MrubyCompiler } from "./index";
import * as GitHub from "github";

let { arch } = process;

if ((process.platform === "win32") && (process.env.VCINSTALLDIR != null)) {
    process.env.CFLAGS = "/c /nologo /W3 /we4013 /Zi /MT /O2 /D_CRT_SECURE_NO_WARNINGS";
    if (process.env.PLATFORM === "X64") {
        arch = "x64";
    } else {
        arch = "ia32";
    }
}

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

const mrubyDir = path.join(__dirname, "..", "mruby");
const binDir = path.join(__dirname, "..", "compiled");
const buildDir = path.join(__dirname, "..", "build");
const spawnOpt = {
    cwd: mrubyDir,
    stdio: ["ignore", process.stdout, process.stderr],
};
const ext = (process.platform === "win32" ? ".exe" : "");
let packageVersion: string = require(path.join(__dirname, "..", "package.json")).version;
let targets: string[] = [];

promisifiedSpawn("git", ["show", "-s", "--pretty=%D"], {cwd: __dirname})
.then((output) => {
    console.log(`==== Build information ====`);
    console.log(`- Platform: ${process.platform}`);
    console.log(`- Architecture: ${arch}`);
    console.log(`- Package version: ${packageVersion}`);
})
.then(() => MrubyCompiler.PREBUILT_MRUBY_VERSIONS.reduce((promise, mrubyVersion) => {
    let relDir = [mrubyVersion, process.platform, arch].join("/");
    let destDir = path.join(binDir, relDir);
    let target = path.join(mrubyDir, "build", "host", "bin", "mrbc" + ext);
    targets.push(`${relDir}/${path.basename(target)}`);
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
        let dest = path.join(destDir, path.basename(target));
        console.log(`- Copying artifact (${dest})`);
        return fs.ensureDir(destDir)
        .then(() => {
            return fs.copy(target, dest);
        });
    });
}, Promise.resolve()))
.then(() => {
    // Archive
    if (packageVersion == null) {
        return;
    }
    console.log("==== Packaging ====");
    let dest = path.join(buildDir, `mrbc-${packageVersion}-${process.platform}-${arch}.tar.gz`);
    return fs.ensureDir(path.dirname(dest))
    .then(() => {
        console.log(`- Generating archive (${path.basename(dest)})`);
        return pify(tar.c)(
            { gzip: true, file: dest, cwd: binDir},
            targets
        );
    })
    .then(() => {
        return fs.readFile(dest)
        .then((file) => {
            return {
                file,
                contentType: "application/tar+gzip",
                contentLength: file.byteLength,
                name: path.basename(dest),
            };
        });
    });
})
.then((asset) => {
    // Upload
    if ((asset == null) || (process.env.GITHUB_UPLOAD == null)) {
        return;
    }
    console.log("==== Uploading ====");
    let github = new GitHub();
    if (process.env.GITHUB_TOKEN != null) {
        console.log("- GitHub API will be authenticated by token");
        github.authenticate({
            type: "token",
            token: process.env.GITHUB_TOKEN
        });
    }
    return github.repos.getReleaseByTag(
        { owner: "kimushu", repo: "node-mruby-native", tag: packageVersion }
    )
    .then((rel: { upload_url: string }) => {
        console.log(`- Uploading asset data (${asset.name} [${asset.contentLength} bytes])`);
        return github.repos.uploadAsset(
            Object.assign({ url: rel.upload_url }, asset)
        );
    }, (reason) => {
        console.warn(`- Failed to get release (${reason.status})`);
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
