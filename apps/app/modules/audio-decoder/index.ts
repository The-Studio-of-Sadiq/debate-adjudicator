import { requireOptionalNativeModule } from 'expo';

interface AudioDecoderModule {
  /**
   * Decode any audio file Android can play (m4a/AAC, webm, …) into a 16 kHz
   * mono 16-bit WAV, the input whisper.cpp expects. Resolves with the
   * duration in milliseconds.
   */
  decodeToWav16k(inputUri: string, outputUri: string): Promise<number>;
}

/** Null where the native module isn't built in (web, Windows, Expo Go). */
export default requireOptionalNativeModule<AudioDecoderModule>('AudioDecoder');
