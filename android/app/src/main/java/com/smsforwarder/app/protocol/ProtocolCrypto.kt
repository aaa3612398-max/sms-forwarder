package com.smsforwarder.app.protocol

import org.json.JSONObject
import java.util.Base64
import java.security.spec.AlgorithmParameterSpec
import javax.crypto.Cipher
import javax.crypto.Mac
import javax.crypto.spec.GCMParameterSpec
import javax.crypto.spec.SecretKeySpec

object ProtocolCrypto {
    private const val HKDF_INFO = "sms-forwarder-v1"
    private const val PROTOCOL_VERSION = 1
    private const val NONCE_LEN = 12
    private const val KEY_LEN = 32
    private const val TAG_LEN = 128

    data class SmsPayload(
        val id: String,
        val sender: String,
        val body: String,
        val timestamp: Long,
        val simSlot: Int?,
    )

    data class WireEnvelope(
        val v: Int,
        val n: String,
        val c: String,
    )

    fun secretToBytes(secretB64Url: String): ByteArray =
        Base64.getUrlDecoder().decode(secretB64Url)

    private fun deriveKey(secretB64Url: String): ByteArray {
        val secret = secretToBytes(secretB64Url)
        return hkdfSha256(secret, ByteArray(0), HKDF_INFO.toByteArray(Charsets.UTF_8), KEY_LEN)
    }

    /** Minimal HKDF-Expand with empty salt (matches Node hkdfSync sha256) */
    private fun hkdfSha256(ikm: ByteArray, salt: ByteArray, info: ByteArray, length: Int): ByteArray {
        val mac = Mac.getInstance("HmacSHA256")
        val actualSalt = if (salt.isEmpty()) ByteArray(32) else salt
        mac.init(SecretKeySpec(actualSalt, "HmacSHA256"))
        val prk = mac.doFinal(ikm)

        val okm = ByteArray(length)
        var t = ByteArray(0)
        var pos = 0
        var counter = 1
        while (pos < length) {
            mac.init(SecretKeySpec(prk, "HmacSHA256"))
            mac.update(t)
            mac.update(info)
            mac.update(counter.toByte())
            t = mac.doFinal()
            val copy = minOf(t.size, length - pos)
            System.arraycopy(t, 0, okm, pos, copy)
            pos += copy
            counter++
        }
        return okm
    }

    fun encryptPayload(secretB64Url: String, payload: SmsPayload): WireEnvelope {
        val key = deriveKey(secretB64Url)
        val nonce = ByteArray(NONCE_LEN).also { java.security.SecureRandom().nextBytes(it) }
        val plain = JSONObject().apply {
            put("id", payload.id)
            put("sender", payload.sender)
            put("body", payload.body)
            put("timestamp", payload.timestamp)
            put("simSlot", payload.simSlot)
        }.toString().toByteArray(Charsets.UTF_8)

        val cipher = Cipher.getInstance("AES/GCM/NoPadding")
        val spec: AlgorithmParameterSpec = GCMParameterSpec(TAG_LEN, nonce)
        cipher.init(Cipher.ENCRYPT_MODE, SecretKeySpec(key, "AES"), spec)
        val encrypted = cipher.doFinal(plain)

        return WireEnvelope(
            v = PROTOCOL_VERSION,
            n = Base64.getUrlEncoder().withoutPadding().encodeToString(nonce),
            c = Base64.getUrlEncoder().withoutPadding().encodeToString(encrypted),
        )
    }

    fun envelopeToJson(envelope: WireEnvelope): String =
        JSONObject().apply {
            put("v", envelope.v)
            put("n", envelope.n)
            put("c", envelope.c)
        }.toString()
}
