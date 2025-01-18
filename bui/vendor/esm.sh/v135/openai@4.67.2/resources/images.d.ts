import { APIResource } from "../resource.d.ts";
import * as Core from "../core.d.ts";
import * as ImagesAPI from "./images.d.ts";
export declare class Images extends APIResource {
    /**
     * Creates a variation of a given image.
     */
    createVariation(body: ImageCreateVariationParams, options?: Core.RequestOptions): Core.APIPromise<ImagesResponse>;
    /**
     * Creates an edited or extended image given an original image and a prompt.
     */
    edit(body: ImageEditParams, options?: Core.RequestOptions): Core.APIPromise<ImagesResponse>;
    /**
     * Creates an image given a prompt.
     */
    generate(body: ImageGenerateParams, options?: Core.RequestOptions): Core.APIPromise<ImagesResponse>;
}
/**
 * Represents the url or the content of an image generated by the OpenAI API.
 */
export interface Image {
    /**
     * The base64-encoded JSON of the generated image, if `response_format` is
     * `b64_json`.
     */
    b64_json?: string;
    /**
     * The prompt that was used to generate the image, if there was any revision to the
     * prompt.
     */
    revised_prompt?: string;
    /**
     * The URL of the generated image, if `response_format` is `url` (default).
     */
    url?: string;
}
export type ImageModel = 'dall-e-2' | 'dall-e-3';
export interface ImagesResponse {
    created: number;
    data: Array<Image>;
}
export interface ImageCreateVariationParams {
    /**
     * The image to use as the basis for the variation(s). Must be a valid PNG file,
     * less than 4MB, and square.
     */
    image: Core.Uploadable;
    /**
     * The model to use for image generation. Only `dall-e-2` is supported at this
     * time.
     */
    model?: (string & {}) | ImageModel | null;
    /**
     * The number of images to generate. Must be between 1 and 10. For `dall-e-3`, only
     * `n=1` is supported.
     */
    n?: number | null;
    /**
     * The format in which the generated images are returned. Must be one of `url` or
     * `b64_json`. URLs are only valid for 60 minutes after the image has been
     * generated.
     */
    response_format?: 'url' | 'b64_json' | null;
    /**
     * The size of the generated images. Must be one of `256x256`, `512x512`, or
     * `1024x1024`.
     */
    size?: '256x256' | '512x512' | '1024x1024' | null;
    /**
     * A unique identifier representing your end-user, which can help OpenAI to monitor
     * and detect abuse.
     * [Learn more](https://platform.openai.com/docs/guides/safety-best-practices/end-user-ids).
     */
    user?: string;
}
export interface ImageEditParams {
    /**
     * The image to edit. Must be a valid PNG file, less than 4MB, and square. If mask
     * is not provided, image must have transparency, which will be used as the mask.
     */
    image: Core.Uploadable;
    /**
     * A text description of the desired image(s). The maximum length is 1000
     * characters.
     */
    prompt: string;
    /**
     * An additional image whose fully transparent areas (e.g. where alpha is zero)
     * indicate where `image` should be edited. Must be a valid PNG file, less than
     * 4MB, and have the same dimensions as `image`.
     */
    mask?: Core.Uploadable;
    /**
     * The model to use for image generation. Only `dall-e-2` is supported at this
     * time.
     */
    model?: (string & {}) | ImageModel | null;
    /**
     * The number of images to generate. Must be between 1 and 10.
     */
    n?: number | null;
    /**
     * The format in which the generated images are returned. Must be one of `url` or
     * `b64_json`. URLs are only valid for 60 minutes after the image has been
     * generated.
     */
    response_format?: 'url' | 'b64_json' | null;
    /**
     * The size of the generated images. Must be one of `256x256`, `512x512`, or
     * `1024x1024`.
     */
    size?: '256x256' | '512x512' | '1024x1024' | null;
    /**
     * A unique identifier representing your end-user, which can help OpenAI to monitor
     * and detect abuse.
     * [Learn more](https://platform.openai.com/docs/guides/safety-best-practices/end-user-ids).
     */
    user?: string;
}
export interface ImageGenerateParams {
    /**
     * A text description of the desired image(s). The maximum length is 1000
     * characters for `dall-e-2` and 4000 characters for `dall-e-3`.
     */
    prompt: string;
    /**
     * The model to use for image generation.
     */
    model?: (string & {}) | ImageModel | null;
    /**
     * The number of images to generate. Must be between 1 and 10. For `dall-e-3`, only
     * `n=1` is supported.
     */
    n?: number | null;
    /**
     * The quality of the image that will be generated. `hd` creates images with finer
     * details and greater consistency across the image. This param is only supported
     * for `dall-e-3`.
     */
    quality?: 'standard' | 'hd';
    /**
     * The format in which the generated images are returned. Must be one of `url` or
     * `b64_json`. URLs are only valid for 60 minutes after the image has been
     * generated.
     */
    response_format?: 'url' | 'b64_json' | null;
    /**
     * The size of the generated images. Must be one of `256x256`, `512x512`, or
     * `1024x1024` for `dall-e-2`. Must be one of `1024x1024`, `1792x1024`, or
     * `1024x1792` for `dall-e-3` models.
     */
    size?: '256x256' | '512x512' | '1024x1024' | '1792x1024' | '1024x1792' | null;
    /**
     * The style of the generated images. Must be one of `vivid` or `natural`. Vivid
     * causes the model to lean towards generating hyper-real and dramatic images.
     * Natural causes the model to produce more natural, less hyper-real looking
     * images. This param is only supported for `dall-e-3`.
     */
    style?: 'vivid' | 'natural' | null;
    /**
     * A unique identifier representing your end-user, which can help OpenAI to monitor
     * and detect abuse.
     * [Learn more](https://platform.openai.com/docs/guides/safety-best-practices/end-user-ids).
     */
    user?: string;
}
export declare namespace Images {
    export import Image = ImagesAPI.Image;
    export import ImageModel = ImagesAPI.ImageModel;
    export import ImagesResponse = ImagesAPI.ImagesResponse;
    export import ImageCreateVariationParams = ImagesAPI.ImageCreateVariationParams;
    export import ImageEditParams = ImagesAPI.ImageEditParams;
    export import ImageGenerateParams = ImagesAPI.ImageGenerateParams;
}
//# sourceMappingURL=images.d.ts.map
