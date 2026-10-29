package com.smsforwarder.app.protocol

import org.json.JSONObject
import java.security.SecureRandom
import java.util.Base64
import javax.crypto.Mac
import javax.crypto.spec.SecretKeySpec

object DiscoveryProtocol {
    const val DISCOVERY_UDP_PORT = 8766

    data class DiscoverRequest(val n: String, val s: String)
    data class DiscoverResponse(val n: String, val h: String, val p: Int, val d: String, val s: String)

    fun buildRequest(secretB64Url: String, nonce: String): DiscoverRequest {
        val sig = hmac(secretB64Url, "disc-req:$nonce")
        return DiscoverRequest(nonce, sig)
    }

    fun verifyResponse(secretB64Url: String, res: DiscoverResponse, expectedDesktopId: String?): Boolean {
        if (expectedDesktopId != null && res.d != expectedDesktopId) return false
        val payload = "${res.n}|${res.h}|${res.p}|${res.d}"
        return timingSafeEqual(hmac(secretB64Url, "disc-res:$payload"), res.s)
    }

    fun parseResponse(raw: String): DiscoverResponse? {
        return try {
            val o = JSONObject(raw)
            if (o.optString("t") != "sf-discover-res") return null
            DiscoverResponse(
                n = o.getString("n"),
                h = o.getString("h"),
                p = o.getInt("p"),
                d = o.getString("d"),
                s = o.getString("s"),
            )
        } catch (_: Exception) {
            null
        }
    }

    fun requestJson(req: DiscoverRequest): String =
        JSONObject().apply {
            put("t", "sf-discover-req")
            put("n", req.n)
            put("s", req.s)
        }.toString()

    fun randomNonce(): String {
        val bytes = ByteArray(12)
        SecureRandom().nextBytes(bytes)
        return Base64.getUrlEncoder().withoutPadding().encodeToString(bytes)
    }

    private fun deriveKey(secretB64Url: String): ByteArray =
        ProtocolCrypto.secretToBytes(secretB64Url).let { secret ->
            hkdfSha256(secret, ByteArray(0), "sms-forwarder-v1".toByteArray(Charsets.UTF_8), 32)
        }

    private fun hmac(secretB64Url: String, message: String): String {
        val key = deriveKey(secretB64Url)
        val mac = Mac.getInstance("HmacSHA256")
        mac.init(SecretKeySpec(key, "HmacSHA256"))
        val out = mac.doFinal(message.toByteArray(Charsets.UTF_8))
        return Base64.getUrlEncoder().withoutPadding().encodeToString(out)
    }

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

    private fun timingSafeEqual(a: String, b: String): Boolean {
        if (a.length != b.length) return false
        var out = 0
        for (i in a.indices) out = out or (a[i].code xor b[i].code)
        return out == 0
    }
}
