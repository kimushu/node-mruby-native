import * as path from "path";
import * as chai from "chai";
import * as rimraf from "rimraf";
import { MrubyCompiler, getCpuArchName, MrubyCompilerOptions } from "../index";
import * as fs from "fs-extra";

chai.use(require("chai-as-promised"));
const { assert } = chai;

const TEMP_DIR = path.join(__dirname, "temp");
const SRC_DIR = path.join(__dirname, "..", "..", "src", "test");
const DOWNLOAD_URL = `https://github.com/kimushu/node-mruby-native/releases/download/2.0.0-alpha.1/mrbc-2.0.0-alpha.1-${process.platform}-${getCpuArchName()}.tar.gz`;
const USE_32BIT = (getCpuArchName() === "ia32");

describe("MrubyCompiler", function(){
    describe("constructor", function(){
        it("is a function", function(){
            assert.isFunction(MrubyCompiler);
        });

        it("can be instanciated with default mruby version", function(){
            let inst = new MrubyCompiler(null, USE_32BIT);
            assert.instanceOf(inst, MrubyCompiler);
        });

        it("can be instanciated with valid mruby version", function(){
            let inst = new MrubyCompiler("1.3.x", USE_32BIT);
            assert.instanceOf(inst, MrubyCompiler);
        });

        it("can be instanciated with 32-bit mode", function(){
            if ((process.platform !== "darwin") && (process.arch === "x64")) {
                let inst = new MrubyCompiler(null, true);
                assert.instanceOf(inst, MrubyCompiler);
            } else {
                this.skip();
            }
        });

        it("throws an error by instanciating with invalid mruby version", function(){
            assert.throws(() => new MrubyCompiler("0.0.0", USE_32BIT));
        });
    });

    describe("\"version\" property", function(){
        let inst = new MrubyCompiler("1.3.x", USE_32BIT);

        it("returns an actual mruby version (not semver range)", function(){
            assert.equal(inst.version, "1.3.0");
        });

        it("is readonly", function(){
            assert.throws(() => (<any>inst).version = "1.2.3");
        });
    });

    describe("\"ready\" property", function(){
        let inst = new MrubyCompiler(null, USE_32BIT);

        before(function(done){
            rimraf(TEMP_DIR, done);
        });

        it("returns true when binary is available", function(){
            assert.isTrue(inst.ready);
        });

        it("returns true when binary is available", function(){
            try {
                MrubyCompiler.prebuiltBaseDir = TEMP_DIR;
                let inst2 = new MrubyCompiler(null, USE_32BIT);
                assert.isFalse(inst2.ready);
            } finally {
                MrubyCompiler.prebuiltBaseDir = null;
            }
        });

        it("is readonly", function(){
            assert.throws(() => (<any>inst).ready = false);
        });
    });

    describe("\"executablePath\" property", function(){
        let inst = new MrubyCompiler(null, USE_32BIT);

        it("returns string", function(){
            assert.isString(inst.executablePath);
        });

        it("is readonly", function(){
            let inst = new MrubyCompiler(null, USE_32BIT);
            assert.throws(() => (<any>inst).executablePath = "foobar");
        });
    });

    describe("\"setup\" function", function(){
        let inst = new MrubyCompiler(null, USE_32BIT);

        before(function(done){
            rimraf(TEMP_DIR, done);
        });

        it("is a function", function(){
            assert.isFunction(inst.setup);
        });

        it("returns Promise object and succeeds without result", function(){
            let promise = inst.setup(true);
            assert.instanceOf(promise, Promise);
            return assert.isFulfilled(promise.then((result) => assert.isUndefined(result)));
        });

        it("fails when binary is not available and downloading is suppressed", function(){
            try {
                MrubyCompiler.prebuiltBaseDir = TEMP_DIR;
                let inst2 = new MrubyCompiler(null, USE_32BIT);
                return assert.isRejected(inst2.setup(true));
            } finally {
                MrubyCompiler.prebuiltBaseDir = null;
            }
        });

        describe("download test", function(){
            let cleanup = function(done){
                rimraf(TEMP_DIR, done);
            };
            before(cleanup);
            after(cleanup);

            it("fails when binary is not available and download url is invalid", function(){
                try {
                    MrubyCompiler.prebuiltBaseDir = TEMP_DIR;
                    MrubyCompiler.downloadUrl = DOWNLOAD_URL + ".invalid";
                    let inst2 = new MrubyCompiler(null, USE_32BIT);
                    this.timeout(5000);
                    return assert.isRejected(inst2.setup());
                } finally {
                    MrubyCompiler.prebuiltBaseDir = null;
                    MrubyCompiler.downloadUrl = null;
                }
            });
    
            it("succeeds without result", function(){
                try {
                    MrubyCompiler.prebuiltBaseDir = TEMP_DIR;
                    MrubyCompiler.downloadUrl = DOWNLOAD_URL;
                    let inst2 = new MrubyCompiler(null, USE_32BIT);
                    this.timeout(20000);
                    return assert.isFulfilled(inst2.setup());
                } finally {
                    MrubyCompiler.prebuiltBaseDir = null;
                    MrubyCompiler.downloadUrl = null;
                }
            });
        });
    });

    describe("\"compile\" function", function(){
        let inst = new MrubyCompiler(null, USE_32BIT);

        let cleanup = function(done){
            rimraf(path.join(SRC_DIR, "sample1.mrb"), done);
        };
        before(cleanup);
        after(cleanup);

        it("is a function", function(){
            assert.isFunction(inst.compile);
        });

        it("succeeds with valid Ruby source", function(){
            return assert.isFulfilled(
                inst.compile(path.join(SRC_DIR, "sample1.rb"))
                .then(() => {
                    assert.isTrue(fs.existsSync(path.join(SRC_DIR, "sample1.mrb")));
                })
            );
        });

        it("fails with valid Ruby source", function(){
            return assert.isRejected(
                inst.compile(path.join(SRC_DIR, "sample2.rb")),
                "syntax error"
            );
        });

        let hookTest = (title: string, options: MrubyCompilerOptions, validator: ((args: string[]) => void) | (string[]), input: any = "dummy") => {
            it(title, function(done){
                let inst2 = new MrubyCompiler(null, USE_32BIT);
                (<any>inst2)._run = (args: string[]) => {
                    try {
                        if (typeof(validator) === "function") {
                            validator(args);
                        } else {
                            assert.equal(args.length, validator.length);
                            for (let i = 0; i < args.length; ++i) {
                                assert.equal(args[i], validator[i]);
                            }
                        }
                        done();
                    } catch (reason) {
                        done(reason);
                    }
                };
                inst2.compile(input, options);
            });
        };

        hookTest(
            "pass through customOptions",
            { customOptions: ["foo", "bar"] },
            ["foo", "bar", "dummy"]
        );

        hookTest(
            "converts checkSyntaxOnly to -c",
            { checkSyntaxOnly: true },
            ["-c", "dummy"]
        );

        hookTest(
            "converts output to -o<value>",
            { output: "hoge" },
            ["-ohoge", "dummy"]
        );

        hookTest(
            "ignores empty string for output",
            { output: "" },
            ["dummy"]
        );

        hookTest(
            "converts verbose to -v",
            { verbose: true },
            ["-v", "dummy"]
        );

        hookTest(
            "converts debug to -g",
            { debug: true },
            ["-g", "dummy"]
        );

        hookTest(
            "converts symbol to -B<value>",
            { symbol: "hoge" },
            ["-Bhoge", "dummy"]
        );

        hookTest(
            "ignores empty string for symbol",
            { symbol: "" },
            ["dummy"]
        );

        hookTest(
            "converts endian=\"little\" to -e",
            { endian: "little" },
            ["-e", "dummy"]
        );

        hookTest(
            "converts endian=\"big\" to -E",
            { endian: "big" },
            ["-E", "dummy"]
        );

        hookTest(
            "ignores endian=<else>",
            { endian: <any>"question" },
            ["dummy"]
        );

        hookTest(
            "accepts string array as input",
            {},
            ["foo", "bar"],
            ["foo", "bar"]
        );
    });

    describe("\"getVersion\" function", function(){
        let inst = new MrubyCompiler(null, USE_32BIT);

        it("is a function", function(){
            assert.isFunction(inst.getVersion);
        });

        it("returns Promise with version string", function(){
            return assert.isFulfilled(
                inst.getVersion()
                .then((result) => {
                    assert.match(result, /^mruby \d+\.\d+\.\d+ /);
                })
            );
        });
    });

    describe("\"getCopyright\" function", function(){
        let inst = new MrubyCompiler(null, USE_32BIT);

        it("is a function", function(){
            assert.isFunction(inst.getCopyright);
        });

        it("returns Promise with copyright string", function(){
            return assert.isFulfilled(
                inst.getCopyright()
                .then((result) => {
                    assert.match(result, /^mruby - Copyright/);
                })
            );
        });
    });
});
