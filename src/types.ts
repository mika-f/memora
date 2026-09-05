export type PhotoInput = ArrayBuffer | Uint8Array;

export type Vector3 = [number, number, number];

export type Quaternion = [number, number, number, number];

/** Unrecognized source fields, retained at the level where they appeared. */
export type ExtraFields = { extra: Record<string, unknown> };

type ImageBase = ExtraFields & { raw: Uint8Array };

export type VrcxUser = ExtraFields & { id?: string; displayName?: string };

export type VrcxWorld = ExtraFields & { id?: string; name?: string; instanceId?: string };

export type VrcxImageMetadata = ImageBase & {
  type: "VRCX";
  application: "VRCX";
  version?: number;
  author?: VrcxUser;
  world?: VrcxWorld;
  players?: VrcxUser[];
};

export type VRChatImageMetadata = ImageBase & {
  type: "VRChat";
  creatorTool: "VRChat";
  /** Original xmp:Author. Old screenshots contain the user ID here. */
  author?: string;
  authorId?: string;
  worldId?: string;
  worldDisplayName?: string;
  /** Original vrc:World, used by the legacy format. */
  world?: string;
  createDate?: string;
  modifyDate?: string;
  dateTime?: string;
  title?: Array<{ value: string; language?: string }>;
};

export type ResoniteUser = ExtraFields & { id?: string; name?: string; machineId?: string };

export type ResoniteUserInfo = ResoniteUser & {
  isInVR?: boolean;
  isPresent?: boolean;
  headPosition?: Vector3;
  headOrientation?: Quaternion;
  sessionJoinTimestamp?: string;
};

export type ResoniteScreenshotExtensionsImageMetadata = ImageBase & {
  type: "ResoniteScreenshotExtensions";
  cameraManufacturer: "Resonite";
  locationName?: string;
  locationAccessLevel?: string;
  locationHiddenFromListing?: boolean;
  locationHost?: ResoniteUser;
  timeTaken?: string;
  takenBy?: ResoniteUser;
  takenGlobalPosition?: Vector3;
  takenGlobalRotation?: Quaternion;
  takenGlobalScale?: Vector3;
  appVersion?: string;
  cameraModel?: string;
  cameraFOV?: number;
  is360?: boolean;
  stereoLayout?: string;
  userInfos?: ResoniteUserInfo[];
};

export type ImageMetadata =
  | VrcxImageMetadata
  | VRChatImageMetadata
  | ResoniteScreenshotExtensionsImageMetadata;
