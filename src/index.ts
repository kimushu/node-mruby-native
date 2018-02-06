import * as semver from "semver";
import * as path from "path";
import * as fs from "fs-extra";
import { spawn, SpawnOptions } from "child_process";

const BINARY_BASE_DIR = path.join(__dirname, "..", "compiled");
const SELF_VERSION = require(path.join(__dirname, "..", "package.json")).version;
const DOWNLOAD_BASE_URL = `https://github.com/kimushu/node-mruby-native/releases/download/v${SELF_VERSION}/mrbc-${SELF_VERSION}`;

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

    /** Full path of mrbc executable */
    private readonly _executablePath: string;

    /** Selected mrbc version */
    private readonly _version: string;

    /** Prebuilt binary base directory */
    static prebuiltBaseDir: string = null;

    /** Download base URL (This should be used for test only) */
    static downloadBaseUrl: string = null;

    /** Array of prebuilt mruby versions */
    static readonly PREBUILT_MRUBY_VERSIONS = Object.freeze(
        ["1.3.0", "1.2.0"]
    );

    /**
     * Construct compiler instance
     * @param version Expected version (semver format)
     * @param use32bit Use 32-bit binary (ignored on Mac)
     */
    constructor(version?: string, use32bit?: boolean) {
        // Find version
        this._version = new.target.PREBUILT_MRUBY_VERSIONS.find((candidate) =>
            (version == null) || (semver.satisfies(candidate, version))
        );
        if (this._version == null) {
            throw new Error(`No matched mruby version: ${version}`);
        }

        // Generate executable path
        let arch = process.arch;
        if (use32bit && (arch === "x64") && (process.platform !== "darwin")) {
            arch = "ia32";
        }
        let basename = "mrbc";
        if (process.platform === "win32") {
            basename += ".exe";
        }
        this._executablePath = path.join(
            (new.target.prebuiltBaseDir || BINARY_BASE_DIR),
            this._version,
            process.platform,
            arch,
            basename
        );

        // Generate download URL
        this._downloadUrl = `${[
            (new.target.downloadBaseUrl || DOWNLOAD_BASE_URL),
            this._version,
            process.platform,
            arch
        ].join("-")}.tar.gz`;
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
                return require("decompress")(archive);
            })
            .then((files: {type: string, path: string, data: Buffer}[]) => {
                // Search mrbc binary
                let basename = path.basename(this._executablePath);
                let source = files.find((file) =>
                    (file.type === "file") && (path.basename(file.path) === basename)
                );
                if (source == null) {
                    throw new Error("No executable found in archive");
                }
                return fs.ensureDir(path.dirname(this._executablePath))
                .then(() => {
                    return fs.writeFile(this._executablePath, source.data);
                });
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
