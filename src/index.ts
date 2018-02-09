import * as semver from "semver";
import * as path from "path";
import * as fs from "fs-extra";
import { spawn, SpawnOptions } from "child_process";

/** Array of prebuilt mruby versions */
export const PREBUILT_MRUBY_VERSIONS = Object.freeze(
    ["1.3.0", "1.2.0"]
);

/** Base directory for mrbc binaries */
export const MRBC_BASE_DIR = path.join(__dirname, "..", "compiled");

/** Base directory for distribution packages (for build only) */
export const DIST_BASE_DIR = path.join(__dirname, "..", "dist");

/** Package version (NOT mruby version) */
export const PKG_VERSION = require(path.join(__dirname, "..", "package.json")).version;

const DOWNLOAD_BASE_URL = `https://github.com/kimushu/node-mruby-native/releases/download/${PKG_VERSION}/`;

/**
 * Get CPU architecture name
 * @param build Override architecture for build
 * @param use32bit Use 32-bit binary (ignored on Mac)
 */
export function getCpuArchName(build?: boolean, use32bit?: boolean): string {
    /* istanbul ignore if */
    if (build) {
        // Override architecture by environment variable
        let { TARGET_ARCH } = process.env;
        switch (TARGET_ARCH) {
            case "x64":
                return "x64";
            case "x86":
                return "ia32";
            default:
                throw new Error(`Unknown TARGET_ARCH: ${TARGET_ARCH}`);
        }
    }
    if ((process.platform !== "darwin") && use32bit) {
        return "ia32";
    }
    return process.arch;
}

/**
 * Get mrbc binary path
 * @param version mruby version
 * @param build Override architecture for build
 * @param use32bit Use 32-bit binary (ignored on Mac)
 * @param baseDir Base directory
 */
export function getMrbcPath(version: string, build?: boolean, use32bit?: boolean, baseDir?: string): string {
    let { platform } = process;
    let arch = getCpuArchName(build, use32bit);
    let ext = (platform === "win32") ? ".exe" : "";
    return path.join(baseDir || MRBC_BASE_DIR, version, platform, arch, "mrbc" + ext);
}

/**
 * Get archive name
 * @param build Override architecture for build
 */
export function getArchiveName(build?: boolean): string {
    let arch = getCpuArchName(build);
    return `mrbc-${PKG_VERSION}-${process.platform}-${arch}.tar.gz`;
}

/**
 * Compiler options
 */
export interface MrubyCompilerOptions {
    /** Runs syntax check only */
    checkSyntaxOnly?: boolean;

    /** Specify output file path */
    output?: string;

    /** Enable verbose mode */
    verbose?: boolean;

    /** Produce debugging information */
    debug?: boolean;

    /** Enable C language format with specified symbol */
    symbol?: string;

    /** Specify byte-endian for iseq data */
    endian?: "little" | "big";

    /** Custom options passed to mrbc */
    customOptions?: string[];
}

/**
 * mruby compiler for Node applications
 */
export class MrubyCompiler {
    /** Download URL */
    private readonly _downloadUrl: string;

    /** Base dir for binary */
    private readonly _binaryBaseDir: string;

    /** Full path of mrbc executable */
    private readonly _executablePath: string;

    /** Selected mrbc version */
    private readonly _version: string;

    /** Prebuilt binary base directory */
    static prebuiltBaseDir: string = null;

    /** Download URL (This should be used for test only) */
    static downloadUrl: string = null;

    /**
     * Construct compiler instance
     * @param version Expected version (semver format)
     * @param use32bit Use 32-bit binary (ignored on Mac)
     */
    constructor(version?: string, use32bit?: boolean) {
        // Find version
        this._version = PREBUILT_MRUBY_VERSIONS.find((candidate) =>
            (version == null) || (semver.satisfies(candidate, version))
        );
        if (this._version == null) {
            throw new Error(`No matched mruby version: ${version}`);
        }

        // Generate executable path
        this._binaryBaseDir = new.target.prebuiltBaseDir;
        this._executablePath = getMrbcPath(this._version, false, use32bit, this._binaryBaseDir);

        // Generate download URL
        this._downloadUrl = (new.target.downloadUrl) || (DOWNLOAD_BASE_URL + getArchiveName());
    }

