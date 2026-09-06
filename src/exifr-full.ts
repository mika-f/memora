// exifr's official "full" bundle (both the prebuilt dist files and the raw
// `exifr/src/bundles/full.mjs` composition) pulls in `util/import.mjs`, which
// falls back to a dynamic `import(name)` call with a *variable* specifier when
// `require` is unavailable. Hermes (React Native's JS engine) cannot parse
// that expression at all - it fails with "Invalid expression encountered"
// before the app can even start, regardless of whether the branch ever runs.
//
// This module reassembles the same feature set as exifr's "full" bundle
// (everything memora's container needs: TIFF/EXIF, PNG, JFIF, IHDR, ICC,
// IPTC, plus the interop/gps/other-tag dictionaries) directly from exifr's
// individual, unbundled source modules, while leaving out the one entry
// point that pulls in `util/import.mjs`: `file-parsers/png.mjs`. In its
// place, `./exifr-png-parser.js` below provides the same PNG chunk parsing,
// minus zlib-compressed ICC profile support - a feature exifr itself already
// skips outside of Node, and one screenshot tools like VRChat/VRCX/Resonite
// don't use.
export * from "exifr/src/bundles/lite.mjs";
// eslint-disable-next-line import/no-named-as-default
import * as lite from "exifr/src/bundles/lite.mjs";
export default lite;

import "exifr/src/highlevel/sidecar.mjs";
import "exifr/src/file-readers/Base64Reader.mjs";

import "exifr/src/file-parsers/tiff.mjs";
import "exifr/src/file-parsers/heif.mjs";
import "./exifr-png-parser.js";

import "exifr/src/dicts/tiff-interop-keys.mjs";
import "exifr/src/dicts/tiff-other-keys.mjs";
import "exifr/src/dicts/tiff-gps-values.mjs";

import "exifr/src/segment-parsers/jfif.mjs";
import "exifr/src/dicts/jfif-keys.mjs";

import "exifr/src/segment-parsers/ihdr.mjs";
import "exifr/src/dicts/ihdr-keys.mjs";
import "exifr/src/dicts/ihdr-values.mjs";

import "exifr/src/segment-parsers/icc.mjs";
import "exifr/src/dicts/icc-keys.mjs";
import "exifr/src/dicts/icc-values.mjs";

import "exifr/src/segment-parsers/iptc.mjs";
import "exifr/src/dicts/iptc-keys.mjs";
import "exifr/src/dicts/iptc-values.mjs";
