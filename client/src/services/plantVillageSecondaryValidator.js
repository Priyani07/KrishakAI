const LOCAL_MODEL_NAME = "PlantVillage Local38 MobileNetV2";
const LOCAL_MODEL_VERSION = "2026-08-23";
const INPUT_SIZE = 128;
const EXPECTED_CLASS_COUNT = 38;

const MODEL_ASSETS = Object.freeze({
  manifest: {
    url: "/manus-storage/artifact_manifest_2a78ed24.json",
    bytes: 2900,
    sha256: "782ff347f481aebf6f487f77de47e17141e0831a1c327a2d2e64529145403696",
  },
  model: {
    url: "/manus-storage/model_82239d85.json",
    bytes: 120725,
    sha256: "f19a3e0ffb686dbbfebae9ed52c0cdd93f56c29ee16a4a04b04d127b85a56f63",
  },
  labels: {
    url: "/manus-storage/class_indices_f0770a0f.json",
    bytes: 1395,
    sha256: "34df284e2554a15f82a4884be26ab22fa4198b1a16cee79dac9a9c85a050f6ef",
  },
  shards: [
    { path: "group1-shard1of3.bin", url: "/manus-storage/group1-shard1of3_81dcc5dd.bin", bytes: 4194304, sha256: "e5f5839e8e0a6817ced84b550f298aa36d6231a8d11c4e845712536f897426e2" },
    { path: "group1-shard2of3.bin", url: "/manus-storage/group1-shard2of3_23ef2470.bin", bytes: 4194304, sha256: "b72ad56c0fdd9d1fbbbe7b36a1c9d66313451cd88ba5a56b26f8d44f336e15bb" },
    { path: "group1-shard3of3.bin", url: "/manus-storage/group1-shard3of3_6693eb98.bin", bytes: 838040, sha256: "7918344c65af71c09f36a9ef406ed600458a385e9755c9a3e64829da1bff3dec" },
  ],
});

const LOCAL_LABEL_MAPPINGS = Object.freeze({
  "Tomato___Early_blight": { crop: "tomato", diagnosisId: "tomato_early_blight", kind: "disease" },
  "Tomato___Late_blight": { crop: "tomato", diagnosisId: "tomato_late_blight", kind: "disease" },
  "Potato___Late_blight": { crop: "potato", diagnosisId: "potato_late_blight", kind: "disease" },
  "Corn_(maize)___Northern_Leaf_Blight": { crop: "corn", diagnosisId: "corn_northern_leaf_blight", kind: "disease" },
  "Tomato___healthy": { crop: "tomato", diagnosisId: "healthy", kind: "healthy" },
  "Potato___healthy": { crop: "potato", diagnosisId: "healthy", kind: "healthy" },
  "Corn_(maize)___healthy": { crop: "corn", diagnosisId: "healthy", kind: "healthy" },
});

const LOCAL_COMPARABLE_DIAGNOSIS_IDS = new Set([
  "tomato_early_blight",
  "tomato_late_blight",
  "potato_late_blight",
  "corn_northern_leaf_blight",
]);

function requireBrowser(value, message) {
  if (!value) throw new Error(message);
  return value;
}

function joinBuffers(buffers) {
  const total = buffers.reduce((sum, buffer) => sum + buffer.byteLength, 0);
  const combined = new Uint8Array(total);
  let offset = 0;
  buffers.forEach((buffer) => { combined.set(new Uint8Array(buffer), offset); offset += buffer.byteLength; });
  return combined.buffer;
}

function bytesToHex(buffer) {
  return Array.from(new Uint8Array(buffer)).map((value) => value.toString(16).padStart(2, "0")).join("");
}

async function verifySha256(buffer, expected) {
  const digest = await requireBrowser(globalThis.crypto?.subtle, "Secure browser cryptography is unavailable for local model verification.").digest("SHA-256", buffer);
  if (bytesToHex(digest) !== expected) throw new Error("The local model artifact did not pass integrity verification.");
}

async function fetchVerifiedAsset(asset, fetchImpl) {
  const response = await fetchImpl(asset.url, { cache: "force-cache" });
  if (!response.ok) throw new Error("The local model artifact is temporarily unavailable.");
  const buffer = await response.arrayBuffer();
  if (typeof asset.bytes === "number" && buffer.byteLength !== asset.bytes) throw new Error("The local model artifact has an unexpected size.");
  if (asset.sha256) await verifySha256(buffer, asset.sha256);
  return buffer;
}

function parseJson(buffer, message) {
  try { return JSON.parse(new TextDecoder().decode(buffer)); } catch { throw new Error(message); }
}