    /**
     * Return selected version number
     */
    get version(): string {
        return this._version;
    }

    /**
     * Check if executable is ready
     */
    get ready(): boolean {
        try {
            fs.accessSync(this._executablePath, fs.constants.X_OK);
            return true;
        } catch {
            return false;
        }
    }

    /**
     * Get mrbc executable path
     */
    get executablePath(): string {
        return this._executablePath;
    }

    /**
     * Setup compiler
     * @param suppressDownload Do not download binaries
     */
    setup(suppressDownload?: boolean): Promise<void> {
        return Promise.resolve()
        .then(() => {
            if (fs.existsSync(this._executablePath)) {
                // File already exists (but may be non-executable)
                return;
            }
            if (suppressDownload) {
                throw new Error("mrbc executable is not ready");
            }

            // Download archive from GitHub
            return require("download")(this._downloadUrl)
            .then((archive) => {
                // Extract archive
                return require("decompress")(archive, this._binaryBaseDir || MRBC_BASE_DIR);
            })
            .then(() => {
                // Check binary existence
                if (!fs.existsSync(this._executablePath)) {
                    throw new Error("No executable found in archive");
                }
            });
        })
        .then(() => {
            if (this.ready) {
                // File is executable
                return;
            }
            // Make executable for Linux/Mac
            fs.chmodSync(this._executablePath, 0o755);
        });
    }

    /**
     * Compile mruby script (.rb) to mruby binary (.mrb)
     */
    compile(input: string | string[], options: MrubyCompilerOptions = {}): Promise<string> {
        let args: string[] = [];
        if (options.customOptions instanceof Array) {
            args.push(...options.customOptions);
        }
        if (options.checkSyntaxOnly) {
            args.push("-c");
        }
        if ((options.output != null) && (options.output !== "")) {
            args.push(`-o${options.output}`);
        }
        if (options.verbose) {
            args.push("-v");
        }
        if (options.debug) {
            args.push("-g");
        }
        if ((options.symbol != null) && (options.symbol !== "")) {
            args.push(`-B${options.symbol}`);
        }
        if (options.endian === "little") {
            args.push("-e");
        } else if (options.endian === "big") {
            args.push("-E");
        }
        if (input instanceof Array) {
            args.push(...input);
        } else if (typeof(input) === "string") {
            args.push(input);
        }
        return this._run(args);
    }

    /**
     * Get version information
     */
    getVersion(): Promise<string> {
        return this._run(["--version"]).then((output) => output.trim());
    }

    /**
     * Get copyright information
     */
    getCopyright(): Promise<string> {
        return this._run(["--copyright"]).then((output) => output.trim());
    }

    /**
     * Run mrbc
     */
    private _run(args: string[]): Promise<string> {
        return new Promise((resolve, reject) => {
            let mrbc = spawn(
                this._executablePath, args,
                <SpawnOptions>{ argv0: path.basename(this._executablePath) }
            );
            let stdoutChunks: Buffer[] = [];
            let stderrChunks: Buffer[] = [];
            mrbc.stdin.end();
            mrbc.stdout.on("data", (chunk: Buffer) => stdoutChunks.push(chunk));
            mrbc.stderr.on("data", (chunk: Buffer) => stderrChunks.push(chunk));
            mrbc.on("close", (code) => {
                if (code !== 0) {
                    let stderr = Buffer.concat(stderrChunks).toString("utf8");
                    if (stderr !== "") {
                        return reject(new Error(stderr));
                    }
                    return reject(new Error(`spawn(mrbc) failed with code ${code}`));
                }
                let stdout = Buffer.concat(stdoutChunks).toString("utf8");
                return resolve(stdout);
            });
        });
    }
}
