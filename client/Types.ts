export type SvgInfo = {
  // for properties that dont exist in pod, node, cluster or deployment give it a 0 for num or '' for string
  name: string; // name of pod, node, or cluster, or deployment
  usage: number; // pods: memory used in bytes -- node: "memory requested" field from k8 (kibibytes)
  resource: string; // default should be memory. if a pod tracks cpu it will overwrite
  unit?: string; // either megabytes or milicores
  request: number; // pods: request memory in bytes -- node: 0 (node does not have same type of "request" memory as pods)
  limit: number; // pods: limit memory in bytes -- node: "memory allocatable" field from k8 (kibibytes)
  parent: string; // pod: node name -- node: cluster name
  namespace: string; // the namespace of a pod, or n/a for node
};

export class SvgInfoObj implements SvgInfo {
  constructor() {
    // set default values for each prop
    // number defaults are set to 1 (instead of) to avoid divide by 0 issues
    this.name = '';
    this.usage = 1;
    this.resource = 'memory';
    this.request = 1;
    this.limit = 1;
    this.parent = '';
    this.namespace = '';
  }

  name: string; // name of pod, node, or cluster, or deployment
  usage: number; // pods: memory used in bytes -- node: "memory requested" field from k8 (kibibytes)
  resource: string; // default should be memory. if a pod tracks cpu it will overwrite
  unit?: string; // either megabytes or milicores
  request: number; // pods: request memory in bytes -- node: 0 (node does not have same type of "request" memory as pods)
  limit: number; // pods: limit memory in bytes -- node: "memory allocatable" field from k8 (kibibytes)
  parent: string; // pod: node name -- node: cluster name
  namespace: string; // the namespace of a pod, or n/a for node
}

export type Lulu = {
  Clusters: SvgInfo[];
  Nodes: SvgInfo[];
  Pods: SvgInfo[];
  Deployments: SvgInfo[];
};

export interface ModalProps extends SvgInfo {
  position: { left: string; top: string };
  close: () => void;
}
//--------------------------------Types for Cluster Chart----------------------------------------------------

export interface ClusterChartProps extends Lulu {
  close: () => void;
  click: (e: any, input: SvgInfo) => void;
}

export type ClusterChartCardProps = {
  title: string; // Cluster, or Pod, or Node, or Deployment
  data: SvgInfo[];
  click: (e: any, input: SvgInfo) => void;
  close: () => void;
};

//--------------------------------Types for the right side and alerts/events ----------------------------------------------------

export type EventProps = {
  handleAnalyzeUpdate: (input: any) => void;
  setAnalyze: (input: any) => void;
  analyze: any[];
  // getAnalyzeLength: () => [];
};

export type AnalyzeCount = any[];

export interface LogCardProps {
  eventObj?: EventObject;
  alertObj?: AlertObject;
  oomObj?: oomObject;
  logType: string;
  // addToAnalyze: (input1: {}) => void;
  handleAnalyzeUpdate: (input: any) => void;
}

export type EventObject = {
  namespace: string;
  lastSeen: string;
  severity: string;
  reason: string;
  message: string;
  object: string;
};

export type AlertObject = {
  group: string;
  state: string;
  name: string;
  severity: string;
  description: string;
  summary: string;
  alerts: string;
};

// export type oomObject = {
//   group: string;
//   state: string;
//   name: string;
//   severity: string;
//   description: string;
//   summary: string;
//   alerts: string;
// };

export type oomObject = {
  namespace: string;
  podName: string;
  laststate: string;
  restartcount: string;
  reason: string;
  exitcode: string;
  started: string;
  finished: string;
  ready: string;
  limits: LimOrReq;
  requests: LimOrReq;
};

export type LimOrReq = {
  limitCpu: string;
  limitMemory: string;
};

// export type newObj = {
//   lastState: string;
//   reason: string;
//   exitCode: string;
//   started: string;
//   finished: string;
//   ready: string;
//   restartCount: string;
//   limits: LimOrReq;
//   requests: LimOrReq;
// };

//--------------------------------Types for Graphs----------------------------------------------------
export type GraphData = {
  [podName: string]: {
    times: string[];
    values: number[];
  };
}[];

export type ChartGraphData = {
  nodeMem: GraphData;
  nodeCPU: GraphData;
  podMem: GraphData;
  podCPU: GraphData;
};

export type GraphableData = {
  label: string;
  backgroundColor: string;
  borderColor: string;
  data: number[];
};

//--------------------------------Types for Analysis Page----------------------------------------------------

export type AnalysisPage = {
  analyze: any[];
  setAnalyze: (input: any) => void;
};

export type AnalysisPageProps = {
  setAnalyze: (input: any) => void;
  analyze: any[];
};
