
let arch = process.arch;

if (process.platform === "win32") {
  process.env.CFLAGS = "/c /nologo /W3 /we4013 /Zi /MT /O2 /D_CRT_SECURE_NO_WARNINGS"
  if (process.env.PLATFORM === "X64") {
    arch = "x64"
  } else {
    arch = "ia32"
  }
}

const fse = require("fs-extra")
const path = require("path")
const {spawn, spawnSync} = require("child_process")
const mrubyDir = path.join(__dirname, "mruby")
const destDir = path.join(__dirname, "compiled", process.platform, arch)
const ext = (process.platform == "win32" ? ".exe" : "")

var cleaner = spawn("ruby", ["./minirake", "clean"], {
  cwd: mrubyDir,
  stdio: ["ignore", process.stdout, process.stderr]
})

cleaner.on("exit", (code) => {
  if (code != 0) {
    process.exitCode = code
    return console.err("mruby clean failed")
  }

  builder = spawn("ruby", ["./minirake"], {
    cwd: mrubyDir,
    stdio: ["ignore", process.stdout, process.stderr]
  })

  builder.on("exit", (code) => {
    if (code != 0) {
      process.exitCode = code
      return console.error("mruby compile failed")
    }
    copy = (from, to, strip = true) => {
      fse.ensureDirSync(path.dirname(to))
      fse.copySync(from, to)
      if (strip && process.platform !== "win32") {
        spawnSync("strip", [to])
      }
    }
    try
    {
      copy(
        path.join(mrubyDir, "build", "host", "bin", "mrbc" + ext),
        path.join(destDir, "mrbc" + ext)
      )
      console.log("Done (" + destDir + ")")
      if (process.arch == "x64" && process.platform == "linux") {
        const destDir32 = path.join(destDir, "..", "ia32")
        copy(
          path.join(mrubyDir, "build", "host-32bit", "bin", "mrbc" + ext),
          path.join(destDir32, "mrbc" + ext)
        )
        console.log("Done (" + destDir32 + ")")
      }
      return
    }
    catch (err)
    {
      process.exitCode = 1
      return console.error(err)
    }
  })
})
