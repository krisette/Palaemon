import { app, session, BrowserWindow, ipcMain } from "electron";
import { Lulu } from "../client/Types";
import path from "path";
import os from "os";

import * as k8s from "@kubernetes/client-node";
import * as cp from "child_process";
const fetch: any = (...args: any) =>
  import("node-fetch").then(({ default: fetch }: any) => fetch(...args));

import {
  setStartAndEndTime,
  formatClusterData,
  formatEvents,
  formatAlerts,
  parseNode,
  fetchMem,
  fetchCPU
} from "./utils";

// metrics modules
import { formatMatrix } from "./metricsData/formatMatrix";
import { SvgInfo, SvgInfoObj } from "../client/Types";
// K8S API BOILERPLATE
const kc = new k8s.KubeConfig();
kc.loadFromDefault();
const k8sApiCore = kc.makeApiClient(k8s.CoreV1Api);
const k8sApiApps = kc.makeApiClient(k8s.AppsV1Api);

const PROM_URL = "http://127.0.0.1:9090/api/v1/";

const isDev: boolean = process.env.NODE_ENV === "development";
// const PORT: string | number = process.env.PORT || 8080;

// this is to allow the BrowserWindow object to be referrable globally
// however, BrowserWindow cannot be created before app is 'ready'
let mainWindow: any = null;

const loadMainWindow = () => {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: true,
      // contextIsolation: false,
      devTools: isDev, //whether to enable DevTools
      preload: path.join(__dirname, "preload.js"),
    },
  });

  // depending on whether this is dev mode or production mode
  // if dev mode, open port 8080 to share server
  // if production mode, open directly from build file in /dist folder
  // if (isDev) {
  //   mainWindow.loadURL(`http://localhost:${PORT}`);
  //   console.log(`Main Window loaded PORT ${PORT}`);
  // } else {
  //   mainWindow.loadFile(path.join(__dirname, '../client/index.html'));
  //   console.log('Main Window loaded file index.html');
  // }

  // above code has skeleton for runnin
  mainWindow.loadFile(path.join(__dirname, "../client/index.html"));
  console.log("Main Window loaded file index.html");
};

app.on("ready", loadMainWindow);
// invoke preload? to load up all the data..? maybe

