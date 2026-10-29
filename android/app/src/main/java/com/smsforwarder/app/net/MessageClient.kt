package com.smsforwarder.app.net

import com.smsforwarder.app.protocol.PairingConfig
import com.smsforwarder.app.protocol.ProtocolCrypto
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import java.util.concurrent.TimeUnit

class MessageClient {
    private val client = OkHttpClient.Builder()
        .connectTimeout(8, TimeUnit.SECONDS)
        .readTimeout(12, TimeUnit.SECONDS)
        .writeTimeout(12, TimeUnit.SECONDS)
        .build()

    private val jsonType = "application/json; charset=utf-8".toMediaType()

    fun send(config: PairingConfig, payload: ProtocolCrypto.SmsPayload): Boolean {
        val envelope = ProtocolCrypto.encryptPayload(config.secret, payload)
        val body = ProtocolCrypto.envelopeToJson(envelope)
        val url = "http://${config.host}:${config.port}/api/v1/messages"
        val request = Request.Builder()
            .url(url)
            .post(body.toRequestBody(jsonType))
            .build()
        client.newCall(request).execute().use { resp ->
            return resp.isSuccessful
        }
    }
}