function assertExactLabels(labels) {
  const keys = Object.keys(labels || {}).sort((left, right) => Number(left) - Number(right));
  if (keys.length !== EXPECTED_CLASS_COUNT || keys.some((key, index) => key !== String(index)) || new Set(Object.values(labels)).size !== EXPECTED_CLASS_COUNT) {
    throw new Error("The local model label map is invalid.");
  }
  return labels;
}

function assertModelManifest(modelJson) {
  const declaredPaths = modelJson?.weightsManifest?.flatMap((group) => group.paths || []) || [];
  const expectedPaths = MODEL_ASSETS.shards.map((asset) => asset.path);
  const inputLayer = modelJson?.modelTopology?.model_config?.config?.layers?.find((layer) => layer?.class_name === "InputLayer" && layer?.config?.name === "image");
  const inputShape = inputLayer?.config?.batch_input_shape;
  if (modelJson?.format !== "layers-model" || declaredPaths.join("|") !== expectedPaths.join("|") || JSON.stringify(inputShape) !== JSON.stringify([null, INPUT_SIZE, INPUT_SIZE, 3])) {
    throw new Error("The local model manifest does not match the validated artifact contract.");
  }
  return modelJson;
}

function assertReferenceManifest(referenceManifest) {
  const entries = new Map((referenceManifest?.artifacts || []).map((entry) => [entry.path, entry]));
  const checks = [
    ["class_indices.json", MODEL_ASSETS.labels],
    ["tfjs_model/model.json", MODEL_ASSETS.model],
    ...MODEL_ASSETS.shards.map((asset) => [`tfjs_model/${asset.path}`, asset]),
  ];
  if (checks.some(([path, asset]) => entries.get(path)?.bytes !== asset.bytes || entries.get(path)?.sha256 !== asset.sha256)) {
    throw new Error("The local model reference manifest does not match the validated artifact.");
  }
}

export function getLocalPlantVillageMapping(rawLabel) {
  return LOCAL_LABEL_MAPPINGS[rawLabel] || null;
}

export function decodeLocalPlantVillageOutput(probabilities, labels) {
  const values = Array.from(probabilities || []);
  if (values.length !== EXPECTED_CLASS_COUNT || values.some((value) => !Number.isFinite(value))) throw new Error("The local model returned an invalid output.");
  const classIndex = values.reduce((bestIndex, value, index) => (value > values[bestIndex] ? index : bestIndex), 0);
  const rawLabel = assertExactLabels(labels)[String(classIndex)];
  return {
    model: LOCAL_MODEL_NAME,
    modelVersion: LOCAL_MODEL_VERSION,
    classIndex,
    rawLabel,
    confidence: values[classIndex],
    mapping: getLocalPlantVillageMapping(rawLabel),
  };
}

export function canRunLocalSecondaryValidator(primaryResult) {
  if (!primaryResult || typeof primaryResult.crop !== "string") return false;
  if (primaryResult.status === "healthy_or_no_visible_disease") return ["tomato", "potato", "corn"].includes(primaryResult.crop);
  return primaryResult.status === "valid_leaf" && LOCAL_COMPARABLE_DIAGNOSIS_IDS.has(primaryResult.diagnosisId);
}

function primaryComparableResult(primaryResult) {
  if (!canRunLocalSecondaryValidator(primaryResult)) return null;
  return {
    crop: primaryResult.crop,
    diagnosisId: primaryResult.status === "healthy_or_no_visible_disease" ? "healthy" : primaryResult.diagnosisId,
  };
}

export function reconcilePrimaryWithLocalSecondary(primaryResult, localResult) {
  const primary = primaryComparableResult(primaryResult);
  if (!primary) return { ...primaryResult, secondaryValidation: "not_applicable" };
  if (!localResult?.mapping) return { ...primaryResult, secondaryValidation: "not_applicable" };
  const agrees = primary.crop === localResult.mapping.crop && primary.diagnosisId === localResult.mapping.diagnosisId;
  if (agrees) return { ...primaryResult, secondaryValidation: "confirmed" };
  return {
    ...primaryResult,
    status: "unknown",
    diagnosisId: "unknown",
    diagnosis: "Uncertain / conflicting results",
    uncertain: true,
    guidanceStatus: "unavailable",
    secondaryValidation: "conflict",
    note: "The image produced conflicting analysis results. Please upload a clearer image or seek expert confirmation.",
  };
}

