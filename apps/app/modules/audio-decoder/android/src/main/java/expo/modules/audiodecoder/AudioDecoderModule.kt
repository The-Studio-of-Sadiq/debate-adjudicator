package expo.modules.audiodecoder

import android.media.AudioFormat
import android.media.MediaCodec
import android.media.MediaExtractor
import android.media.MediaFormat
import android.net.Uri
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.io.File
import java.io.RandomAccessFile
import java.nio.ByteBuffer
import java.nio.ByteOrder
import kotlin.math.floor

private const val TARGET_RATE = 16000
private const val TIMEOUT_US = 10_000L

/**
 * whisper.cpp only reads 16 kHz PCM WAV, but Android records AAC (.m4a).
 * This decodes with the platform's MediaCodec, mixes to mono and resamples.
 */
class AudioDecoderModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("AudioDecoder")

    AsyncFunction("decodeToWav16k") { inputUri: String, outputUri: String ->
      decodeToWav16k(toPath(inputUri), toPath(outputUri))
    }
  }

  private fun toPath(uri: String): String =
    if (uri.startsWith("file://")) Uri.parse(uri).path ?: uri.removePrefix("file://") else uri

  private fun decodeToWav16k(input: String, output: String): Double {
    val extractor = MediaExtractor()
    extractor.setDataSource(input)
    var format: MediaFormat? = null
    for (i in 0 until extractor.trackCount) {
      val f = extractor.getTrackFormat(i)
      if (f.getString(MediaFormat.KEY_MIME)?.startsWith("audio/") == true) {
        extractor.selectTrack(i)
        format = f
        break
      }
    }
    if (format == null) {
      extractor.release()
      throw IllegalArgumentException("No audio track in $input")
    }

    val codec = MediaCodec.createDecoderByType(format.getString(MediaFormat.KEY_MIME)!!)
    codec.configure(format, null, null, 0)
    codec.start()

    var channels = format.getInteger(MediaFormat.KEY_CHANNEL_COUNT)
    var encoding = AudioFormat.ENCODING_PCM_16BIT
    val resampler = Resampler(format.getInteger(MediaFormat.KEY_SAMPLE_RATE), TARGET_RATE)

    val outFile = File(output)
    outFile.parentFile?.mkdirs()
    val out = RandomAccessFile(outFile, "rw")
    out.setLength(0)
    out.write(ByteArray(44)) // header is filled in once the size is known
    var dataBytes = 0L

    try {
      val info = MediaCodec.BufferInfo()
      var inputDone = false
      var outputDone = false
      while (!outputDone) {
        if (!inputDone) {
          val inIdx = codec.dequeueInputBuffer(TIMEOUT_US)
          if (inIdx >= 0) {
            val buf = codec.getInputBuffer(inIdx)!!
            val size = extractor.readSampleData(buf, 0)
            if (size < 0) {
              codec.queueInputBuffer(inIdx, 0, 0, 0, MediaCodec.BUFFER_FLAG_END_OF_STREAM)
              inputDone = true
            } else {
              codec.queueInputBuffer(inIdx, 0, size, extractor.sampleTime, 0)
              extractor.advance()
            }
          }
        }

        val outIdx = codec.dequeueOutputBuffer(info, TIMEOUT_US)
        if (outIdx == MediaCodec.INFO_OUTPUT_FORMAT_CHANGED) {
          val f = codec.outputFormat
          channels = f.getInteger(MediaFormat.KEY_CHANNEL_COUNT)
          resampler.sourceRate = f.getInteger(MediaFormat.KEY_SAMPLE_RATE)
          if (f.containsKey(MediaFormat.KEY_PCM_ENCODING)) encoding = f.getInteger(MediaFormat.KEY_PCM_ENCODING)
        } else if (outIdx >= 0) {
          if (info.size > 0) {
            val buf = codec.getOutputBuffer(outIdx)!!
            buf.position(info.offset)
            buf.limit(info.offset + info.size)
            val mono = toMono(buf.slice().order(ByteOrder.nativeOrder()), channels, encoding)
            val samples = resampler.process(mono)
            val bytes = ByteBuffer.allocate(samples.size * 2).order(ByteOrder.LITTLE_ENDIAN)
            for (s in samples) bytes.putShort((s.coerceIn(-1f, 1f) * 32767f).toInt().toShort())
            out.write(bytes.array())
            dataBytes += bytes.capacity()
          }
          codec.releaseOutputBuffer(outIdx, false)
          if (info.flags and MediaCodec.BUFFER_FLAG_END_OF_STREAM != 0) outputDone = true
        }
      }
      out.seek(0)
      out.write(wavHeader(dataBytes))
    } finally {
      out.close()
      codec.stop()
      codec.release()
      extractor.release()
    }
    return dataBytes / 2.0 / TARGET_RATE * 1000.0
  }

  private fun toMono(buf: ByteBuffer, channels: Int, encoding: Int): FloatArray {
    val ch = channels.coerceAtLeast(1)
    return if (encoding == AudioFormat.ENCODING_PCM_FLOAT) {
      val fb = buf.asFloatBuffer()
      FloatArray(fb.remaining() / ch) { i ->
        var sum = 0f
        for (c in 0 until ch) sum += fb.get(i * ch + c)
        sum / ch
      }
    } else {
      val sb = buf.asShortBuffer()
      FloatArray(sb.remaining() / ch) { i ->
        var sum = 0f
        for (c in 0 until ch) sum += sb.get(i * ch + c) / 32768f
        sum / ch
      }
    }
  }

  private fun wavHeader(dataBytes: Long): ByteArray {
    val b = ByteBuffer.allocate(44).order(ByteOrder.LITTLE_ENDIAN)
    b.put("RIFF".toByteArray()); b.putInt((36 + dataBytes).toInt()); b.put("WAVE".toByteArray())
    b.put("fmt ".toByteArray()); b.putInt(16); b.putShort(1); b.putShort(1)
    b.putInt(TARGET_RATE); b.putInt(TARGET_RATE * 2); b.putShort(2); b.putShort(16)
    b.put("data".toByteArray()); b.putInt(dataBytes.toInt())
    return b.array()
  }
}

/** Streaming linear-interpolation resampler; state carries across chunks. */
private class Resampler(var sourceRate: Int, private val targetRate: Int) {
  /** Read position in source samples, relative to the start of the next chunk (may be -1..0). */
  private var pos = 0.0
  private var last = 0f

  fun process(input: FloatArray): FloatArray {
    if (input.isEmpty()) return FloatArray(0)
    val step = sourceRate.toDouble() / targetRate
    val result = FloatArray(((input.size - pos) / step).toInt() + 2)
    var count = 0
    while (pos < input.size - 1) {
      val i0 = floor(pos).toInt()
      val frac = (pos - i0).toFloat()
      val a = if (i0 < 0) last else input[i0]
      val b = input[i0 + 1]
      result[count++] = a + (b - a) * frac
      pos += step
    }
    pos -= input.size
    last = input[input.size - 1]
    return result.copyOf(count)
  }
}
