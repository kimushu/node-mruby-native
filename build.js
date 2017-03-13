
const fse = require("fs-extra")
const path = require("path")
const {spawn} = require("child_process")
const mrubyDir = path.join(__dirname, "mruby")
const destDir = path.join(__dirname, "compiled", process.platform, process.arch)
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
      return console.err("mruby compile failed")
    }
    copy = (from, to) => {
      fse.ensureDirSync(path.dirname(to))
      fse.copySync(from, to)
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
