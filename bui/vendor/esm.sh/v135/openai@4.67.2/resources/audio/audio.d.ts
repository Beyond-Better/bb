import { APIResource } from "../../resource.d.ts";
import * as AudioAPI from "./audio.d.ts";
import * as SpeechAPI from "./speech.d.ts";
import * as TranscriptionsAPI from "./transcriptions.d.ts";
import * as TranslationsAPI from "./translations.d.ts";
export declare class Audio extends APIResource {
    transcriptions: TranscriptionsAPI.Transcriptions;
    translations: TranslationsAPI.Translations;
    speech: SpeechAPI.Speech;
}
export type AudioModel = 'whisper-1';
/**
 * The format of the output, in one of these options: `json`, `text`, `srt`,
 * `verbose_json`, or `vtt`.
 */
export type AudioResponseFormat = 'json' | 'text' | 'srt' | 'verbose_json' | 'vtt';
export declare namespace Audio {
    export import AudioModel = AudioAPI.AudioModel;
    export import AudioResponseFormat = AudioAPI.AudioResponseFormat;
    export import Transcriptions = TranscriptionsAPI.Transcriptions;
    export import Transcription = TranscriptionsAPI.Transcription;
    export import TranscriptionSegment = TranscriptionsAPI.TranscriptionSegment;
    export import TranscriptionVerbose = TranscriptionsAPI.TranscriptionVerbose;
    export import TranscriptionWord = TranscriptionsAPI.TranscriptionWord;
    export import TranscriptionCreateResponse = TranscriptionsAPI.TranscriptionCreateResponse;
    type TranscriptionCreateParams<ResponseFormat extends AudioAPI.AudioResponseFormat | undefined = AudioAPI.AudioResponseFormat | undefined> = TranscriptionsAPI.TranscriptionCreateParams<ResponseFormat>;
    export import Translations = TranslationsAPI.Translations;
    export import Translation = TranslationsAPI.Translation;
    export import TranslationVerbose = TranslationsAPI.TranslationVerbose;
    export import TranslationCreateResponse = TranslationsAPI.TranslationCreateResponse;
    type TranslationCreateParams<ResponseFormat extends AudioAPI.AudioResponseFormat | undefined = AudioAPI.AudioResponseFormat | undefined> = TranslationsAPI.TranslationCreateParams<ResponseFormat>;
    export import Speech = SpeechAPI.Speech;
    export import SpeechModel = SpeechAPI.SpeechModel;
    export import SpeechCreateParams = SpeechAPI.SpeechCreateParams;
}
//# sourceMappingURL=audio.d.ts.map
