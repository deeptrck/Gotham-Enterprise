# Gotham AWS Model Integration Contract

## Purpose

Gotham treats the proprietary AWS model as the only production verification provider. The application must not silently route customer media to Reality Defender or another temporary third-party service when the AWS model is unavailable.

## Required configuration

| Variable | Required | Description |
|---|---:|---|
| `SAGEMAKER_ENDPOINT_NAME` | Yes | Deployed SageMaker real-time endpoint name |
| `SAGEMAKER_REGION` or `AWS_REGION` | Yes | AWS region used to invoke the endpoint |
| `GOTHAM_MODEL_NAME` | Recommended | Human-readable model identifier returned in results |
| `GOTHAM_MODEL_VERSION` | Recommended | Release/version label for audit and reproducibility |
| `GOTHAM_MODEL_S3_URI` | Optional metadata | S3 URI of the model artifact used by the SageMaker deployment |
| `GOTHAM_MODEL_TIMEOUT_MS` | Recommended | Maximum invocation time before a safe failure; default should remain bounded |

The SageMaker execution role and network permissions are provisioned by Vontech. Gotham uses the AWS SDK default credential chain and does not store access keys in the repository.

## Request contract

The current Gotham adapter sends the uploaded media bytes directly to SageMaker:

```text
Content-Type: original media MIME type
Accept: application/json
Body: raw media bytes
```

Supported application media types are image, video, and audio. Video requests are sampled into bounded frames by the application before model invocation unless the deployed endpoint explicitly supports native video payloads.

## Response contract

The endpoint must return a JSON object. The adapter accepts the following compatible fields:

```json
{
  "label": "REAL | FAKE | UNCERTAIN",
  "score": 0.0,
  "confidence": 0.0,
  "model": "gotham-core",
  "version": "2026.08.01",
  "request_id": "optional",
  "metadata": {}
}
```

The adapter also accepts `verdict`, `status`, `is_deepfake`, `manipulation_score`, `fake_probability`, and `confidence_score` aliases to support the initial Vontech model release. Scores may be expressed as either `0..1` or `0..100`; Gotham normalizes them to `0..1` and clamps invalid values.

## Application behavior

When the endpoint is not configured, the scan API returns HTTP `503` before charging credits. When invocation fails after a credit is charged, Gotham returns a safe model-unavailable error and refunds the credit. The application records model name, version, normalized label, score, confidence, and raw model metadata in the verification result for audit and debugging.

A model result is mapped to the product verdicts as follows:

| Model label | Gotham verdict |
|---|---|
| `FAKE`, `DEEPFAKE`, `MANIPULATED` | `DEEPFAKE` |
| `REAL`, `AUTHENTIC`, `GENUINE` | `AUTHENTIC` |
| `UNCERTAIN` or unknown | `SUSPICIOUS` |

## Vontech acceptance checklist

Vontech should provide the endpoint name, region, model artifact S3 URI, IAM execution role, supported MIME types, request size limits, response schema, timeout expectation, and whether the endpoint supports synchronous real-time invocation.

Before production traffic is enabled, the engineering team must test authentic, manipulated, ambiguous, malformed, oversized, and unavailable-endpoint cases. The test must verify that no third-party detector is invoked, no credentials or media bytes are logged, credits are refunded after failed invocation, and every result contains a model name and version.
