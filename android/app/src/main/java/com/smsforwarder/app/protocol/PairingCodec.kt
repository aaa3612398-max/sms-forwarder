package com.smsforwarder.app.protocol

import org.json.JSONObject

data class PairingConfig(
    val host: String,
    val port: Int,
    val secret: String,
)

object PairingCodec {
    fun decode(raw: String): PairingConfig {
        val data = JSONObject(raw)
        if (data.optString("t") != "sms-forwarder-pair") {
            throw IllegalArgumentException("Invalid pairing QR")
        }
        val host = data.getString("h")
        val port = data.getInt("p")
        val secret = data.getString("s")
        if (port !in 1..65535) throw IllegalArgumentException("Invalid port")
        return PairingConfig(host, port, secret)
    }
}
