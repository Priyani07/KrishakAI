# Kindwise crop.health integration record

## Production boundary

Krishak Disease Detection sends the uploaded image only from the server to `POST https://crop.kindwise.com/api/v1/identification` using the server-only `KINDWISE_API_KEY` in the `Api-Key` request header. The browser never receives that key and does not call Kindwise directly. The request is a transient single-image multipart upload with a 15-second timeout. Krishak neither stores the upload nor logs the provider request, response body, or credentials.

Kindwise is the primary Disease Detection provider. The retained Gemini adapter is not invoked after a Kindwise request begins, so the application does not silently combine or override differing provider diagnoses. Missing configuration returns a safe `503`; authorization, rate-limit, timeout, malformed response, network, and provider failures return the existing generic safe service-unavailable response.

## Current verified provider identifiers

The following identifiers were observed in authorized live responses on 2026-08-22 and are the only entries currently placed in the separate provider mapping. They are not a complete Kindwise catalog or a claim of field performance.

| Provider class | Exact Kindwise ID | Live controlled-image observation | Krishak handling |
|---|---|---|---|
| Tomato crop | `c4f0d775e03dd7fd` | Tomato early blight CC BY image | Required alongside the disease ID for the reviewed mapping |
| Early blight | `a9bf74348b28ad62` | `Alternaria solani`, 0.9088 top disease probability | Maps to existing `tomato_early_blight` guidance |
| Healthy | `c35556c0c67c0591` | Healthy provider category, 0.9882 top disease probability | Recognized only by exact ID; routine-monitoring safe path |
| Potato crop | `2746768c8d99bfbb` | Potato late-blight Wikimedia sample, 0.9733 crop disease result | Required alongside the late-blight ID for the exact `potato_late_blight` mapping |
| Alternaria brown spot | `68b08da8db41ac47` | Potato PlantVillage controlled sample | Preserved as a detected but unreviewed provider condition, not relabelled |
| Corn crop | `9f2cfa1d346260e0` | Northern corn leaf blight controlled sample, 0.9900 crop probability | Required alongside the northern-leaf-blight ID for the exact `corn_northern_leaf_blight` mapping |
| Northern corn leaf blight | `8cc41a5ca8d30d4f` | Corn controlled sample, 0.9900 top disease probability | Maps only with the exact corn ID to `corn_northern_leaf_blight` |
| Late blight | `b9ec757fefb92520` | Potato controlled sample, 0.9733; tomato controlled sample, 0.9600 | Maps only with the exact potato or tomato crop IDs to their separate canonical records |

## Candidate review matrix

The table below records exact provider IDs observed through live authorized responses. `Ready` means both the exact crop/class pair and at least one named agricultural guidance source were reviewed. It does not establish field accuracy, full-catalog coverage, or an authority to reproduce provider treatment text.

| Provider crop | Provider crop ID | Provider class | Provider class ID | Candidate Krishak diagnosis | Guidance source reviewed | Ready |
|---|---|---|---|---|---|---|
| potato | `2746768c8d99bfbb` | late blight | `b9ec757fefb92520` | `potato_late_blight` | University of Minnesota Extension late blight guidance (reviewed 2021); ICAR–Central Potato Research Institute late-blight advisory archive | Yes |
| tomato | `c4f0d775e03dd7fd` | late blight | `b9ec757fefb92520` | `tomato_late_blight` | University of Minnesota Extension late blight guidance (reviewed 2021) | Yes |
| corn | `9f2cfa1d346260e0` | northern corn leaf blight | `8cc41a5ca8d30d4f` | `corn_northern_leaf_blight` | University of Delaware Cooperative Extension (October 2025); Tamil Nadu Agricultural University Turcicum Leaf Blight page | Yes |
| rice (returned on an unrelated controlled potato sample) | `528aa542ad1ff3fd` | apple scab | `ff5ec2ce5ef38282` | none | none | No — preserve unmapped |
| potato (prior controlled response) | `dcf39092de182ffc` | Alternaria brown spot | `68b08da8db41ac47` | none | none | No — preserve unmapped |
| tobacco | not live-verified | damping off / root-knot nematode | not live-verified | none | promising ICAR evidence only | No — provider class unverified |

The first three approved rows are implemented only by exact crop-and-class-ID pairing. Other valid plant/disease provider responses continue to preserve their real label, class ID, crop, and probability in the server response with `guidanceStatus: unavailable`. The generic UI then states that verified agricultural treatment guidance is unavailable and directs the user to an agricultural expert or laboratory. Provider treatment fields are intentionally neither requested nor displayed.

## Limits and privacy

Kindwise's official crop.health documentation identifies 23 listed crops and 288 health classes, but its OpenAPI does not expose a full taxonomy export. Krishak therefore makes no complete-catalog or broad field-accuracy claim. The above controlled-image requests only verify current response shape and stable IDs; they do not demonstrate on-farm diagnostic performance. Per the provider terms reviewed during implementation, submitted images and API outputs may be available by key for six months. Users should not upload sensitive images, and Krishak should retain no copy beyond the live request.

Sources: [Kindwise crop.health documentation](https://crop.kindwise.com/docs), [official OpenAPI contract](https://crop.kindwise.com/api/v1/openapi.yaml), and [Kindwise crop coverage](https://web.plant.id/plant-health-api/).
