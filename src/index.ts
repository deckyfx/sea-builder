import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { spawn } from "node:child_process";

// @ts-ignore:next-line
import { inject } from "postject";

const [major, minor, patch] = process.versions.node.split(".").map(Number);

if (major < 20) {
  console.log(
    `Current NodeJS version is ${major}.${minor}. The require version is >= 20`
  );
  process.exit(1);
}
const OS_NAME = os.platform();
const CPU_ARCH = os.arch();

if (OS_NAME !== "linux") {
  console.log(
    `Current OS is ${OS_NAME} ${CPU_ARCH}. For now this only supports linux x64`
  );
  process.exit(1);
}

const PackageJSON: {
  name: string;
  main: string;
  scripts: {
    build: string;
    [key: string]: string;
  };

  [key: string]: any;
} = JSON.parse(fs.readFileSync("package.json", "utf-8"));

if (!PackageJSON.name) {
  console.log(`Make sure package.json has name property`);
  process.exit(1);
}

if (!PackageJSON.main) {
  console.log(
    `Make sure package.json has main property pointing to built result entry`
  );
  process.exit(1);
}

if (!PackageJSON.scripts.build) {
  console.log(
    `Make sure package.json has scripts.build property to handle the buiild proccess,`
  );
  process.exit(1);
}

const NODE_PATH = process.execPath;
const BUILD_PATH_ROOT = ["./", "build"];
const VERCEL_NCC_EXECUTABLE_PATH = [
  "./",
  "node_modules",
  "@vercel",
  "ncc",
  "dist",
  "ncc",
  "cli.js",
];
const chunks = PackageJSON.name.split("/");
const APP_NAME = chunks.length > 0 ? chunks[chunks.length - 1] : chunks[0];
const APP_BLOB_NAME = `${APP_NAME}.blob`;
const DIST_SRC_ENTRY = PackageJSON.main;
const SEA_ENTRY_PATH = BUILD_PATH_ROOT.concat("index.js");
const SEA_BLOB_PATH = BUILD_PATH_ROOT.concat(APP_BLOB_NAME);
const SEA_CONFIG_PATH = BUILD_PATH_ROOT.concat("sea-config.json");
const SEA_APP_PATH = BUILD_PATH_ROOT.concat(APP_NAME);
const ASSETS_PATH = ["./", "assets"];

function createDirectoryIfNotExists(directoryPath: string) {
  try {
    fs.mkdirSync(directoryPath, { recursive: true });
    console.log(`Create ${directoryPath} directory.`);
  } catch (error: any) {
    if (error.code !== "EEXIST") {
      console.error(`Error creating directory: ${error.message}`);
      throw error;
    } else {
      console.log(`Directory ${directoryPath} already exists.`);
    }
  }
}

function runCommand(command: string, args: string[] = []) {
  return new Promise<{ stdout: string; stderr: string }>((resolve, reject) => {
    const proccess = spawn(command, args, { stdio: "inherit" });
    console.log(">>>> ", command, args.join(" "));
    let stdoutData = "";
    let stderrData = "";

    proccess.stdout?.on("data", (data) => {
      stdoutData += data.toString();
    });

    proccess.stderr?.on("data", (data) => {
      stderrData += data.toString();
    });

    proccess.on("close", (code) => {
      if (code === 0) {
        resolve({ stdout: stdoutData, stderr: stderrData });
      } else {
        reject(
          new Error(
            `npm command "${command} ${args.join(
              " "
            )}" exited with code ${code}`
          )
        );
      }
    });
  });
}

function mapFilesAndFolders(directory: string): Record<string, string> {
  const results: Record<string, string> = {};

  const files = fs.readdirSync(directory);
  for (const file of files) {
    const filePath = path.join(directory, file);
    const stats = fs.statSync(filePath);
    if (stats.isDirectory()) {
      const subdirectoryResults = mapFilesAndFolders(filePath);
      Object.assign(results, subdirectoryResults);
    } else {
      results[filePath] = filePath;
    }
  }
  return results;
}

const SEA_CONFIG_TEMPLATE = {
  main: path.join(...SEA_ENTRY_PATH),
  output: path.join(...SEA_BLOB_PATH),
  disableExperimentalSEAWarning: true,
  useSnapshot: false,
  useCodeCache: true,
  assets: {},
};

function mapAssets() {
  const assets_path = path.join(...ASSETS_PATH);
  try {
    const stats = fs.statSync(assets_path);
    if (!stats.isDirectory()) {
      return;
    }
    const assets = mapFilesAndFolders(path.join(...ASSETS_PATH));
    SEA_CONFIG_TEMPLATE.assets = assets;
  } catch (error) {
    console.log("Cannot find assets directory, skip bundling assets");
    return;
  }
}

async function main() {
  try {
    console.log(`Creating executable binary: ${APP_NAME}`);

    mapAssets();

    createDirectoryIfNotExists(path.join(...BUILD_PATH_ROOT));

    console.log("Running: npm build");
    await runCommand("npm", ["run", "build"]);
    console.log("");

    console.log("Build Dist");
    await runCommand(path.join(...VERCEL_NCC_EXECUTABLE_PATH), [
      "build",
      DIST_SRC_ENTRY,
      "-o",
      path.join(...BUILD_PATH_ROOT),
    ]);
    console.log("");

    console.log("Generate sea config file");
    fs.writeFileSync(
      path.join(...SEA_CONFIG_PATH),
      JSON.stringify(SEA_CONFIG_TEMPLATE)
    );
    console.log("");

    console.log("Generate SEA blob");
    await runCommand("node", [
      "--experimental-sea-config",
      path.join(...SEA_CONFIG_PATH),
    ]);
    console.log("");

    console.log("Generate blank SEA");
    await runCommand("cp", [NODE_PATH, path.join(...SEA_APP_PATH)]);
    console.log("");

    console.log("Inject prgram data into SEA");
    await inject(
      path.join(...SEA_APP_PATH),
      "NODE_SEA_BLOB",
      fs.readFileSync(path.join(...SEA_BLOB_PATH)),
      {
        sentinelFuse: "NODE_SEA_FUSE_fce680ab2cc467b6e072b8b5df1996b2",
        overwrite: true,
      }
    );
    console.log("");

    console.log(`Binary ${path.join(...SEA_APP_PATH)} built`);
    console.log("OK!");
  } catch (error) {
    console.error("Error", error);
  }
}

main();
