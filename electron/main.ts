import { app, session, BrowserWindow, ipcMain } from "electron";
import path from "path";
import installExtension, { REACT_DEVELOPER_TOOLS, REDUX_DEVTOOLS } from 'electron-devtools-installer';

import * as k8s from "@kubernetes/client-node";
import * as cp from "child_process";
const fetch: any = (...args: any) =>
  import("node-fetch").then(({ default: fetch }: any) => fetch(...args));

import {
  setStartAndEndTime,
  formatClusterData,
  formatEvents,
  formatAlerts,
  parseMem
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

const isDev: boolean = process.env.NODE_ENV === 'development';
// const PORT: string | number = process.env.PORT || 8080;

// this is to allow the BrowserWindow object to be referrable globally
// however, BrowserWindow cannot be created before app is 'ready'
let mainWindow: any = null;

// this is the function to open windows
const loadMainWindow = () => {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: true,
      devTools: isDev, //whether to enable DevTools
      preload: path.join(__dirname, "preload.js"),
    },
  });
  
  mainWindow.loadFile(path.join(__dirname, "../client/index.html"));
  console.log("Main Window loaded file index.html");
};

app.on("ready", async () => {
  if(isDev){
    const forceDownload = !!process.env.UPGRADE_EXTENSIONS;
    const extensions = [REACT_DEVELOPER_TOOLS, REDUX_DEVTOOLS];
    installExtension(
      extensions,
      {loadExtensionOptions: {allowFileAccess: true}, forceDownload: forceDownload}
    ).then((name:string) => {console.log(`Added Extension: ${name}`)})
     .then(loadMainWindow)
    //  .catch((err: Error) => {console.log('There was an Error: ', err)})
  }
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

// K8S API //

// get all info function for initial load and reloads

ipcMain.handle("getAllInfo", async () : Promise<any> => {
  // nodes
  const namespace = "default";
  try {
    const getNodes = await k8sApiCore.listNode(namespace);
    const nodeData = getNodes.body.items.map((node) => {
      // for each node from query we spit back this object

      // using Type Assertion to create an empty object for the typed variable
      // this could potentially create inconsistencies.
      // const output: SvgInfo = {} as SvgInfo;

      // best practice might be to create a new class object with default values and set
      const output: SvgInfo = new SvgInfoObj();

      if (node.status?.allocatable !== undefined) {
        const memUsage: number = parseMem(node.status.allocatable.memory);
        output.usage = memUsage;
      }
      if (node.status?.capacity !== undefined) {
        const memLimit: number = parseMem(node.status.capacity.memory);
        output.limit = memLimit;
      }
      // (if node is truthy, and if node.metadata is truthy, and if node.metadat.name is truthy)
      if (node?.metadata?.name) output.name = node.metadata.name;
      return output;
    }); // end of nodeData
    const getPods = await k8sApiCore.listPodForAllNamespaces();
    // console.log('i am a pod ', getPods.body.items[0])
    
    const podData = getPods.body.items.map(pod => {
      const output: SvgInfo = new SvgInfoObj();

      
    })

    return nodeData;
  } catch (error) {
    return { err: error };
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
    return data.body.items
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
    console.log("THIS IS DATA ", formattedData);
    return formattedData;
  } catch (error) {
    console.log(`Error in getDeployments function: ERROR: ${error}`);
  }
});

// get services in cluster
ipcMain.handle("getServices", async (): Promise<any> => {
  try {
    const data = await k8sApiCore.listServiceForAllNamespaces();
    return formatClusterData(data);
  } catch (error) {
    console.log(`Error in getServices function: ERROR: ${error}`);
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
    // console.log('THIS IS FORMATTED PODDS ', formattedData);
    return { podNames, node, namespace };
  } catch (error) {
    return console.log(`Error in getPods function: ERROR: ${error}`);
  }
});

// get namespaces in cluster
// ipcMain.handle('getNamespaces', async () => {
//   try {
//     const data = await k8sApiCore.listNamespace();
//     const formattedData: any = data.body.items.map(pod => pod?.metadata?.name);
//     return formattedData;
//   } catch (error) {
//     console.log(`Error in getNamespaces function: ERROR: ${error}`);
//   }
// });

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

// test logs //
ipcMain.handle("getLogs", async () => {
  try {
    // change nodejs-guestbook.... to pod's name for minikube
    const response: any = await cp.execSync(
      "kubectl logs prometheus-prometheus-node-exporter-skrc5",
      { encoding: "utf-8" }
    );
    const data = response.split("\n");
    // divides each event into subarrs
    console.log("THIS IS LOGS DATA IN MAIN.JS", data);
    const trimmed: any = data.map((el: any) => el.split(/[ ]{2,}/)); // added any type here.. made split happy? whats the data we get back
    // lowercase the headers of events
    const eventHeaders = trimmed[0].map((header: any) => header.toLowerCase()); // any type because we can
    // remove headers from trimmed arr
    trimmed.shift();
    console.log("TRIMMED LOGS", trimmed);
    const formattedEvents = trimmed.map((event: any) => {
      // any type because we can
      return {
        namespace: event[0],
        lastSeen: event[1],
        severity: event[2],
        reason: event[3],
        message: event[4],
        object: event[5],
      };
    });
    return { formattedEvents, eventHeaders };
  } catch (error) {
    return console.log(`Error in getLogs function: ERROR: ${error}`); // add return statement to make async () => on line 112 happy
  }
});
// test logs //

// need to look into this
// ipcMain.handle('getLogs', async () => {
//   try {
//     const data = await cp.execSync('kubectl logs nodejs-guestbook-frontend-74f496b5cd-fc2r4', {encoding: 'utf-8'});
//     // divides each event into subarrs
//     console.log('THIS IS LOGS DATA IN MAIN.JS', data)

//     const parsed = data.toJSON();

//     const arrData = parsed.split()
//     const trimmed: any = data.map((el:any) => el.split(/[ ]{2,}/));    // added any type here.. made split happy? whats the data we get back
//     // lowercase the headers of events
//     const eventHeaders = trimmed[0].map((header:any) => header.toLowerCase()); // any type because we can
//     // remove headers from trimmed arr
//     trimmed.shift();

//     const formattedEvents = trimmed.map((event:any) => { // any type because we can
//       return {
//         namespace: event[0],
//         lastSeen: event[1],
//         severity: event[2],
//         reason: event[3],
//         message: event[4],
//         object: event[5],
//       };
//     });

//     return { formattedEvents, eventHeaders };

//   } catch (error) {
//     return console.log(`Error in getEvents function: ERROR: ${error}`); // add return statement to make async () => on line 112 happy
//   }
// });

// PROMETHEUS API //
// get memory metrics

ipcMain.handle("getLimits", async () => {
  const date = new Date();
  try {
    const query = `${PROM_URL}query_range?query=kube_pod_container_resource_requests&start=${date}&end=${date}&step=24h`;
    const data = await fetch(query);
    const jsonData = await data.json();
    return jsonData.data.result.values[0][1];
    // return console.log('THIS IS REQUEST LIMITS ', jsonData.data.result.values)
  } catch (error) {
    return { err: error };
  }
});

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

// get container resource limit
ipcMain.handle("getResourceLimits", async () => {
  const { startTime, endTime } = setStartAndEndTime();
  const interval = "1m";
  try {
    const query = `${PROM_URL}query_range?query=kube_pod_container_resource_limits{resource="memory",namespace="default"}&start=${startTime}&end=${endTime}`;
    const res = await fetch(query);
    const data = await res.json();
    return formatMatrix(data.data, "bytes");
  } catch (err) {
    return { err: err };
  }
});
// query kube_pod_container_resource_limits

// get CPU Usage by pods
// ipcMain.handle('getCPUUsageByPods', async () => {
//   const { startTime, endTime } = setStartAndEndTime();
//   // const query = `http://127.0.0.1:9090/api/v1/query_range?query=sum(container_memory_working_set_bytes{namespace="default"}) by (pod)&start=2022-09-07T05:13:25.098Z&end=2022-09-08T05:13:59.818Z&step=1m`

//   // data step interval
//   const interval = '30m';
//   try {

//     // promQL query to api/v1 endpoint
//     const query = `${PROM_URL}query_range?query=sum(container_memory_working_set_bytes{namespace="default"}) by (pod)&start=${startTime}&end=${endTime}&step=${interval}`;
//     // fetch request
//     const res = await fetch(query)
//     .then((data: any) => data.json())
//     .then((output: any) => {
//       console.log('THIS IS DATA ', output.data.result)
//       return formatMatrix(output.data.result, 'bytes')
//     })
//     .catch((error: any) => {
//       console.log(`Error in getMemoryUsageByPod function: ERROR: ${error}`);
//       return {err: error}
//     });
//     return;
//     // data.data.result returns matrix
//     // console.log('this is data ', data.result)
//     // return formatMatrix(data.data.result)

//   } catch (error) {
//     console.log(`Error in getMemoryUsageByPod function: ERROR: ${error}`);
//     return {err: error}
//   }
// });

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
