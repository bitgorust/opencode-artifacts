export interface ModeledAssetInput {
  relativeSyntax: boolean;
  contained: boolean;
  regular: boolean;
  stable: boolean;
  allowlisted: boolean;
  bytes: number;
  maxBytes: number;
  mimePrefixBytes: number;
}

export interface ModeledAssetResult {
  result: "embedded" | "refused";
  sourceBytesReturned: number;
  encodedBytes: number;
  viewTimeRequests: number;
}

export function modelAsset(input: ModeledAssetInput): ModeledAssetResult {
  const accepted = input.relativeSyntax
    && input.contained
    && input.regular
    && input.stable
    && input.allowlisted
    && input.bytes >= 0
    && input.bytes <= input.maxBytes;
  if (!accepted) return { result: "refused", sourceBytesReturned: 0, encodedBytes: 0, viewTimeRequests: 0 };
  return {
    result: "embedded",
    sourceBytesReturned: input.bytes,
    encodedBytes: input.mimePrefixBytes + 4 * Math.ceil(input.bytes / 3),
    viewTimeRequests: 0,
  };
}
