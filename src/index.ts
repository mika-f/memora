import { readMetadataContainer } from "./container.js";
import type {
  ImageMetadata,
  PhotoInput,
  VrcxUser,
  VrcxWorld,
  ResoniteUser,
  ResoniteUserInfo,
  Vector3,
  Quaternion,
} from "./types.js";
export type * from "./types.js";

type Fields = Record<string, unknown>;

const object = (value: unknown): Fields | undefined =>
  value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Fields)
    : undefined;

const list = (value: unknown): unknown[] =>
  value === undefined ? [] : Array.isArray(value) ? value : [value];

const string = (value: unknown): string | undefined =>
  typeof value === "string" ? value : undefined;

const number = (value: unknown): number | undefined => {
  if (typeof value !== "number" && (typeof value !== "string" || !value.trim())) return undefined;
  const result = Number(value);
  return Number.isFinite(result) ? result : undefined;
};

const boolean = (value: unknown): boolean | undefined =>
  value === true || value === "true"
    ? true
    : value === false || value === "false"
      ? false
      : undefined;

const vector = (value: unknown): number[] | undefined => {
  if (typeof value !== "string" || !/^\[[^\[\]]+\]$/.test(value)) return undefined;
  const parts = value.slice(1, -1).split(";").map(number);
  return parts.every((part): part is number => part !== undefined) ? parts : undefined;
};

const vector3 = (value: unknown): Vector3 | undefined => {
  const v = vector(value);
  return v?.length === 3 ? [v[0], v[1], v[2]] : undefined;
};

const quaternion = (value: unknown): Quaternion | undefined => {
  const v = vector(value);
  return v?.length === 4 ? [v[0], v[1], v[2], v[3]] : undefined;
};

const name = (value: unknown): string | undefined => {
  if (typeof value !== "string") return undefined;
  let result = value;

  // ResoniteScreenshotExtensions escapes names as JSON string contents and URI text.
  try {
    result = JSON.parse(`"${result}"`);
  } catch {
    /* Already readable text. */
  }

  try {
    result = decodeURIComponent(result);
  } catch {
    /* Literal percent sign. */
  }
  return result;
};

// Recognized fields that cannot be decoded remain in extra instead of disappearing.
const fields = (source: Fields) => {
  const extra = { ...source };
  const get = <T>(key: string, decode: (value: unknown) => T | undefined): T | undefined => {
    const result = decode(source[key]);
    if (result !== undefined) delete extra[key];
    return result;
  };
  return { extra, get };
};

const compact = <T extends object>(value: T): T => {
  for (const key of Object.keys(value) as Array<keyof T>)
    if (value[key] === undefined) delete value[key];

  return value;
};

const users =
  <T>(decode: (input: unknown) => T | undefined) =>
  (input: unknown): T[] | undefined => {
    if (!Array.isArray(input)) return undefined;

    const values = input.map(decode);
    return values.every((value): value is T => value !== undefined) ? values : undefined;
  };

const vrcxUser = (input: unknown): VrcxUser | undefined => {
  const source = object(input);
  if (!source) return undefined;

  const { get, extra } = fields(source);
  return compact({ id: get("id", string), displayName: get("displayName", string), extra });
};

const vrcxWorld = (input: unknown): VrcxWorld | undefined => {
  const source = object(input);
  if (!source) return undefined;

  const { get, extra } = fields(source);
  return compact({
    id: get("id", string),
    name: get("name", string),
    instanceId: get("instanceId", string),
    extra,
  });
};

/** Flatten XML attribute syntax only; keep namespace prefixes to avoid name collisions. */
const xmlFields = (input: unknown): Fields =>
  Object.fromEntries(
    Object.entries(object(input) ?? {})
      .filter(([key]) => key !== "#text" && !key.startsWith("@_xmlns") && key !== "@_rdf:about")
      .map(([key, value]) => [key.startsWith("@_") ? key.slice(2) : key, value]),
  );

const scalar = (value: unknown): string | undefined =>
  string(value) ?? string(object(value)?.["#text"]);

const resoniteUser = (input: unknown): ResoniteUser | undefined => {
  if (!object(input)) return undefined;

  const { get, extra } = fields(xmlFields(input));
  return compact({
    id: get("rse:U-Id", scalar),
    name: get("rse:U-Name", name),
    machineId: get("rse:U-MachineId", scalar),
    extra,
  });
};

const resoniteUserInfo = (input: unknown): ResoniteUserInfo | undefined => {
  const user = resoniteUser(input);
  if (!user) return undefined;
  const { get, extra } = fields(user.extra);
  return compact({
    ...user,
    isInVR: get("rse:UI-IsInVR", boolean),
    isPresent: get("rse:UI-IsPresent", boolean),
    headPosition: get("rse:UI-HeadPosition", vector3),
    headOrientation: get("rse:UI-HeadOrientation", quaternion),
    sessionJoinTimestamp: get("rse:UI-SessionJoinTimestamp", scalar),
    extra,
  });
};

