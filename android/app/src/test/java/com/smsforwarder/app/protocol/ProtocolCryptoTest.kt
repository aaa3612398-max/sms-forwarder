package com.smsforwarder.app.protocol

import org.json.JSONObject
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test
import java.util.Base64

/**
 * Cross-check envelope shape with Node protocol tests (same HKDF info + AES-GCM).
 */
class ProtocolCryptoTest {
    @Test
    fun encrypt_producesVersion1Envelope() {
        val secretBytes = ByteArray(32) { 0xAB.toByte() }
        val secret = Base64.getUrlEncoder().withoutPadding().encodeToString(secretBytes)
        val payload = ProtocolCrypto.SmsPayload(
            id = "id-1",
            sender = "10086",
            body = "验证码654321",
            timestamp = 1730000000000L,
            simSlot = 0,
        )
        val env = ProtocolCrypto.encryptPayload(secret, payload)
        assertEquals(1, env.v)
        assertTrue(env.n.isNotBlank())
        assertTrue(env.c.isNotBlank())
        val json = JSONObject(ProtocolCrypto.envelopeToJson(env))
        assertEquals(1, json.getInt("v"))
    }

    @Test
    fun pairingCodec_rejectsInvalid() {
        try {
            PairingCodec.decode("{}")
            error("expected")
        } catch (_: IllegalArgumentException) {
        }
    }
}