export async function applyPlantVillageSecondaryValidation(primaryResult, file, inferLocal = inferWithPlantVillageSecondary) {
  if (!canRunLocalSecondaryValidator(primaryResult)) return { ...primaryResult, secondaryValidation: "not_applicable" };
  try {
    return reconcilePrimaryWithLocalSecondary(primaryResult, await inferLocal(file));
  } catch {
    return { ...primaryResult, secondaryValidation: "unavailable" };
  }
}

async function loadPlantVillageRuntime() {
  const tf = await import("@tensorflow/tfjs");
  let webglReady = false;
  try { webglReady = await tf.setBackend("webgl"); } catch { webglReady = false; }
  if (!webglReady) await tf.setBackend("cpu");
  await tf.ready();
  return { tf, loadLayersModel: tf.loadLayersModel };
}

async function loadValidatedPlantVillageAssets(fetchImpl = fetch) {
  const [referenceBuffer, modelBuffer, labelsBuffer, ...shardBuffers] = await Promise.all([
    fetchVerifiedAsset(MODEL_ASSETS.manifest, fetchImpl),
    fetchVerifiedAsset(MODEL_ASSETS.model, fetchImpl),
    fetchVerifiedAsset(MODEL_ASSETS.labels, fetchImpl),
    ...MODEL_ASSETS.shards.map((asset) => fetchVerifiedAsset(asset, fetchImpl)),
  ]);
  const referenceManifest = parseJson(referenceBuffer, "The local model reference manifest is invalid.");
  const modelJson = assertModelManifest(parseJson(modelBuffer, "The local model manifest is invalid."));
  const labels = assertExactLabels(parseJson(labelsBuffer, "The local model label map is invalid."));
  assertReferenceManifest(referenceManifest);
  return {
    labels,
    artifacts: {
      modelTopology: modelJson.modelTopology,
      weightSpecs: modelJson.weightsManifest.flatMap((group) => group.weights || []),
      weightData: joinBuffers(shardBuffers),
    },
  };
}

async function preparePlantVillageInput(tf, file) {
  const bitmap = await requireBrowser(globalThis.createImageBitmap, "This browser cannot prepare the local model image.")(file);
  try {
    return tf.tidy(() => tf.image.resizeBilinear(tf.browser.fromPixels(bitmap, 3).toFloat(), [INPUT_SIZE, INPUT_SIZE], true).div(127.5).sub(1).expandDims(0));
  } finally {
    bitmap.close?.();
  }
}

export function createPlantVillageSecondaryValidator({ loadRuntime = loadPlantVillageRuntime, loadAssets = loadValidatedPlantVillageAssets, prepareInput = preparePlantVillageInput } = {}) {
  let modelPromise = null;
  let loadedModel = null;

  const load = () => {
    if (!modelPromise) {
      modelPromise = Promise.all([loadRuntime(), loadAssets()])
        .then(async ([runtime, assets]) => {
          const model = await runtime.loadLayersModel({ load: async () => assets.artifacts });
          loadedModel = { ...runtime, ...assets, model };
          return loadedModel;
        })
        .catch((error) => { modelPromise = null; loadedModel = null; throw error; });
    }
    return modelPromise;
  };

  return {
    load,
    async infer(file) {
      const { tf, model, labels } = await load();
      let input = null;
      let prediction = null;
      try {
        input = await prepareInput(tf, file);
        prediction = model.predict(input);
        return decodeLocalPlantVillageOutput(await prediction.data(), labels);
      } finally {
        prediction?.dispose?.();
        input?.dispose?.();
      }
    },
    dispose() {
      const runtime = loadedModel?.tf;
      loadedModel?.model?.dispose?.();
      const memoryAfterDispose = runtime?.memory?.() || null;
      loadedModel = null;
      modelPromise = null;
      return memoryAfterDispose;
    },
    getDiagnostics() {
      return {
        loaded: Boolean(loadedModel),
        memory: loadedModel?.tf?.memory?.() || null,
      };
    },
  };
}

const sharedPlantVillageSecondaryValidator = createPlantVillageSecondaryValidator();

export function inferWithPlantVillageSecondary(file) {
  return sharedPlantVillageSecondaryValidator.infer(file);
}

export function disposePlantVillageSecondaryValidator() {
  return sharedPlantVillageSecondaryValidator.dispose();
}

export function getPlantVillageSecondaryValidatorDiagnostics() {
  return sharedPlantVillageSecondaryValidator.getDiagnostics();
}

export { EXPECTED_CLASS_COUNT, INPUT_SIZE, LOCAL_MODEL_NAME, LOCAL_MODEL_VERSION, MODEL_ASSETS };