const title = (input: unknown): Array<{ value: string; language?: string }> | undefined => {
  if (typeof input === "string") return [{ value: input }];
  const entries = object(object(input)?.["rdf:Alt"])?.["rdf:li"];
  if (entries === undefined) return undefined;
  return list(entries).map((item) =>
    compact({ value: scalar(item) ?? "", language: string(object(item)?.["@_xml:lang"]) }),
  );
};

/** Read every recognized packet without dropping coexisting formats. Unknown formats return an empty array. */
export const parseAllImageMetadata = async (input: PhotoInput): Promise<ImageMetadata[]> => {
  const container = await readMetadataContainer(input);
  if (!container) return [];

  const raw = container.raw;
  const result: ImageMetadata[] = [];

  for (const chunk of container.itxt) {
    const source = object(chunk.data);
    if (chunk.keyword !== "Description" || source?.application !== "VRCX") continue;

    const { get, extra } = fields(source);
    delete extra.application;
    result.push(
      compact({
        type: "VRCX",
        raw,
        application: "VRCX",
        version: get("version", number),
        author: get("author", vrcxUser),
        world: get("world", vrcxWorld),
        players: get("players", users(vrcxUser)),
        extra,
      }),
    );
  }

  for (const packet of container.xmp) {
    const root = object(packet.data?.["x:xmpmeta"]) ?? packet.data;
    const rdf = object(root?.["rdf:RDF"]);
    const descriptions = list(rdf?.["rdf:Description"]).map(xmlFields);
    const source: Fields = {};

    for (const description of descriptions) {
      for (const [key, value] of Object.entries(description)) {
        if (key in source) source[key] = [...list(source[key]), value];
        else source[key] = value;
      }
    }

    const { get, extra } = fields(source);
    if (source["xmp:CreatorTool"] === "VRChat") {
      delete extra["xmp:CreatorTool"];
      result.push(
        compact({
          type: "VRChat",
          raw,
          creatorTool: "VRChat",
          author: get("xmp:Author", scalar),
          authorId: get("vrc:AuthorID", scalar),
          worldId: get("vrc:WorldID", scalar),
          worldDisplayName: get("vrc:WorldDisplayName", scalar),
          world: get("vrc:World", scalar),
          createDate: get("xmp:CreateDate", scalar),
          modifyDate: get("xmp:ModifyDate", scalar),
          dateTime: get("tiff:DateTime", scalar),
          title: get("dc:title", title),
          extra,
        }),
      );
    } else if (source["rse:CameraManufacturer"] === "Resonite") {
      delete extra["rse:CameraManufacturer"];
      result.push(
        compact({
          type: "ResoniteScreenshotExtensions",
          raw,
          cameraManufacturer: "Resonite",
          locationName: get("rse:LocationName", name),
          locationAccessLevel: get("rse:LocationAccessLevel", scalar),
          locationHiddenFromListing: get("rse:LocationHiddenFromListing", boolean),
          locationHost: get("rse:LocationHost", resoniteUser),
          timeTaken: get("rse:TimeTaken", scalar),
          takenBy: get("rse:TakenBy", resoniteUser),
          takenGlobalPosition: get("rse:TakenGlobalPosition", vector3),
          takenGlobalRotation: get("rse:TakenGlobalRotation", quaternion),
          takenGlobalScale: get("rse:TakenGlobalScale", vector3),
          appVersion: get("rse:AppVersion", scalar),
          cameraModel: get("rse:CameraModel", scalar),
          cameraFOV: get("rse:CameraFOV", number),
          is360: get("rse:Is360", boolean),
          stereoLayout: get("rse:StereoLayout", scalar),
          userInfos: get("rse:UserInfos", (value) => {
            const infos = object(value)?.["rse:UserInfo"];
            return infos === undefined ? undefined : users(resoniteUserInfo)(list(infos));
          }),
          extra,
        }),
      );
    }
  }

  const priority: Record<ImageMetadata["type"], number> = {
    VRChat: 0,
    VRCX: 1,
    ResoniteScreenshotExtensions: 2,
  };

  // A screenshot can contain metadata written by more than one application.
  // Keep duplicate records and their relative order, but expose the supported
  // format precedence consistently to callers.
  return result
    .map((metadata, index) => ({ metadata, index }))
    .sort((a, b) => priority[a.metadata.type] - priority[b.metadata.type] || a.index - b.index)
    .map(({ metadata }) => metadata);
};

/** Prefer VRChat, then VRCX, then ResoniteScreenshotExtensions for mixed images. */
export const parseImageMetadata = async (input: PhotoInput): Promise<ImageMetadata | null> => {
  const results = await parseAllImageMetadata(input);
  return results[0] ?? null;
};

/** Alias for existing callers. */
export const parsePhotoMetadata = parseImageMetadata;
