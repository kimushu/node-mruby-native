import * as fs from "fs-extra";
import * as path from "path";
import { DIST_BASE_DIR, getArchiveName, PKG_VERSION } from "./index";
import * as GitHub from "github";

Promise.resolve()
.then(() => {
    // Read archive
    let name = getArchiveName(true);
    return fs.readFile(path.join(DIST_BASE_DIR, name))
    .then((file) => {
        return {
            file,
            contentType: "application/tar+gzip",
            contentLength: file.byteLength,
            name,
        };
    });
})
.then((asset) => {
    // Upload
    console.log("==== Uploading ====");
    if (process.env.GITHUB_UPLOAD == null) {
        console.warn("- Upload has been skipped");
        return;
    }
    let github = new GitHub();
    if (process.env.GITHUB_TOKEN != null) {
        console.log("- GitHub API will be authenticated by token");
        github.authenticate({
            type: "token",
            token: process.env.GITHUB_TOKEN
        });
    }
    return github.repos.getReleaseByTag(
        { owner: "kimushu", repo: "node-mruby-native", tag: PKG_VERSION }
    )
    .then((rel: { data: { upload_url: string } }) => {
        console.log(`- Uploading asset data (${asset.name} [${asset.contentLength} bytes])`);
        return github.repos.uploadAsset(
            Object.assign({ url: rel.data.upload_url }, asset)
        );
    }, (reason) => {
        console.warn(`- Failed to get release (${reason.status})`);
    });
})
.catch((reason) => {
    console.error(reason.stack || reason);
    process.exitCode = 1;
});
