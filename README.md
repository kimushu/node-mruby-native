# mruby-native

Prebuilt mruby compiler package for Node.js applications

This supplies `mrbc` command as *prebuilt* binaries for various platforms and architectures.

* No C/C++ compiler needed to install this package.
* Faster installation (only downloads a compressed archive for your platform, ~1MB)

## What is mruby?

The lightweight implementation of Ruby language.  
See http://mruby.org/

## Included mruby versions

|mruby version|RITE binary version|Included?|
|:--:|:--:|:--:|
|1.4.0|0004|Yes|
|1.3.0|0004|Yes|
|1.2.0|0003|Yes|

## Included commands

Currently, this package includes `mrbc` (mruby compiler) only.

|Command|Included?|
|:--|:--:|
|`mrbc`|Yes|
|`mirb`|No|
|`mruby`|No|
|`mruby-strip`|No|
|`mrdb`|No|

## Supported platform & architectures

|`process.platform`|`process.arch`|Supported?|
|:--:|:--:|:--:|
|win32|ia32|Yes|
|win32|x64|Yes|
|linux|ia32|Yes|
|linux|x64|Yes|
|darwin|x64|Yes|

## How to install

```
npm install mruby-native
```

If you want to use globally, add `-g` option (In some environments, `sudo` may be also required):
```
npm install -g mruby-native
```

## How to use (CLI)

You can run mruby compiler by simply running `mrbc` command in terminal.  
All arguments (except for special options mentioned later) are passed to internal `mrbc` binary.

Example:
```
$ mrbc -h
Usage: mrbc.exe [switches] programfile
  switches:
  -c           check syntax only
  -o<outfile>  place the output into <outfile>
  -v           print version number, then turn on verbose mode
  -g           produce debugging information
  -B<symbol>   binary <symbol> output in C language format
  -e           generate little endian iseq data
  -E           generate big endian iseq data
  --verbose    run at verbose mode
  --version    print the version
  --copyright  print the copyright
```

## How to change mruby version (CLI)

Add special option `--mrubyVersion=x.x.x` to `mrbc` command.

Example 1: (Without `--mrubyVersion` option, the newest version is used)
```
$ mrbc --version
mruby 1.4.0 (2018-1-16)
```

Example 2: (Change version. You can use [SemVer](https://semver.org/) syntax to specify version)
```
$ mrbc --mrubyVersion=1.2.x --version
mruby 1.2.0 (2015-11-17)
```

Example 3: (If specified version is not included, raises error)
```
$ mrbc --mrubyVersion=1.0.x --version
R:\test\node_modules\mruby-native\out\index.js:77
            throw new Error(`No matched mruby version: ${version}`);
            ^

Error: No matched mruby version: 1.0.x
    at new MrubyCompiler (R:\test\node_modules\mruby-native\out\index.js:77:19)
      :
    snip
```

## How to use (JavaScript API)

```javascript
const { MrubyCompiler } = require("mruby-native");

let compiler = new MrubyCompiler();
compiler.compile("test.rb")
.then((stdout) => {
    console.log("success:", stdout);
}, (reason) => {
    console.error("fail: ", reason);
});

// You can change mruby version by passing 1st argument with semver syntax to constructor
let olderCompiler = new MrubyCompiler("1.2.x");
```

For other APIs and details, see `out/index.d.ts`

## License

This package is released under MIT License.