// adding react dev tools on load
const REACT_DEV_TOOL_HASHSTRING: string = "fmkadmapgofadopljbjfkapdkoienihi";
// the following should be different for different os
const REACT_DEV_TOOL_PATH_MAC_OS: string = path.resolve(
  os.homedir(),
  "/Library/Application Support/Google/Chrome/Default/Extensions/fmkadmapgofadopljbjfkapdkoienihi/4.9.0_0"
);
app.whenReady().then(async () => {
  await session.defaultSession.loadExtension(REACT_DEV_TOOL_PATH_MAC_OS);
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

// K8S API //

// get all info function for initial load and reloads

ipcMain.handle("getAllInfo", async (): Promise<any> => {
  // nodes
  const tempData: SvgInfo = {
    name: 'deploy',
    usage: 1,
    resource: 'deploy',
    request: 0.9,
    limit: Math.random() + 1,
    parent: 'deploy',
    namespace: 'deploy',
  }

  const namespace = "default";
  
  try {
    const getNodes = await k8sApiCore.listNode(namespace);
    
    const nodeData = getNodes.body.items.map((node) => {
      return parseNode(node);
    }); // end of nodeData

    const getPods = await k8sApiCore.listPodForAllNamespaces();

    // console.log('SINGLE POD BODY ITEMS', getPods.body.items[0])

    const podData = await Promise.all(
      getPods.body.items.map((pod) => {
        // each pod is either mem or CPU but we dont know which one it is..

        fetchMem(pod)

      })
    );

    if (podData) {
      const newObj: Lulu = {
        Clusters: [
          {
            name: "",
            usage: 1,
            resource: "memory",
            limit: 1,
            request: 1,
            parent: "",
            namespace: "",
          },
        ],
        Nodes: nodeData,
        Pods: podData,
        Deployments: [tempData],
      };
      return newObj;
    }
    
  } catch (error) {
    return [tempData];
  }
});

// get nodes in cluster
ipcMain.handle("getNodes", async (): Promise<any> => {
  // dynamically get this from frontend later
  const namespace = "default";
  try {
    const data = await k8sApiCore.listNode(namespace);
    // console.log('THIS IS INDIVIDUAL NODE ', data.body.items[0]);
    // const formattedData: any = data.body.items.map(
    //   (pod) => pod?.metadata?.name
    // );

    // return formattedData;
    return data.body.items;
  } catch (error) {
    return console.log(`Error in getNodes function: ERROR: ${error}`);
  }
});

// get deployments in cluster
ipcMain.handle("getDeployments", async (): Promise<any> => {
  try {
    const data = await k8sApiApps.listDeploymentForAllNamespaces();
    const formattedData: any = data.body.items.map(
      (pod) => pod?.metadata?.name
    );
    // console.log("THIS IS DATA ", formattedData);
    return formattedData;
  } catch (error) {
    console.log(`Error in getDeployments function: ERROR: ${error}`);
  }
});

// get pods in cluster
ipcMain.handle("getPods", async (): Promise<any> => {
  try {
    // const data = await k8sApiCore.listPodForAllNamespaces();
    const data = await k8sApiCore.listPodForAllNamespaces();
    // console.log('THIS OS BODY.ITEMS ', data.body.items);
    const podNames: (string | undefined)[] = data.body.items.map(
      (pod) => pod?.metadata?.name
    );
    const node: (string | undefined)[] = data.body.items.map(
      (pod) => pod?.spec?.nodeName
    );
    const namespace: (string | undefined)[] = data.body.items.map(
      (pod) => pod?.metadata?.namespace
    );
    // console.log('I AM INEVITABLSDFSDFSDFSDFS: ', data.body.items[0])
    return { podNames, node, namespace };
  } catch (error) {
    return console.log(`Error in getPods function: ERROR: ${error}`);
  }
});

// COMMAND LINE //
// get events
ipcMain.handle("getEvents", async () => {
  try {
    const response: string = cp
      .execSync("kubectl get events --all-namespaces", {
        encoding: "utf-8",
      })
      .toString();
    return formatEvents(response);
  } catch (error) {
    return console.log(`Error in getEvents function: ERROR: ${error}`); // add return statement to make async () => on line 112 happy
  }
});

// PROMETHEUS API //

ipcMain.handle("getMemoryUsageByPods", async () => {
  const { startTime, endTime } = setStartAndEndTime();
  // const query = `http://127.0.0.1:9090/api/v1/query_range?query=sum(container_memory_working_set_bytes{namespace="default"}) by (pod)&start=2022-09-07T05:13:25.098Z&end=2022-09-08T05:13:59.818Z&step=1m`
  const interval = "15s";
  try {
    // startTime and endTime look like this

    // data interval

    // promQL query to api/v1 endpoint
    const query = `${PROM_URL}query_range?query=sum(container_memory_working_set_bytes{namespace="default"}) by (pod)&start=${startTime}&end=${endTime}&step=${interval}`;
    // fetch request
    const res = await fetch(query);
    const data = await res.json();

    // data.data.result returns matrix
    return formatMatrix(data.data);
  } catch (error) {
    console.log(`Error in getMemoryUsageByPod function: ERROR: ${error}`);
    return { err: error };
  }
});

// get alerts
ipcMain.handle("getAlerts", async (): Promise<any> => {
  try {
    const data: any = await fetch(`${PROM_URL}/rules`);
    const alerts: any = await data.json();
    return formatAlerts(alerts);
  } catch (error) {
    console.log(`Error in getAlerts function: ERROR: ${error}`);
  }
});
