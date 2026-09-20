/** One subscription-backed image request, independent of the calling harness. */
export interface ImageGenerationRequest {
  output_path: string;
  prompt: string;
  quality?: "auto" | "low" | "medium" | "high";
  reference_images?: string[];
  size?: string;
}

export interface GeneratedImage {
  billing: "chatgpt_subscription";
  height: number;
  path: string;
  width: number;
}

export const GENERATE_IMAGE = "generateImage";
export const IMAGE_GENERATION_TIMEOUT_MS = 600_000;
export const IMAGE_GENERATION_DESCRIPTION =
  "Generate one PNG image or a reference-guided edit using the owner's ChatGPT subscription, regardless of the calling model or harness. " +
  "Use for requested photos, illustrations, textures, and raster assets. Pass previous images as reference_images and describe what to preserve or change. " +
  "Saves on the calling session's machine; returns the absolute path and actual dimensions. Display it with show_image. " +
  "Requires that machine's OpenCode ChatGPT OAuth login; never uses API-key billing or another provider. Does not expose an image-model selector. For SVGs, icons, or code-native graphics, edit source instead.";
